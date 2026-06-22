import { sh, shOut } from "./sh";
import { REGION } from "./paths";

export async function stackOutputs(stack: string): Promise<Record<string, string>> {
  const json = await shOut("aws", [
    "cloudformation",
    "describe-stacks",
    "--stack-name",
    stack,
    "--region",
    REGION,
    "--query",
    "Stacks[0].Outputs",
    "--output",
    "json",
  ]);
  const arr = JSON.parse(json || "[]") as { OutputKey: string; OutputValue: string }[];
  return Object.fromEntries(arr.map((o) => [o.OutputKey, o.OutputValue]));
}

export async function instanceId(): Promise<string> {
  const out = await stackOutputs("ZasAppStack");
  if (!out.InstanceId) {
    throw new Error("InstanceId output missing — is ZasAppStack deployed?");
  }
  return out.InstanceId;
}

// Run a shell command on the box via SSM RunShellScript; return stdout.
export async function ssmRun(id: string, command: string): Promise<string> {
  const cmdId = await shOut("aws", [
    "ssm",
    "send-command",
    "--instance-ids",
    id,
    "--document-name",
    "AWS-RunShellScript",
    "--parameters",
    JSON.stringify({ commands: [command] }),
    "--region",
    REGION,
    "--query",
    "Command.CommandId",
    "--output",
    "text",
  ]);
  await sh("aws", [
    "ssm",
    "wait",
    "command-executed",
    "--command-id",
    cmdId,
    "--instance-id",
    id,
    "--region",
    REGION,
  ]).catch(() => {
    // non-zero remote exit still has captured output below
  });
  return shOut("aws", [
    "ssm",
    "get-command-invocation",
    "--command-id",
    cmdId,
    "--instance-id",
    id,
    "--region",
    REGION,
    "--query",
    "StandardOutputContent",
    "--output",
    "text",
  ]);
}
