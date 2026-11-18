export type BrowserFamily = 'chrome' | 'edge' | 'safari' | 'firefox' | 'ios' | 'unknown';

export interface BrowserSupportInfo {
  supported: boolean;
  family: BrowserFamily;
  label: string;
  version: string | null;
  minimum: string;
}

export const SUPPORTED_BROWSER_SUMMARY =
  'Chrome / Edge 130+、Safari 17.5+、Firefox 121+';

type VersionTuple = [number, number];

const MINIMUMS = {
  chromium: [130, 0] as VersionTuple,
  safari: [17, 5] as VersionTuple,
  firefox: [121, 0] as VersionTuple,
  ios: [17, 5] as VersionTuple,
};

function parseVersion(value: string | null | undefined): VersionTuple | null {
  if (!value) return null;

  const match = value.match(/(\d+)(?:[._](\d+))?/);
  if (!match) return null;

  return [Number.parseInt(match[1], 10), Number.parseInt(match[2] ?? '0', 10)];
}

function isAtLeast(version: VersionTuple, minimum: VersionTuple): boolean {
  return version[0] > minimum[0] || (version[0] === minimum[0] && version[1] >= minimum[1]);
}

function formatVersion(version: VersionTuple | null): string | null {
  return version ? `${version[0]}.${version[1]}` : null;
}

function buildResult(
  supported: boolean,
  family: BrowserFamily,
  label: string,
  version: VersionTuple | null,
  minimum: string,
): BrowserSupportInfo {
  return {
    supported,
    family,
    label,
    version: formatVersion(version),
    minimum,
  };
}

function detectIosBrowser(userAgent: string): BrowserSupportInfo | null {
  if (!/iPhone|iPad|iPod/i.test(userAgent)) return null;

  const versionMatch = userAgent.match(/\bOS (\d+)[._](\d+)/);
  const version = versionMatch
    ? [Number.parseInt(versionMatch[1], 10), Number.parseInt(versionMatch[2], 10)] as VersionTuple
    : null;

  if (!version) return null;

  let label = 'iOS Safari';
  if (/CriOS\//.test(userAgent)) label = 'iOS Chrome';
  else if (/FxiOS\//.test(userAgent)) label = 'iOS Firefox';
  else if (/EdgiOS\//.test(userAgent)) label = 'iOS Edge';

  return buildResult(
    isAtLeast(version, MINIMUMS.ios),
    'ios',
    label,
    version,
    'iOS 17.5+',
  );
}

/**
 * Server-safe browser support detection.
 *
 * Known browser families below the minimum are rejected. Unknown user agents
 * are allowed through so bots, future browsers, and embedded clients do not
 * get a false "unsupported" page; their feature support is handled by the
 * normal rendering path.
 */
export function detectBrowserSupport(
  userAgent: string | null | undefined,
): BrowserSupportInfo {
  if (!userAgent) {
    return buildResult(true, 'unknown', '未知浏览器', null, SUPPORTED_BROWSER_SUMMARY);
  }

  const iosResult = detectIosBrowser(userAgent);
  if (iosResult) return iosResult;

  const firefoxMatch = userAgent.match(/Firefox\/(\d+(?:[._]\d+)?)/);
  if (firefoxMatch) {
    const version = parseVersion(firefoxMatch[1]);
    return buildResult(
      !!version && isAtLeast(version, MINIMUMS.firefox),
      'firefox',
      'Firefox',
      version,
      'Firefox 121+',
    );
  }

  const chromiumMatch = userAgent.match(/(?:Chrome|Chromium)\/(\d+(?:[._]\d+)?)/);
  if (chromiumMatch) {
    const version = parseVersion(chromiumMatch[1]);
    let family: BrowserFamily = 'chrome';
    let label = 'Chrome';

    if (/Edg\//.test(userAgent)) {
      family = 'edge';
      label = 'Edge';
    } else if (/OPR\//.test(userAgent)) {
      label = 'Opera';
    } else if (/SamsungBrowser\//.test(userAgent)) {
      label = 'Samsung Internet';
    } else if (/;\s*wv\)/.test(userAgent)) {
      label = 'Android WebView';
    }

    return buildResult(
      !!version && isAtLeast(version, MINIMUMS.chromium),
      family,
      label,
      version,
      'Chrome / Edge 130+',
    );
  }

  const safariMatch = userAgent.match(/Version\/(\d+(?:[._]\d+)?).*Safari\//);
  if (safariMatch) {
    const version = parseVersion(safariMatch[1]);
    return buildResult(
      !!version && isAtLeast(version, MINIMUMS.safari),
      'safari',
      'Safari',
      version,
      'Safari 17.5+',
    );
  }

  return buildResult(true, 'unknown', '未知浏览器', null, SUPPORTED_BROWSER_SUMMARY);
}
