#!/usr/bin/env node
import { App, Tags } from "aws-cdk-lib";
import { cdkEnv, config } from "../config/env";
import { ZasAppStack } from "../lib/app-stack";
import { ZasEcrStack } from "../lib/ecr-stack";

const app = new App();

const imageTag = app.node.tryGetContext("imageTag") ?? "latest";
const allowedCidr =
  app.node.tryGetContext("allowedCidr") ?? config.defaultAllowedCidr;

new ZasEcrStack(app, "ZasEcrStack", { env: cdkEnv });
new ZasAppStack(app, "ZasAppStack", { env: cdkEnv, imageTag, allowedCidr });

for (const [k, v] of Object.entries(config.tags)) {
  Tags.of(app).add(k, v);
}
