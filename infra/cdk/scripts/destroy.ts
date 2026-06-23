import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { log } from "./lib/log";
import { main, sh } from "./lib/sh";

await main("deploy:down", async () => {
  const rl = createInterface({ input: stdin, output: stdout });
  const ans = await rl.question("Type DESTROY to tear down both stacks: ");
  rl.close();
  if (ans.trim() !== "DESTROY") {
    log.warn("aborted — nothing destroyed");
    return;
  }
  log.step("destroying ZasAppStack + ZasEcrStack");
  await sh("npx", ["cdk", "destroy", "ZasAppStack", "ZasEcrStack", "--force"]);
  log.step("destroyed — verify no residual EC2/EIP/ECR/S3 in the console");
  log.warn(
    "the data volume (tag Name=zas-data) is RETAINED by design and survives teardown. " +
      "To delete it too (irreversible): `aws ec2 delete-volume --region eu-west-1 --volume-id <id>` " +
      "(find it via `aws ec2 describe-volumes --region eu-west-1 --filters Name=tag:Name,Values=zas-data`).",
  );
});
