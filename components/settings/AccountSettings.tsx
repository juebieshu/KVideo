'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { clearSession, getSession, type Permission, type Role } from '@/lib/store/auth-store';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { settingsInputClassName } from '@/components/settings/SettingRow';
import { Icons, MIcon, materialIconMap } from '@/components/ui/Icon';
import { ALL_PERMISSIONS, ROLE_PERMISSIONS } from '@/lib/auth/permissions';

type LoginMode = 'none' | 'legacy_password' | 'managed';

interface AccountInfo {
  id: string;
  username: string;
  name: string;
  role: Role;
  customPermissions: Permission[];
  createdAt: number;
  updatedAt: number;
}

interface EditableAccount {
  id?: string;
  username: string;
  name: string;
  role: Role;
  customPermissions: Permission[];
  password: string;
  isNew?: boolean;
  markedForDeletion?: boolean;
}

interface LegacyConfigEntry {
  password: string;
  name: string;
  role: Role;
  customPermissions: Permission[];
}

const ROLE_OPTIONS = [
  { value: 'viewer' as Role, label: '观众' },
  { value: 'admin' as Role, label: '管理员' },
  { value: 'super_admin' as Role, label: '超级管理员' },
];

const PERMISSION_LABELS: Record<Permission, string> = {
  source_management: '视频源管理',
  account_management: '账户管理',
  danmaku_api: '弹幕 API',
  data_management: '数据管理',
  player_settings: '播放器设置',
  danmaku_appearance: '弹幕外观',
  view_settings: '显示设置',
};

function buildEditableAccounts(accounts: AccountInfo[]): EditableAccount[] {
  return accounts.map((account) => ({
    id: account.id,
    username: account.username,
    name: account.name,
    role: account.role,
    customPermissions: account.customPermissions,
    password: '',
  }));
}

