import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isVercelDeployment,
  shouldEnableVercelAnalytics,
} from '@/lib/config/deployment';

test('self-hosted deployments do not enable Vercel Analytics', () => {
  const env = {};

  assert.equal(isVercelDeployment(env), false);
  assert.equal(shouldEnableVercelAnalytics(env), false);
});

test('Vercel deployments enable Vercel Analytics', () => {
  assert.equal(shouldEnableVercelAnalytics({ VERCEL: '1' }), true);
  assert.equal(shouldEnableVercelAnalytics({ VERCEL_ENV: 'production' }), true);
});

test('non-Vercel environments do not enable Vercel Analytics', () => {
  assert.equal(shouldEnableVercelAnalytics({ CF_PAGES: '1' }), false);
  assert.equal(shouldEnableVercelAnalytics({ CF_PAGES_URL: 'https://kvideo.pages.dev' }), false);
});
