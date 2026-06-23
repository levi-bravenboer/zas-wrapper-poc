import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execa } from "execa";
import { log } from "./log";
import { REGION, REPO_ROOT } from "./paths";

// Vars compose interpolates from secrets.env that have NO fallback in
// docker-compose.deploy.yml — an empty value silently produces a broken
// container (e.g. empty admin email → Kratos 400 → seed crash loop). Vars
// that do have a compose default (POSTGRES_PASSWORD:-zas, etc.) are not
// listed here.
const REQUIRED_ENV_KEYS = [
  "BACKEND_BOOTSTRAP_ADMIN_EMAIL",
  "BACKEND_BOOTSTRAP_ADMIN_NAME",
  "BACKEND_BOOTSTRAP_ADMIN_PASSWORD",
] as const;

async function ok(cmd: string, args: string[]): Promise<boolean> {
  try {
    await execa(cmd, args);
    return true;
  } catch {
    return false;
  }
}

function parseEnv(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out.set(key, value);
  }
  return out;
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
  } else {
    const env = parseEnv(readFileSync(envPath, "utf8"));
    const missing = REQUIRED_ENV_KEYS.filter((k) => !env.get(k));
    if (missing.length > 0) {
      fails.push(
        `${envPath} missing or empty: ${missing.join(", ")} → fill from .env.deploy.example`,
      );
    }
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
