'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/Button';
import { clearSession, type AuthSession } from '@/lib/store/auth-store';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import { SettingRow } from '@/components/settings/SettingRow';
import './icons';

type LoginMode = 'none' | 'legacy_password' | 'managed';

const ROLE_LABELS: Record<AuthSession['role'], string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  viewer: '观众',
};

function loginModeLabel(mode: LoginMode): string {
  if (mode === 'managed') return '托管账户';
  if (mode === 'legacy_password') return '环境变量密码';
  return '未启用';
}

async function logoutAndReload() {
  try {
    await fetch('/api/auth/session', { method: 'DELETE' });
  } catch {
    // Best-effort logout: don't block the client-side session clear.
  }

  clearSession();
  window.location.reload();
}

export function SettingsCurrentAccount() {
  const session = useAuthSession();
  const [loginMode, setLoginMode] = useState<LoginMode>('none');

  useEffect(() => {
    fetch('/api/auth')
      .then((response) => response.json())
      .then((data) => setLoginMode(data.loginMode || 'none'))
      .catch(() => setLoginMode('none'));
  }, []);

  if (!session) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <h2 className="border-b border-(--sv2-border) pb-3 text-[18px] font-semibold text-(--text-color)">
          个人账户
        </h2>

        <div className="mt-4 flex items-start gap-3 rounded-(--radius-2xl) border border-(--glass-border) bg-(--sv2-surface-2) p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-(--text-color-secondary)">
            <Icon icon="lucide:user" width={20} />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] leading-5 font-medium text-(--text-color)">未启用账户登录</p>
            <p className="mt-1 text-[12px] leading-4 text-(--text-color-secondary)">
              当前部署使用本地模式，设置与观看数据保存在此浏览器中。
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h2 className="border-b border-(--sv2-border) pb-3 text-[18px] font-semibold text-(--text-color)">
        个人账户
      </h2>

      {/* 当前登录身份 */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--sv2-accent-soft) text-[14px] font-semibold text-(--accent-color)">
            {session.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] leading-5 font-medium text-(--text-color)">{session.name}</p>
            <p className="mt-0.5 text-[12px] leading-4 text-(--text-color-secondary)">
              {ROLE_LABELS[session.role]}
              {session.username ? ` · @${session.username}` : ''}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="normal"
          color="danger"
          onClick={logoutAndReload}
          className="shrink-0 gap-1.5">
          <Icon icon="lucide:log-out" width={16} />
          退出登录
        </Button>
      </div>

      {/* 账户详情：左字段名，右值 */}
      <dl className="mt-4">
        <SettingRow title="账户名">
          <dd className="min-w-0 truncate text-[12px] leading-4 text-(--text-color-secondary)">{session.name}</dd>
        </SettingRow>
        <SettingRow title="用户名">
          <dd className="min-w-0 truncate text-[12px] leading-4 text-(--text-color-secondary)">
            {session.username ? `@${session.username}` : '—'}
          </dd>
        </SettingRow>
        <SettingRow title="角色">
          <dd className="min-w-0 truncate text-[12px] leading-4 text-(--text-color-secondary)">
            {ROLE_LABELS[session.role]}
          </dd>
        </SettingRow>
        <SettingRow title="登录模式">
          <dd className="min-w-0 truncate text-[12px] leading-4 text-(--text-color-secondary)">
            {loginModeLabel(loginMode)}
          </dd>
        </SettingRow>
      </dl>
    </div>
  );
}
