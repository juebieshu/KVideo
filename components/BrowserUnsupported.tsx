import type {
  BrowserFamily,
  BrowserSupportInfo,
} from '@/lib/config/browser-support';

const styles = `
  html, body {
    margin: 0 !important;
  }

  main.bu-page {
    --bu-bg: #ffffff;
    --bu-text: #1d1d1f;
    --bu-muted: #626269;
    --bu-line: #e8e8ea;

    box-sizing: border-box !important;
    min-height: 100vh !important;
    display: flex !important;
    flex-direction: column !important;
    margin: 0 !important;
    padding: 0 !important;
    background: var(--bu-bg) !important;
    color: var(--bu-text) !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
      "Noto Sans", sans-serif !important;
  }

  .bu-page .bu-header {
    padding: 28px 48px !important;
    color: var(--bu-text) !important;
    font-size: 16px !important;
    font-weight: 650 !important;
    line-height: 1.5 !important;
    letter-spacing: -0.03em !important;
  }

  .bu-page .bu-content {
    box-sizing: border-box !important;
    width: 100% !important;
    max-width: 560px !important;
    margin: auto !important;
    padding: 48px 32px 96px !important;
  }

  .bu-page .bu-icon {
    display: block !important;
    width: 44px !important;
    height: 44px !important;
    margin: 0 0 28px !important;
    color: var(--bu-muted) !important;
  }

  .bu-page .bu-title {
    margin: 0 !important;
    color: var(--bu-text) !important;
    font-size: 36px !important;
    font-weight: 650 !important;
    line-height: 1.2 !important;
    letter-spacing: -0.04em !important;
  }

  .bu-page .bu-copy {
    margin: 16px 0 0 !important;
    color: var(--bu-muted) !important;
    font-size: 16px !important;
    font-weight: 400 !important;
    line-height: 1.7 !important;
  }

  .bu-page .bu-details {
    margin: 36px 0 0 !important;
    padding: 20px 0 0 !important;
    border: 0 !important;
    border-top: 1px solid var(--bu-line) !important;
    font-size: 14px !important;
    line-height: 1.5 !important;
  }

  .bu-page .bu-row {
    display: flex !important;
    justify-content: space-between !important;
    align-items: baseline !important;
    gap: 24px !important;
  }

  .bu-page .bu-row + .bu-row {
    margin-top: 12px !important;
  }

  .bu-page .bu-row dt {
    flex-shrink: 0 !important;
    color: var(--bu-muted) !important;
  }

  .bu-page .bu-row dd {
    min-width: 0 !important;
    margin: 0 !important;
    color: var(--bu-text) !important;
    text-align: right !important;
    overflow-wrap: anywhere !important;
  }

  @media (max-width: 560px) {
    .bu-page .bu-header {
      padding: 24px !important;
    }

    .bu-page .bu-content {
      padding: 40px 24px 80px !important;
    }

    .bu-page .bu-title {
      font-size: 30px !important;
    }
  }

  @media (prefers-color-scheme: dark) {
    main.bu-page {
      --bu-bg: #191919;
      --bu-text: #f5f5f5;
      --bu-muted: #aaaab0;
      --bu-line: #39393c;
      color-scheme: dark;
    }
  }
`;

const MINIMUM_BY_FAMILY: Record<BrowserFamily, string> = {
  chrome: '130+',
  edge: '130+',
  safari: '17.5+',
  firefox: '121+',
  ios: '17.5+',
  unknown: '130+',
};

const TARGET_BY_FAMILY: Record<BrowserFamily, string> = {
  chrome: 'Chrome',
  edge: 'Edge',
  safari: 'Safari',
  firefox: 'Firefox',
  ios: 'iOS / iPadOS',
  unknown: 'Chrome 或 Edge',
};

export function BrowserUnsupported({ info }: { info: BrowserSupportInfo }) {
  const isUnknown = info.family === 'unknown';
  const currentVersion = info.version || '未知';
  const minimumVersion = MINIMUM_BY_FAMILY[info.family] || '130+';
  const targetBrowser = TARGET_BY_FAMILY[info.family] || 'Chrome 或 Edge';

  return (
    <main className="bu-page">
      <style>{styles}</style>

      <header className="bu-header">KVideo</header>

      <section className="bu-content" aria-labelledby="bu-title">
        <h1 id="bu-title" className="bu-title">
          {isUnknown ? '当前浏览器暂不支持' : '请更新浏览器'}
        </h1>

        <p className="bu-copy">
          {isUnknown ? (
            <>
              当前浏览器暂时无法使用 KVideo。
              <br />
              请使用较新版本的 Chrome 或 Edge 重新打开。
            </>
          ) : (
            <>
              当前浏览器版本过低，暂时无法使用 KVideo。
              <br />
              请更新浏览器，然后重新打开此页面。
            </>
          )}
        </p>

        <dl className="bu-details">
          <div className="bu-row">
            <dt>当前版本</dt>
            <dd>
              {info.label} {currentVersion}
            </dd>
          </div>

          <div className="bu-row">
            <dt>{isUnknown ? '推荐使用' : '最低要求'}</dt>
            <dd>
              {targetBrowser} {minimumVersion}
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}