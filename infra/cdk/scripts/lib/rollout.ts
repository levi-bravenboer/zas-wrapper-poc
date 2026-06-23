import { setTimeout as delay } from "node:timers/promises";
import { log } from "./log";
import { ASSETS_DIR, REGION } from "./paths";
import { sh } from "./sh";
import { instanceId, ssmRun, stackOutputs } from "./ssm";

export async function bucketName(): Promise<string> {
  const out = await stackOutputs("ZasAppStack");
  if (!out.ConfigBucket) {
    throw new Error("ConfigBucket output missing — is ZasAppStack deployed?");
  }
  return out.ConfigBucket;
}

// Push the freshly-staged assets (compose, ory/nginx configs, secrets.env,
// tag.env) to the config bucket so the box's `s3 sync` picks them up. No
// --delete: the bucket is the box's source of truth and CDK reconciles it.
export async function syncAssets(bucket: string): Promise<void> {
  log.step(`sync assets → s3://${bucket}`);
  await sh("aws", ["s3", "sync", ASSETS_DIR, `s3://${bucket}`, "--region", REGION]);
}

// In-place rollout: tell the running box (via SSM) to re-sync configs, pin the
// new image tag, re-login to ECR, and recompose. No instance replacement, so
// the data volume is never touched.
export async function rollout(opts: {
  bucket: string;
  registry: string;
  tag: string;
}): Promise<void> {
  const id = await instanceId();
  const script = [
    "set -eu",
    "cd /opt/zas",
    `aws s3 sync s3://${opts.bucket} /opt/zas`,
    `if grep -q '^IMAGE_TAG=' .env; then sed -i 's#^IMAGE_TAG=.*#IMAGE_TAG=${opts.tag}#' .env; else echo 'IMAGE_TAG=${opts.tag}' >> .env; fi`,
    `aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${opts.registry}`,
    "docker compose -f docker-compose.deploy.yml pull",
    "docker compose -f docker-compose.deploy.yml up -d",
  ].join("\n");

  // After a fresh boot/replacement the SSM agent (and /opt/zas) need warmup.
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      log.step(`rollout ${opts.tag} via SSM (attempt ${attempt}/6)`);
      const out = await ssmRun(id, script);
      if (out.trim()) console.log(out);
      return;
    } catch (err) {
      if (attempt === 6) throw err;
      await delay(20_000);
    }
  }
}
