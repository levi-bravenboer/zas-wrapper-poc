const c = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
  reset: "\x1b[0m",
};

export const log = {
  info: (m: string) => console.log(`${c.dim}›${c.reset} ${m}`),
  step: (m: string) => console.log(`\n${c.green}==>${c.reset} ${m}`),
  warn: (m: string) => console.warn(`${c.yellow}!${c.reset} ${m}`),
  error: (m: string) => console.error(`${c.red}✗${c.reset} ${m}`),
};
