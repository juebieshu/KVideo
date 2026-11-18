/**
 * Read a runtime environment value on Vercel / Docker / Node self-hosting.
 */
export function getRuntimeEnvValue(name: string, fallback = ''): string {
  return typeof process !== 'undefined' ? process.env[name] || fallback : fallback;
}
