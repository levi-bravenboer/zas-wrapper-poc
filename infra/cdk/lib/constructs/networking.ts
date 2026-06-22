import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export interface NetworkingProps {
  /** CIDR allowed to reach 80/443. Lock to a known IP for the week. */
  readonly allowedCidr: string;
}

// Default VPC + a security group exposing only 80/443. No inbound SSH —
// shell access is via SSM. fromLookup requires the stack to have an explicit env.
export class Networking extends Construct {
  readonly vpc: ec2.IVpc;
  readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkingProps) {
    super(scope, id);

    this.vpc = ec2.Vpc.fromLookup(this, "DefaultVpc", { isDefault: true });

    this.securityGroup = new ec2.SecurityGroup(this, "Sg", {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: "zas demo - 80/443 only; SSM for shell",
    });
    const peer = ec2.Peer.ipv4(props.allowedCidr);
    this.securityGroup.addIngressRule(peer, ec2.Port.tcp(80), "http + ACME challenge");
    this.securityGroup.addIngressRule(peer, ec2.Port.tcp(443), "https");
  }
}
