import { log } from "./lib/log";
import { REGION } from "./lib/paths";
import { main, shOut } from "./lib/sh";
import { instanceId, ssmRun } from "./lib/ssm";

await main("deploy:status", async () => {
  const id = await instanceId();
  const state = await shOut("aws", [
    "ec2",
    "describe-instances",
    "--instance-ids",
    id,
    "--region",
    REGION,
    "--query",
    "Reservations[0].Instances[0].State.Name",
    "--output",
    "text",
  ]);
  log.step(`instance ${id}: ${state}`);
  if (state === "running") {
    const out = await ssmRun(
      id,
      "cd /opt/zas && docker compose -f docker-compose.deploy.yml ps",
    );
    console.log(out);
  }
});
