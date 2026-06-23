import { Stack, type StackProps, RemovalPolicy } from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import type { Construct } from "constructs";
import { config } from "../config/env";

// ECR repos for the two custom images. Deployed before the app stack so
// deploy.ts can push images the app stack's EC2 then pulls. Ephemeral:
// destroy wipes the repos + images.
export class ZasEcrStack extends Stack {
  readonly backendRepo: ecr.Repository;
  readonly orchestratorRepo: ecr.Repository;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const opts = {
      removalPolicy: RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    };

    this.backendRepo = new ecr.Repository(this, "BackendRepo", {
      repositoryName: config.backendRepo,
      ...opts,
    });
    this.orchestratorRepo = new ecr.Repository(this, "OrchestratorRepo", {
      repositoryName: config.orchestratorRepo,
      ...opts,
    });
  }
}