function arraysEqual(left: Permission[], right: Permission[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

async function logoutAndReload() {
  try {
    await fetch('/api/auth/session', { method: 'DELETE' });
  } catch {
    // Best-effort logout: clear the local mirror even if the request fails.
  }

  clearSession();
  window.location.reload();
}

interface AccountSettingsProps {
  showSession?: boolean;
  title?: string;
  description?: string;
}

export function AccountSettings({
  showSession = true,
  title = '账户管理',
  description = '查看当前登录用户，并根据部署模式管理访问账户。',
}: AccountSettingsProps = {}) {
  const [session, setSessionState] = useState<ReturnType<typeof getSession>>(null);
  const [hasAuth, setHasAuth] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>('none');
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [draftAccounts, setDraftAccounts] = useState<EditableAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showLegacyConfig, setShowLegacyConfig] = useState(false);
  const [legacyEntries, setLegacyEntries] = useState<LegacyConfigEntry[]>([]);

  const canManageAccounts = session?.role === 'super_admin';
  const isManagedMode = loginMode === 'managed';

  const fetchAccounts = useCallback(async () => {
    if (!canManageAccounts) return;

    setLoadingAccounts(true);
    setSaveError('');

    try {
      const response = await fetch('/api/auth/accounts');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load accounts');
      }

      const nextAccounts = (data.accounts || []) as AccountInfo[];
      setAccounts(nextAccounts);
      setDraftAccounts(buildEditableAccounts(nextAccounts));
      setIsDirty(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to load accounts');
    } finally {
      setLoadingAccounts(false);
    }
  }, [canManageAccounts]);

  useEffect(() => {
    setSessionState(getSession());

    fetch('/api/auth')
      .then((response) => response.json())
      .then((data) => {
        setHasAuth(!!data.hasAuth);
        setLoginMode(data.loginMode || 'none');
      })
      .catch(() => {
        // Ignore config failures and keep the conservative default.
      });
  }, []);

  useEffect(() => {
    if (!canManageAccounts) return;
    fetchAccounts();
  }, [canManageAccounts, fetchAccounts, loginMode]);

  const currentDraftAccounts = useMemo(
    () => draftAccounts.filter((account) => !account.markedForDeletion),
    [draftAccounts]
  );

  const addDraftAccount = () => {
    setDraftAccounts((current) => [
      ...current,
      {
        username: '',
        name: '',
        role: 'viewer',
        customPermissions: [],
        password: '',
        isNew: true,
      },
    ]);
    setIsDirty(true);
    setSaveSuccess('');
  };

  const updateDraftAccount = (index: number, patch: Partial<EditableAccount>) => {
    setDraftAccounts((current) => current.map((account, accountIndex) => {
      if (accountIndex !== index) return account;
      return {
        ...account,
        ...patch,
      };
    }));
    setIsDirty(true);
    setSaveSuccess('');
  };

  const toggleDraftPermission = (index: number, permission: Permission) => {
    setDraftAccounts((current) => current.map((account, accountIndex) => {
      if (accountIndex !== index) return account;

      const nextPermissions = account.customPermissions.includes(permission)
        ? account.customPermissions.filter((value) => value !== permission)
        : [...account.customPermissions, permission];

      return {
        ...account,
        customPermissions: nextPermissions,
      };
    }));
    setIsDirty(true);
    setSaveSuccess('');
  };

  const removeDraftAccount = (index: number) => {
    setDraftAccounts((current) => current.flatMap((account, accountIndex) => {
      if (accountIndex !== index) return [account];
      if (account.isNew) return [];
      return [{ ...account, markedForDeletion: true }];
    }));
    setIsDirty(true);
    setSaveSuccess('');
  };

  const restoreDrafts = () => {
    setDraftAccounts(buildEditableAccounts(accounts));
    setIsDirty(false);
    setSaveError('');
    setSaveSuccess('');
  };

  const saveManagedAccounts = async () => {
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess('');

    const originalById = new Map(accounts.map((account) => [account.id, account]));

    try {
      for (const draft of draftAccounts) {
        if (draft.markedForDeletion && draft.id) {
          const response = await fetch(`/api/auth/accounts/${draft.id}`, {
            method: 'DELETE',
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || `Failed to delete ${draft.name}`);
          }
        }
      }

      for (const draft of draftAccounts) {
        if (draft.markedForDeletion) continue;

        if (draft.isNew) {
          const response = await fetch('/api/auth/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: draft.username,
              name: draft.name,
              password: draft.password,
              role: draft.role,
              customPermissions: draft.customPermissions,
            }),
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || `Failed to create ${draft.name || draft.username}`);
          }
          continue;
        }

        if (!draft.id) continue;
        const original = originalById.get(draft.id);
        if (!original) continue;

        const patch: Record<string, unknown> = {};
        if (draft.name !== original.name) patch.name = draft.name;
        if (draft.role !== original.role) patch.role = draft.role;
        if (!arraysEqual(draft.customPermissions, original.customPermissions)) {
          patch.customPermissions = draft.customPermissions;
        }
        if (draft.password) patch.password = draft.password;

        if (Object.keys(patch).length === 0) continue;

        const response = await fetch(`/api/auth/accounts/${draft.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `Failed to update ${draft.name}`);
        }
      }

      await fetchAccounts();
      setSaveSuccess('账户修改已保存');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save accounts');
    } finally {
      setIsSaving(false);
    }
  };

  const addLegacyEntry = () => {
    setLegacyEntries((current) => [
      ...current,
      { password: '', name: '', role: 'viewer', customPermissions: [] },
    ]);
  };

  const updateLegacyEntry = (index: number, patch: Partial<LegacyConfigEntry>) => {
    setLegacyEntries((current) => current.map((entry, entryIndex) => {
      if (entryIndex !== index) return entry;
      return {
        ...entry,
        ...patch,
      };
    }));
  };

  const toggleLegacyPermission = (index: number, permission: Permission) => {
    setLegacyEntries((current) => current.map((entry, entryIndex) => {
      if (entryIndex !== index) return entry;
      const nextPermissions = entry.customPermissions.includes(permission)
        ? entry.customPermissions.filter((value) => value !== permission)
        : [...entry.customPermissions, permission];
      return {
        ...entry,
        customPermissions: nextPermissions,
      };
    }));
  };

  const removeLegacyEntry = (index: number) => {
    setLegacyEntries((current) => current.filter((_, entryIndex) => entryIndex !== index));
  };

  const generatedLegacyAccounts = useMemo(() => {
    return legacyEntries
      .filter((entry) => entry.password.trim() && entry.name.trim())
      .map((entry) => {
        let value = `${entry.password.trim()}:${entry.name.trim()}`;
        if (entry.role !== 'viewer' || entry.customPermissions.length > 0) {
          value += `:${entry.role}`;
        }
        if (entry.customPermissions.length > 0) {
          value += `:${entry.customPermissions.join('|')}`;
        }
        return value;
      })
      .join(',');
  }, [legacyEntries]);

  if (!hasAuth && !session) return null;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-4 border-b border-(--sv2-border) pb-3">
        <h2 className="text-[18px] font-semibold text-(--text-color)">{title}</h2>
        <p className="mt-1.5 text-[13px] leading-5 text-(--text-color-secondary)">{description}</p>
      </header>

      <div className="space-y-6">
        {showSession && session && (
          <div className="flex flex-wrap items-center justify-between gap-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--sv2-accent-soft) text-[14px] font-semibold text-(--accent-color)">
                {session.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[14px] leading-5 font-medium text-(--text-color)">{session.name}</p>
                <p className="mt-0.5 text-[12px] leading-4 text-(--text-color-secondary)">
                  {session.role === 'super_admin' ? '超级管理员' : session.role === 'admin' ? '管理员' : '观众'}
                  {session.username ? ` · @${session.username}` : ''}
                  {session.mode ? ` · ${session.mode === 'managed' ? '托管账户模式' : '环境变量模式'}` : ''}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="normal"
              color="danger"
              onClick={logoutAndReload}
              className="shrink-0 gap-1.5">
              <MIcon icon={materialIconMap.LogOut} width={14} height={14} />
              退出登录
            </Button>
          </div>
        )}

        <div className="flex items-start gap-3 py-3">
          <MIcon icon={materialIconMap.Info} width={16} height={16} className="shrink-0 mt-0.5 text-(--text-color-secondary)" />
          <div className="min-w-0">
            <p className="text-[14px] leading-5 font-medium text-(--text-color)">
              当前登录模式：{isManagedMode ? 'Redis 托管账户' : loginMode === 'legacy_password' ? '环境变量密码登录' : '未启用'}
            </p>
            {isManagedMode ? (
              <p className="mt-1 text-[12px] leading-4 text-(--text-color-secondary)">
                托管模式下由超级管理员直接在此页面管理账户，修改会立即写入服务端存储。
              </p>
            ) : (
              <p className="mt-1 text-[12px] leading-4 text-(--text-color-secondary)">
                环境变量模式下可继续使用 <code className="rounded bg-(--glass-bg) px-1 py-0.5 text-[10px]">ADMIN_PASSWORD</code> 与 <code className="rounded bg-(--glass-bg) px-1 py-0.5 text-[10px]">ACCOUNTS</code> 配置访问控制。
              </p>
            )}
          </div>
        </div>

        {isManagedMode ? (
          canManageAccounts ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] leading-5 font-medium text-(--text-color)">账户列表</p>
                  <p className="mt-1 text-[12px] leading-4 text-(--text-color-secondary)">
                    支持新增、改权限、重置密码和删除账户。只有点击保存才会提交修改。
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button type="button" variant="normal" color="neutral" onClick={restoreDrafts} disabled={!isDirty || isSaving}>
                    取消修改
                  </Button>
                  <Button type="button" variant="solid" color="primary" onClick={saveManagedAccounts} disabled={!isDirty || isSaving}>
                    {isSaving ? '保存中...' : '保存修改'}
                  </Button>
                </div>
              </div>

              {saveError && (
                <div className="rounded-(--radius-2xl) border border-[color-mix(in_srgb,var(--sv2-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--sv2-danger)_10%,transparent)] px-3 py-2.5 text-[13px] leading-5 text-(--sv2-danger)">
                  {saveError}
                </div>
              )}

              {saveSuccess && (
                <div className="rounded-(--radius-2xl) border border-[color-mix(in_srgb,var(--kv-color-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--kv-color-success)_10%,transparent)] px-3 py-2.5 text-[13px] leading-5 text-(--kv-color-success)">
                  {saveSuccess}
                </div>
              )}

              {loadingAccounts ? (
                <p className="py-3 text-[13px] leading-5 text-(--text-color-secondary)">正在加载账户...</p>
              ) : (
                <div className="space-y-4">
                  {currentDraftAccounts.map((account, index) => {
                    const extraPermissions = ALL_PERMISSIONS.filter((permission) => !ROLE_PERMISSIONS[account.role].includes(permission));
                    const isCurrentAccount = session?.accountId === account.id;

                    return (
                      <div
                        key={account.id || `new-${index}`}
                        className="rounded-(--radius-2xl) border border-(--glass-border) bg-(--glass-bg) p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[14px] leading-5 font-medium text-(--text-color)">
                              {account.isNew ? '新账户' : account.name || account.username || '未命名账户'}
                            </span>
                            <span className="rounded-(--radius-full) bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] px-2 py-0.5 text-[12px] text-(--accent-color)">
                              {account.role === 'super_admin' ? '超级管理员' : account.role === 'admin' ? '管理员' : '观众'}
                            </span>
                            {isCurrentAccount && (
                              <span className="rounded-(--radius-full) border border-(--glass-border) px-2 py-0.5 text-[12px] text-(--text-color-secondary)">
                                当前账户
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => removeDraftAccount(index)}
                            disabled={isCurrentAccount}
                            className="shrink-0 cursor-pointer p-1 text-(--text-color-secondary) transition-colors hover:text-(--sv2-danger) disabled:opacity-50 disabled:cursor-not-allowed"
                            title={isCurrentAccount ? '不能删除当前登录账户' : '删除账户'}
                          >
                            <Icons.Trash size={14} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <label className="space-y-1">
                            <span className="text-[12px] text-(--text-color-secondary)">用户名</span>
                            <input
                              type="text"
                              value={account.username}
                              disabled={!account.isNew}
                              onChange={(event) => updateDraftAccount(index, { username: event.target.value.toLowerCase() })}
                              className={`w-full ${settingsInputClassName} disabled:opacity-60`}
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[12px] text-(--text-color-secondary)">显示名称</span>
                            <input
                              type="text"
                              value={account.name}
                              onChange={(event) => updateDraftAccount(index, { name: event.target.value })}
                              className={`w-full ${settingsInputClassName}`}
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[12px] text-(--text-color-secondary)">角色</span>
                            <Select
                              className="w-full"
                              value={account.role}
                              options={ROLE_OPTIONS}
                              onChange={(role) => updateDraftAccount(index, { role })}
                              ariaLabel="账户角色"
                              disabled={isCurrentAccount}
                            />
                          </label>
                        </div>

                        <label className="block space-y-1">
                          <span className="text-[12px] text-(--text-color-secondary)">
                            {account.isNew ? '登录密码' : '重置密码（留空表示不修改）'}
                          </span>
                          <input
                            type="password"
                            value={account.password}
                            onChange={(event) => updateDraftAccount(index, { password: event.target.value })}
                            className={`w-full ${settingsInputClassName}`}
                          />
                        </label>

                        {extraPermissions.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[12px] text-(--text-color-secondary)">额外权限</span>
                            <div className="flex flex-wrap gap-2">
                              {extraPermissions.map((permission) => {
                                const checked = account.customPermissions.includes(permission);
                                return (
                                  <label
                                    key={permission}
                                    className="flex cursor-pointer items-center gap-1.5 rounded-(--radius-full) border border-(--glass-border) bg-(--glass-bg) px-2 py-1 text-[12px] text-(--text-color-secondary)"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleDraftPermission(index, permission)}
                                      className="h-3.5 w-3.5 rounded accent-(--accent-color)"
                                    />
                                    {PERMISSION_LABELS[permission]}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <button
                    onClick={addDraftAccount}
                    className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-(--radius-2xl) border border-dashed border-(--glass-border) bg-(--glass-bg) px-3 py-2 text-sm text-(--text-color-secondary) transition-colors hover:border-[color-mix(in_srgb,var(--accent-color)_30%,transparent)] hover:text-(--accent-color)"
                  >
                    <Icons.Plus size={14} />
                    添加账户
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="py-3 text-[13px] leading-5 text-(--text-color-secondary)">
              当前模式已启用托管账户，但只有超级管理员可以查看和修改账户列表。
            </p>
          )
        ) : (
          canManageAccounts && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] leading-5 font-medium text-(--text-color)">环境变量账户配置</p>
                  <p className="mt-1 text-[12px] leading-4 text-(--text-color-secondary)">
                    兼容旧部署模式。新增或修改后，把生成的 <code className="rounded bg-(--glass-bg) px-1 py-0.5 text-[10px]">ACCOUNTS</code> 值同步到部署环境。
                  </p>
                </div>
                <button
                  onClick={() => setShowLegacyConfig((current) => !current)}
                  className="shrink-0 cursor-pointer text-[12px] text-(--accent-color) hover:underline"
                >
                  {showLegacyConfig ? '收起' : '展开'}
                </button>
              </div>

              {accounts.length > 0 && (
                <div className="space-y-2">
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between gap-3 rounded-(--radius-2xl) border border-(--glass-border) bg-(--glass-bg) px-4 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] text-[13px] font-semibold text-(--accent-color)">
                          {account.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <span className="text-[14px] leading-5 text-(--text-color)">{account.name}</span>
                          <p className="text-[12px] text-(--text-color-secondary)">@{account.username}</p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-(--radius-full) border border-(--glass-border) bg-(--glass-bg) px-2 py-0.5 text-[12px] text-(--text-color-secondary)">
                        {account.role === 'super_admin' ? '超级管理员' : account.role === 'admin' ? '管理员' : '观众'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {showLegacyConfig && (
                <div className="space-y-4 rounded-(--radius-2xl) border border-(--glass-border) bg-(--glass-bg) p-4">
                  {legacyEntries.map((entry, index) => {
                    const extraPermissions = ALL_PERMISSIONS.filter((permission) => !ROLE_PERMISSIONS[entry.role].includes(permission));

                    return (
                      <div key={index} className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <input
                              type="text"
                              placeholder="密码"
                              value={entry.password}
                              onChange={(event) => updateLegacyEntry(index, { password: event.target.value })}
                              className={`w-full ${settingsInputClassName}`}
                            />
                            <input
                              type="text"
                              placeholder="名称"
                              value={entry.name}
                              onChange={(event) => updateLegacyEntry(index, { name: event.target.value })}
                              className={`w-full ${settingsInputClassName}`}
                            />
                            <Select
                              className="w-full"
                              value={entry.role}
                              options={ROLE_OPTIONS}
                              onChange={(role) => updateLegacyEntry(index, { role })}
                              ariaLabel="账户角色"
                            />
                          </div>
                          {extraPermissions.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {extraPermissions.map((permission) => (
                                <label
                                  key={permission}
                                  className="flex cursor-pointer items-center gap-1.5 rounded-(--radius-full) border border-(--glass-border) bg-(--glass-bg) px-2 py-1 text-[12px] text-(--text-color-secondary)"
                                >
                                  <input
                                    type="checkbox"
                                    checked={entry.customPermissions.includes(permission)}
                                    onChange={() => toggleLegacyPermission(index, permission)}
                                    className="h-3.5 w-3.5 rounded accent-(--accent-color)"
                                  />
                                  {PERMISSION_LABELS[permission]}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeLegacyEntry(index)}
                          className="mt-1 shrink-0 cursor-pointer p-1.5 text-(--text-color-secondary) transition-colors hover:text-(--sv2-danger)"
                        >
                          <Icons.Trash size={14} />
                        </button>
                      </div>
                    );
                  })}

                  <button
                    onClick={addLegacyEntry}
                    className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-(--radius-2xl) border border-dashed border-(--glass-border) bg-(--glass-bg) px-3 py-2 text-[13px] text-(--text-color-secondary) transition-colors hover:border-[color-mix(in_srgb,var(--accent-color)_30%,transparent)] hover:text-(--accent-color)"
                  >
                    <Icons.Plus size={12} />
                    添加账户
                  </button>

                  {generatedLegacyAccounts && (
                    <div className="space-y-2">
                      <label className="text-[12px] font-medium text-(--text-color)">
                        生成的 ACCOUNTS 值
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <code className="min-w-0 flex-1 select-all break-all rounded-(--radius-2xl) border border-(--glass-border) bg-(--glass-bg) px-3 py-2 text-[12px] text-(--text-color)">
                          {generatedLegacyAccounts}
                        </code>
                        <Button
                          type="button"
                          variant="normal"
                          color="primary"
                          onClick={() => navigator.clipboard.writeText(generatedLegacyAccounts)}
                          className="shrink-0 gap-1"
                        >
                          <Icons.Copy size={12} />
                          复制
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
