import { resolve } from "node:path";

// Scripts run with cwd = infra/cdk (moon/npm project dir).
export const CDK_DIR = process.cwd();
export const REPO_ROOT = resolve(CDK_DIR, "..", "..");
export const ASSETS_DIR = resolve(CDK_DIR, "assets");
export const REGION = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? "eu-west-1";
