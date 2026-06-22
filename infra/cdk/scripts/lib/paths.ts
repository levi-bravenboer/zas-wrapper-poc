import { resolve } from "node:path";

// Scripts run with cwd = infra/cdk (moon/npm project dir).
export const CDK_DIR = process.cwd();
export const REPO_ROOT = resolve(CDK_DIR, "..", "..");
export const ASSETS_DIR = resolve(CDK_DIR, "assets");
// Pinned for EU data residency (CLI default may differ, e.g. eu-central-1).
export const REGION = "eu-west-1";
