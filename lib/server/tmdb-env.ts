/**
 * TMDB credential resolution.
 *
 * Only one environment value is used: TMDB_API_KEY. Its shape decides the
 * authentication mode, so users never need to know which TMDB version it is:
 *   - JWT (starts with "eyJ", three dot-separated segments) -> v4 Bearer
 *   - 32 hex characters                                    -> v3 api_key
 *   - anything else                                        -> not configured
 *
 * The value is read through getRuntimeEnvValue so self-hosted / Vercel runtime
 * environments behave the same as the rest of the project.
 */

import { getRuntimeEnvValue } from '@/lib/server/runtime-env';

export type TmdbCredentialMode = 'v4' | 'v3' | null;

export interface TmdbCredential {
  mode: TmdbCredentialMode;
  value: string;
}

const JWT_PATTERN = /^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const V3_KEY_PATTERN = /^[a-fA-F0-9]{32}$/;

export function getTmdbCredential(): TmdbCredential {
  const value = getRuntimeEnvValue('TMDB_API_KEY').trim();

  if (!value) return { mode: null, value: '' };
  if (JWT_PATTERN.test(value)) return { mode: 'v4', value };
  if (V3_KEY_PATTERN.test(value)) return { mode: 'v3', value };

  return { mode: null, value: '' };
}
