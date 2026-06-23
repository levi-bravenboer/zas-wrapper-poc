import { execa } from "execa";
import { buildAndPush, stageAssets } from "./lib/build";
import { log } from "./lib/log";
import { REGION } from "./lib/paths";
import { preflight } from "./lib/preflight";
import { bucketName, rollout, syncAssets } from "./lib/rollout";
import { main, shOut } from "./lib/sh";

// Build + push images, then roll them onto the running box in-place via SSM —
// no infra change, no instance replacement, data volume untouched.
await main("deploy:images", async () => {
  await preflight();

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

  const bucket = await bucketName();
  await syncAssets(bucket);
  await rollout({ bucket, registry, tag });
});
