type Context = Record<string, unknown>;

function sanitize(context: Context = {}) {
  return Object.fromEntries(
    Object.entries(context).filter(([key]) => !/token|secret|authorization/i.test(key)),
  );
}

export const logger = {
  info(message: string, context?: Context) {
    if (import.meta.env.DEV) console.info(message, sanitize(context));
  },
  warn(message: string, context?: Context) {
    console.warn(message, sanitize(context));
  },
  error(message: string, error?: unknown, context?: Context) {
    console.error(message, error instanceof Error ? error.message : undefined, sanitize(context));
    // Future Sentry integration belongs here; never attach room tokens.
  },
};
