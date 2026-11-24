// dev:test 本地调试专用文件，提交前整个文件删除
import type { StoredAccountRecord } from '@/lib/server/auth-helpers';

type DevAccountGlobal = typeof globalThis & {
  __kvideoDevAccounts?: StoredAccountRecord[];
};

/**
 * 本地开发用的内存账户存储。
 *
 * 用途：`next dev` 没有配置 Upstash 时，也能跑通「托管账户」模式，方便调试登录页
 * 和账户管理界面。数据挂在 `globalThis` 上，同一 dev 进程内的各个 route 共享，
 * 进程重启即清空，不落盘。
 *
 * 生产构建里 `NODE_ENV` 会被静态替换成 'production'，此开关恒为 false，
 * 不会影响线上行为。可用 `DEV_AUTH_STORE=off` 在本地临时关闭。
 */
export function isDevAccountStoreEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  return process.env.DEV_AUTH_STORE !== 'off';
}

export function readDevAccounts(): StoredAccountRecord[] {
  const accounts = (globalThis as DevAccountGlobal).__kvideoDevAccounts;
  return accounts ? [...accounts] : [];
}

export function writeDevAccounts(accounts: StoredAccountRecord[]): void {
  (globalThis as DevAccountGlobal).__kvideoDevAccounts = [...accounts];
}
