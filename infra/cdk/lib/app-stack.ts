import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import type { Construct } from "constructs";
import { config } from "../config/env";
import { Compute } from "./constructs/compute";
import { ConfigBucket } from "./constructs/config-bucket";
import { Dns } from "./constructs/dns";
import { Networking } from "./constructs/networking";
import { buildUserData } from "./user-data";

export interface ZasAppStackProps extends StackProps {
  /** git sha tag of the pushed images (from `-c imageTag=...`). */
  readonly imageTag: string;
  /** CIDR allowed on 80/443 (from `-c allowedCidr=...`). */
  readonly allowedCidr: string;
}

export class ZasAppStack extends Stack {
  constructor(scope: Construct, id: string, props: ZasAppStackProps) {
    super(scope, id, props);

    const region = this.region;
    const account = this.account;
    const ecrRegistry = `${account}.dkr.ecr.${region}.amazonaws.com`;

    // Assets uploaded to S3: compose + ory/nginx configs + staged secrets.env.
    const here = path.dirname(fileURLToPath(import.meta.url));
    const assetDir = path.join(here, "..", "assets");
    const configBucket = new ConfigBucket(this, "Config", assetDir);

    const net = new Networking(this, "Net", { allowedCidr: props.allowedCidr });

    const userData = buildUserData({
      region,
      ecrRegistry,
      imageTag: props.imageTag,
      appHost: config.appHost,
      apiHost: config.apiHost,
      filesHost: config.filesHost,
      leEmail: config.leEmail,
      bucketName: configBucket.bucket.bucketName,
    });

    const compute = new Compute(this, "Compute", {
      vpc: net.vpc,
      securityGroup: net.securityGroup,
      userData,
      instanceType: config.instanceType,
      volumeSizeGb: config.volumeSizeGb,
    });

    // Box boots only after configs + secrets are uploaded.
    compute.instance.node.addDependency(configBucket.deployment);

    // Least-priv grants: pull the two repos, read the config bucket.
    for (const name of [config.backendRepo, config.orchestratorRepo]) {
      ecr.Repository.fromRepositoryName(this, `${name}-ref`, name).grantPull(
        compute.role,
      );
    }
    configBucket.bucket.grantRead(compute.role);

    new Dns(this, "Dns", {
      zoneName: config.hostedZone,
      appHost: config.appHost,
      apiHost: config.apiHost,
      filesHost: config.filesHost,
      ip: compute.eip.ref,
    });

    new CfnOutput(this, "AppUrl", { value: `https://${config.appHost}` });
    new CfnOutput(this, "ApiUrl", { value: `https://${config.apiHost}` });
    new CfnOutput(this, "PublicIp", { value: compute.eip.ref });
    new CfnOutput(this, "InstanceId", { value: compute.instance.instanceId });
    new CfnOutput(this, "SsmConnect", {
      value: `aws ssm start-session --target ${compute.instance.instanceId} --region ${region}`,
    });
    new CfnOutput(this, "ConfigBucket", { value: configBucket.bucket.bucketName });
  }
}
