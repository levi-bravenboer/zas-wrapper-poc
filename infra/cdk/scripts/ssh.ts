import { log } from "./lib/log";
import { REGION } from "./lib/paths";
import { main, sh } from "./lib/sh";
import { instanceId } from "./lib/ssm";

await main("deploy:ssh", async () => {
  const id = await instanceId();
  log.step(`SSM session → ${id}`);
  await sh("aws", ["ssm", "start-session", "--target", id, "--region", REGION]);
});
