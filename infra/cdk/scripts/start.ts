import { log } from "./lib/log";
import { REGION } from "./lib/paths";
import { main, sh } from "./lib/sh";
import { instanceId } from "./lib/ssm";

await main("deploy:start", async () => {
  const id = await instanceId();
  await sh("aws", ["ec2", "start-instances", "--instance-ids", id, "--region", REGION]);
  log.step("starting — EIP + data preserved; give containers a minute");
});
