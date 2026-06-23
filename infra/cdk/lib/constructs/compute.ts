import { RemovalPolicy } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface ComputeProps {
  readonly vpc: ec2.IVpc;
  readonly securityGroup: ec2.ISecurityGroup;
  readonly userData: ec2.UserData;
  readonly instanceType: string;
  readonly volumeSizeGb: number;
  readonly dataVolumeSizeGb: number;
}

// Single EC2 (AL2023) on a public subnet with a stable Elastic IP. IAM role
// carries SSM (shell, no SSH); ECR-pull + S3-read are granted by the stack.
// Durable state (Postgres/MinIO/LE certs) lives on a dedicated, retained EBS
// volume mounted as Docker's data-root, so it survives instance replacement.
export class Compute extends Construct {
  readonly instance: ec2.Instance;
  readonly role: iam.Role;
  readonly eip: ec2.CfnEIP;
  readonly dataVolume: ec2.CfnVolume;

  constructor(scope: Construct, id: string, props: ComputeProps) {
    super(scope, id);

    // Pin to one AZ. The data volume is AZ-scoped, so the instance must always
    // land in the same AZ for the volume to (re)attach after a replacement.
    const az = props.vpc.availabilityZones[0];

    this.role = new iam.Role(this, "Role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
      ],
    });

    this.instance = new ec2.Instance(this, "Instance", {
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC, availabilityZones: [az] },
      availabilityZone: az,
      instanceType: new ec2.InstanceType(props.instanceType),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: props.securityGroup,
      role: this.role,
      userData: props.userData,
      // UserData carries no image tag (tags roll out in-place via SSM), so this
      // now only triggers on genuine boot-script changes. Safe: all durable
      // state lives on the retained data volume below, which survives replacement.
      userDataCausesReplacement: true,
      blockDevices: [
        {
          // OS-only root volume — disposable; gets recreated on replacement.
          deviceName: "/dev/xvda",
          volume: ec2.BlockDeviceVolume.ebs(props.volumeSizeGb, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            deleteOnTermination: true,
            encrypted: true,
          }),
        },
      ],
    });

    // Dedicated data volume holding Docker's data-root. RETAIN (incl. on
    // update-replace) means CloudFormation never deletes it — not on instance
    // replacement, not on stack teardown. The deploy flow physically cannot
    // wipe the database.
    this.dataVolume = new ec2.CfnVolume(this, "DataVolume", {
      availabilityZone: az,
      size: props.dataVolumeSizeGb,
      volumeType: "gp3",
      encrypted: true,
      tags: [{ key: "Name", value: "zas-data" }],
    });
    this.dataVolume.applyRemovalPolicy(RemovalPolicy.RETAIN, {
      applyToUpdateReplacePolicy: true,
    });

    new ec2.CfnVolumeAttachment(this, "DataAttachment", {
      instanceId: this.instance.instanceId,
      volumeId: this.dataVolume.ref,
      device: "/dev/sdf",
    });

    this.eip = new ec2.CfnEIP(this, "Eip");
    new ec2.CfnEIPAssociation(this, "EipAssoc", {
      allocationId: this.eip.attrAllocationId,
      instanceId: this.instance.instanceId,
    });
  }
}
