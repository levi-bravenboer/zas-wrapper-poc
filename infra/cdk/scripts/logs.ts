import { main } from "./lib/sh";
import { instanceId, ssmRun } from "./lib/ssm";

await main("deploy:logs", async () => {
  const id = await instanceId();
  const out = await ssmRun(
    id,
    "cd /opt/zas && docker compose -f docker-compose.deploy.yml logs --tail=200",
  );
  console.log(out);
});
