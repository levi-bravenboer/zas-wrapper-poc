import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { execa } from "execa";
import { log } from "./log";
import { REGION, REPO_ROOT } from "./paths";

async function ok(cmd: string, args: string[]): Promise<boolean> {
  try {
    await execa(cmd, args);
    return true;
  } catch {
    return false;
  }
}

// Fail fast before any mutation, with an exact fix per failure.
export async function preflight(): Promise<void> {
  const fails: string[] = [];

  if (!(await ok("aws", ["sts", "get-caller-identity"]))) {
    fails.push("AWS creds inactive → run `aws sso login`");
  }
  if (!(await ok("docker", ["info"]))) {
    fails.push("Docker daemon not running → start Docker");
  }
  const envPath = resolve(REPO_ROOT, "apps/backend/.env");
  if (!existsSync(envPath)) {
    fails.push(`missing ${envPath} → copy .env.deploy.example and fill secrets`);
  }
  if (
    !(await ok("aws", [
      "cloudformation",
      "describe-stacks",
      "--stack-name",
      "CDKToolkit",
      "--region",
      REGION,
    ]))
  ) {
    fails.push(`CDK not bootstrapped in ${REGION} → run \`npx cdk bootstrap\``);
  }

  if (fails.length > 0) {
    for (const f of fails) log.error(f);
    throw new Error(`preflight failed (${fails.length} issue(s))`);
  }
  log.step("preflight passed");
}

// Allow `deploy:preflight` to run this file directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  preflight().catch(() => process.exit(1));
}
