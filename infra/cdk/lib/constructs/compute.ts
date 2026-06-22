import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface ComputeProps {
  readonly vpc: ec2.IVpc;
  readonly securityGroup: ec2.ISecurityGroup;
  readonly userData: ec2.UserData;
  readonly instanceType: string;
  readonly volumeSizeGb: number;
}

// Single EC2 (AL2023) on a public subnet with a stable Elastic IP. IAM role
// carries SSM (shell, no SSH); ECR-pull + S3-read are granted by the stack.
export class Compute extends Construct {
  readonly instance: ec2.Instance;
  readonly role: iam.Role;
  readonly eip: ec2.CfnEIP;

  constructor(scope: Construct, id: string, props: ComputeProps) {
    super(scope, id);

    this.role = new iam.Role(this, "Role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
      ],
    });

    this.instance = new ec2.Instance(this, "Instance", {
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType(props.instanceType),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: props.securityGroup,
      role: this.role,
      userData: props.userData,
      blockDevices: [
        {
          deviceName: "/dev/xvda",
          volume: ec2.BlockDeviceVolume.ebs(props.volumeSizeGb, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            deleteOnTermination: true,
            encrypted: true,
          }),
        },
      ],
    });

    this.eip = new ec2.CfnEIP(this, "Eip");
    new ec2.CfnEIPAssociation(this, "EipAssoc", {
      allocationId: this.eip.attrAllocationId,
      instanceId: this.instance.instanceId,
    });
  }
}
