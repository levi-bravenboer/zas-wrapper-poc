import { log } from "./lib/log";
import { REGION } from "./lib/paths";
import { main, sh } from "./lib/sh";
import { instanceId } from "./lib/ssm";

await main("deploy:stop", async () => {
  const id = await instanceId();
  await sh("aws", ["ec2", "stop-instances", "--instance-ids", id, "--region", REGION]);
  log.step("stopping — compute billing pauses; EBS + EIP (DNS) persist");
});
