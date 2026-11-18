type EnvLike = Record<string, string | undefined>;

export function isVercelDeployment(env: EnvLike = process.env): boolean {
  return env.VERCEL === '1' || Boolean(env.VERCEL_ENV);
}

export function shouldEnableVercelAnalytics(env: EnvLike = process.env): boolean {
  return isVercelDeployment(env);
}
