'use client';

import { useState, useEffect, useRef } from 'react';
import { siteConfig } from '@/lib/config/site-config';
import { clearSession, getSession, setSession, type AuthSession } from '@/lib/store/auth-store';
import { resolvePasswordGateState } from '@/lib/auth/password-gate-state';
import { useSubscriptionSync } from '@/lib/hooks/useSubscriptionSync';
import { hasStoredAppSetting, settingsStore } from '@/lib/store/settings-store';

type LoginMode = 'none' | 'legacy_password' | 'managed';

function syncMergeSources(rawValue: string) {
  const enabled = rawValue === 'true' || rawValue === '1';
  if (!enabled) return;

  const settings = settingsStore.getSettings();
  if (settings.searchDisplayMode !== 'grouped') {
    settingsStore.saveSettings({
      ...settings,
      searchDisplayMode: 'grouped',
    });
  }
}

function syncDanmakuApiUrl(rawValue: string) {
  if (!rawValue || hasStoredAppSetting('danmakuApiUrl')) return;

  const settings = settingsStore.getSettings();
  if (settings.danmakuApiUrl !== rawValue) {
    settingsStore.saveSettings({
      ...settings,
      danmakuApiUrl: rawValue,
    });
  }
}

function applyRuntimeConfig(data: {
  subscriptionSources?: string;
  mergeSources?: string;
  danmakuApiUrl?: string;
}) {
  if (data.subscriptionSources) {
    settingsStore.syncEnvSubscriptions(data.subscriptionSources);
  }

  if (data.mergeSources) {
    syncMergeSources(data.mergeSources);
  }

  if (data.danmakuApiUrl) {
    syncDanmakuApiUrl(data.danmakuApiUrl);
  }
}

function toAuthSession(session: {
  accountId: string;
  profileId: string;
  username?: string;
  name: string;
  role: AuthSession['role'];
  customPermissions?: AuthSession['customPermissions'];
  mode?: AuthSession['mode'];
}): AuthSession {
  return {
    accountId: session.accountId,
    profileId: session.profileId,
    username: session.username,
    name: session.name,
    role: session.role,
    customPermissions: session.customPermissions,
    mode: session.mode,
  };
}

export function PasswordGate({
  children,
  hasAuth: initialHasAuth,
}: {
  children: React.ReactNode;
  hasAuth: boolean;
}) {
  useSubscriptionSync();

  const formRef = useRef<HTMLFormElement>(null);
  const [isLocked, setIsLocked] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [persistSession, setPersistSession] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>('none');

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const mirroredSession = getSession();

      try {
        const [configRes, sessionRes] = await Promise.all([
          fetch('/api/auth'),
          fetch('/api/auth/session'),
        ]);

        if (!configRes.ok) {
          throw new Error('Failed to fetch auth config');
        }

        const config = await configRes.json();
        const sessionStatus = sessionRes.ok
          ? await sessionRes.json()
          : { authenticated: false, session: null };

        if (!mounted) return;

        setPersistSession(config.persistSession);
        setLoginMode(config.loginMode || 'none');
        applyRuntimeConfig(config);

        const serverSession =
          sessionStatus.authenticated && sessionStatus.session
            ? toAuthSession(sessionStatus.session)
            : null;
        const gateState = resolvePasswordGateState({
          hasAuth: !!config.hasAuth,
          serverSession,
          mirroredSession,
          persistSession: config.persistSession,
        });

        if (gateState.action === 'unlock-session') {
          setSession(gateState.session, gateState.persistSession);
          setIsLocked(false);
          setIsClient(true);
          return;
        }

        if (gateState.action === 'unlock-public') {
          setIsLocked(false);
          setIsClient(true);
          return;
        }

        if (gateState.clearMirroredSession) {
          clearSession();
        }

        setIsLocked(true);
        setIsClient(true);
      } catch {
        if (!mounted) return;
        setIsLocked(initialHasAuth && !mirroredSession);
        setIsClient(true);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [initialHasAuth]);

  const triggerShake = () => {
    const form = formRef.current;
    if (!form) return;
    form.classList.remove('kv-gate-shake');
    void form.offsetWidth;
    form.classList.add('kv-gate-shake');
  };

  const handleUnlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsValidating(true);
    setError('');

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginMode === 'managed' ? username : undefined,
          password,
        }),
      });
      const data = await response.json();

      if (response.status === 503) {
        setError('认证存储暂时不可用，请检查 Upstash Redis 配置');
        setIsValidating(false);
        return;
      }

      if (data.valid && data.session) {
        setSession(toAuthSession(data.session), data.persistSession ?? persistSession);
        setIsLocked(false);
        setIsClient(true);
        setIsValidating(false);
        return;
      }
    } catch {
      // Ignore network errors and show the same message as invalid credentials.
    }

    setError(loginMode === 'managed' ? '用户名或密码错误' : '密码错误');
    setIsValidating(false);
    triggerShake();
  };

  if (!isClient) return null;

  if (!isLocked) {
    return <>{children}</>;
  }

  const showManagedFields = loginMode === 'managed';

  return (
    <div className="kv-gate">
      <div className="kv-gate-inner">
        <h1 className="kv-gate-title">{siteConfig.name}</h1>

        <form
          ref={formRef}
          id="password-form"
          onSubmit={handleUnlock}
          onAnimationEnd={(event) => {
            if (event.animationName === 'kv-gate-shake') {
              event.currentTarget.classList.remove('kv-gate-shake');
            }
          }}
          className="kv-gate-form"
        >
          {showManagedFields && (
            <div className="kv-gate-field">
              <label htmlFor="login-username" className="kv-gate-label">
                用户名
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setError('');
                }}
                placeholder="输入用户名"
                className="kv-gate-input"
                autoComplete="username"
                autoFocus
                data-focusable
              />
            </div>
          )}

          <div className="kv-gate-field">
            <label htmlFor="login-password" className="kv-gate-label">
              密码
            </label>
            <div className="kv-gate-input-wrap">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError('');
                }}
                placeholder="输入密码"
                className={`kv-gate-input kv-gate-input--with-toggle${
                  error ? ' kv-gate-input--error' : ''
                }`}
                autoFocus={!showManagedFields}
                autoComplete={showManagedFields ? 'current-password' : 'off'}
                data-focusable
              />
              <button
                type="button"
                className="kv-gate-eye"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-3.17 4.49" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isValidating}
            className="kv-gate-submit"
            data-focusable
          >
            {isValidating ? '登录中…' : '登录'}
          </button>
        </form>

        <div className="kv-gate-error-slot">
          {error && (
            <p className="kv-gate-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}