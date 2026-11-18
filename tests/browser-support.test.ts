import test from 'node:test';
import assert from 'node:assert/strict';

import { detectBrowserSupport } from '@/lib/config/browser-support';

const chrome = (version: string) =>
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`;

const edge = (version: string) =>
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36 Edg/${version}.0.0.0`;

const firefox = (version: string) =>
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${version}.0) Gecko/20100101 Firefox/${version}.0`;

const safari = (version: string) =>
  `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${version} Safari/605.1.15`;

const ios = (version: string) =>
  `Mozilla/5.0 (iPhone; CPU iPhone OS ${version.replace('.', '_')} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${version} Mobile/15E148 Safari/604.1`;

const iosChrome = (iosVersion: string, chromeVersion: string) =>
  `Mozilla/5.0 (iPhone; CPU iPhone OS ${iosVersion.replace('.', '_')} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/${chromeVersion}.0.0.0 Mobile/15E148 Safari/604.1`;

const androidWebView = (version: string) =>
  `Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/${version}.0.0.0 Mobile Safari/537.36`;

test('Chrome 130 is supported and Chrome 129 is not', () => {
  assert.equal(detectBrowserSupport(chrome('130')).supported, true);
  assert.equal(detectBrowserSupport(chrome('129')).supported, false);
});

test('Edge 130 is supported and Edge 129 is not', () => {
  assert.equal(detectBrowserSupport(edge('130')).supported, true);
  assert.equal(detectBrowserSupport(edge('129')).supported, false);
});

test('Safari 17.5 is supported and 17.4 is not', () => {
  assert.equal(detectBrowserSupport(safari('17.5')).supported, true);
  assert.equal(detectBrowserSupport(safari('17.4')).supported, false);
});

test('Firefox 121 is supported and 120 is not', () => {
  assert.equal(detectBrowserSupport(firefox('121')).supported, true);
  assert.equal(detectBrowserSupport(firefox('120')).supported, false);
});

test('iOS 17.5 is supported and 17.4 is not', () => {
  assert.equal(detectBrowserSupport(ios('17.5')).supported, true);
  assert.equal(detectBrowserSupport(ios('17.4')).supported, false);
});

test('iOS Chrome follows the WebKit/iOS version, not CriOS version', () => {
  assert.equal(detectBrowserSupport(iosChrome('17.4', '126')).supported, false);
  assert.equal(detectBrowserSupport(iosChrome('17.5', '130')).supported, true);
});

test('Android WebView follows its Chromium version', () => {
  assert.equal(detectBrowserSupport(androidWebView('130')).supported, true);
  assert.equal(detectBrowserSupport(androidWebView('129')).supported, false);
});

test('unknown and empty user agents are allowed through', () => {
  assert.equal(detectBrowserSupport('').supported, true);
  assert.equal(detectBrowserSupport(null).supported, true);
  assert.equal(detectBrowserSupport('SomeCustomEmbeddedBrowser/1.0').supported, true);
});
