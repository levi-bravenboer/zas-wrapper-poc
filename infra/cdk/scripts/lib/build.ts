import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../../config/env";
import { log } from "./log";
import { ASSETS_DIR, REPO_ROOT } from "./paths";
import { sh } from "./sh";

// Build the two custom images and push to ECR. Orchestrator bakes the
// browser-facing API base (build-time Vite var) for the demo domain.
export async function buildAndPush(registry: string, tag: string): Promise<void> {
  const backend = `${registry}/${config.backendRepo}`;
  const orchestrator = `${registry}/${config.orchestratorRepo}`;

  log.step("build backend image");
  await sh("docker", [
    "build",
    "-t",
    `${backend}:${tag}`,
    "-f",
    resolve(REPO_ROOT, "apps/backend/Dockerfile"),
    resolve(REPO_ROOT, "apps/backend"),
  ]);

  log.step("build orchestrator image");
  await sh("docker", [
    "build",
    "-t",
    `${orchestrator}:${tag}`,
    "--build-arg",
    `VITE_API_BASE_URL=https://${config.apiHost}`,
    "--build-arg",
    "VITE_API_MODE=live",
    "-f",
    resolve(REPO_ROOT, "apps/orchestrator/Dockerfile.deploy"),
    resolve(REPO_ROOT, "apps/orchestrator"),
  ]);

  log.step("push images");
  await sh("docker", ["push", `${backend}:${tag}`]);
  await sh("docker", ["push", `${orchestrator}:${tag}`]);
}

// Stage compose + ory/nginx configs + the secret .env into assets/ for the
// BucketDeployment. secrets.env never leaves the box's S3 bucket.
export function stageAssets(): void {
  log.step("stage assets (compose + ory configs + secrets.env)");
  // clean prior staging (keep .gitignore/.gitkeep)
  rmSync(resolve(ASSETS_DIR, "infra"), { recursive: true, force: true });
  rmSync(resolve(ASSETS_DIR, "docker-compose.deploy.yml"), { force: true });
  rmSync(resolve(ASSETS_DIR, "secrets.env"), { force: true });

  mkdirSync(ASSETS_DIR, { recursive: true });
  copyFileSync(
    resolve(REPO_ROOT, "docker-compose.deploy.yml"),
    resolve(ASSETS_DIR, "docker-compose.deploy.yml"),
  );
  cpSync(resolve(REPO_ROOT, "infra/ory"), resolve(ASSETS_DIR, "infra/ory"), {
    recursive: true,
  });

  const env = resolve(REPO_ROOT, "apps/backend/.env");
  if (!existsSync(env)) {
    throw new Error("apps/backend/.env missing — fill from .env.deploy.example");
  }
  copyFileSync(env, resolve(ASSETS_DIR, "secrets.env"));
}
