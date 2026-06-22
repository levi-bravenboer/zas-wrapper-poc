import * as path from "node:path";
import { RemovalPolicy } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

// Private SSE-KMS bucket holding the compose file + ory/nginx configs + the
// staged secret `.env` (secrets.env). Uploaded at deploy time via
// BucketDeployment; the box syncs it on boot. Ephemeral: destroy empties + deletes.
export class ConfigBucket extends Construct {
  readonly bucket: s3.Bucket;
  readonly deployment: s3deploy.BucketDeployment;

  constructor(scope: Construct, id: string, assetDir: string) {
    super(scope, id);

    this.bucket = new s3.Bucket(this, "Bucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.deployment = new s3deploy.BucketDeployment(this, "Deploy", {
      destinationBucket: this.bucket,
      sources: [s3deploy.Source.asset(path.resolve(assetDir))],
      retainOnDelete: false,
    });
  }
}
