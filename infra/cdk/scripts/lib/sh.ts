import { execa, type Options } from "execa";

// Inherit stdio (stream live output); throws on non-zero exit.
export function sh(cmd: string, args: string[], opts: Options = {}) {
  return execa(cmd, args, { stdio: "inherit", ...opts });
}

// Capture stdout (trimmed).
export async function shOut(
  cmd: string,
  args: string[],
  opts: Options = {},
): Promise<string> {
  const { stdout } = await execa(cmd, args, opts);
  return (stdout ?? "").toString().trim();
}

// Top-level error boundary for a command script: typed message + nonzero exit.
export async function main(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\x1b[31m✗ ${label} failed:\x1b[0m ${msg}`);
    process.exit(1);
  }
}
