import { execa } from "execa";
import { buildAndPush, stageAssets } from "./lib/build";
import { log } from "./lib/log";
import { REGION } from "./lib/paths";
import { preflight } from "./lib/preflight";
import { bucketName, rollout } from "./lib/rollout";
import { main, sh, shOut } from "./lib/sh";

await main("deploy:up", async () => {
  await preflight();

  log.step("deploy ECR stack");
  await sh("npx", ["cdk", "deploy", "ZasEcrStack", "--require-approval", "never"]);

  const account = await shOut("aws", [
    "sts",
    "get-caller-identity",
    "--query",
    "Account",
    "--output",
    "text",
  ]);
  const registry = `${account}.dkr.ecr.${REGION}.amazonaws.com`;
  const tag = await shOut("git", ["rev-parse", "--short", "HEAD"]);

  log.step("docker login ECR");
  const pw = await shOut("aws", ["ecr", "get-login-password", "--region", REGION]);
  await execa("docker", ["login", "--username", "AWS", "--password-stdin", registry], {
    input: pw,
    stdio: ["pipe", "inherit", "inherit"],
  });

  await buildAndPush(registry, tag);
  stageAssets(tag);

  // App stack no longer carries the image tag — the box pulls it from the
  // S3-synced tag.env (staged above), so a tag bump never changes UserData.
  log.step("deploy app stack");
  await sh("npx", ["cdk", "deploy", "ZasAppStack", "--require-approval", "never"]);

  // Roll the new images onto the running box in-place (no replacement). On a
  // first/replaced boot the box self-deploys via UserData; this is idempotent.
  const bucket = await bucketName();
  await rollout({ bucket, registry, tag });

  await sh("npx", ["tsx", "scripts/url.ts"]).catch(() => {});
});
