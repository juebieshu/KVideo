import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = process.cwd();

test('navbar keeps account and settings actions available below the desktop breakpoint', () => {
  const source = readFileSync(
    join(projectRoot, 'components/layout/Navbar.tsx'),
    'utf8',
  );

  const accountButton = source.match(/<button\b[^>]*aria-label=\{`账户：\$\{displayName\}`\}[^>]*>/)?.[0];
  const settingsButton = source.match(/<button\b[^>]*aria-label="设置"[^>]*>/)?.[0];

  assert.ok(accountButton);
  assert.ok(settingsButton);
  assert.doesNotMatch(accountButton, /\bhidden\b/);
  assert.doesNotMatch(settingsButton, /\bhidden\b/);
  assert.match(source, /onClick=\{openAccountSettings\}/);
});

test('premium settings includes the shared account management section', () => {
  const source = readFileSync(
    join(projectRoot, 'app/premium/settings/page.tsx'),
    'utf8',
  );

  assert.match(source, /import \{ AccountSettings \} from '@\/components\/settings\/AccountSettings';/);
  assert.match(source, /<AppVersionSettings \/>[\s\S]*?<AccountSettings \/>/);
});
