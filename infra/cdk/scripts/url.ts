import { log } from "./lib/log";
import { main } from "./lib/sh";
import { stackOutputs } from "./lib/ssm";

await main("deploy:url", async () => {
  const o = await stackOutputs("ZasAppStack");
  log.step("endpoints");
  console.log(`  app: ${o.AppUrl ?? "?"}`);
  console.log(`  api: ${o.ApiUrl ?? "?"}`);
  console.log(`  ip:  ${o.PublicIp ?? "?"}`);
  console.log(`  ssm: ${o.SsmConnect ?? "?"}`);
});
