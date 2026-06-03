// The ONLY file in this app allowed to call `console.*` (ESLint `no-console`
// is otherwise on at error severity). Swap implementation here when a real
// logging backend (Sentry / Datadog / …) lands.

type LogArgs = readonly unknown[]

export const log = {
  info: (...args: LogArgs): void => {
    console.info(...args)
  },
  warn: (...args: LogArgs): void => {
    console.warn(...args)
  },
  error: (...args: LogArgs): void => {
    console.error(...args)
  },
}
