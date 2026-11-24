import { NextRequest, NextResponse } from 'next/server';
import {
  createManagedAccount,
  getPublicAuthConfig,
  getServerSession,
  isSuperAdminSession,
  listAccountInfo,
} from '@/lib/server/auth';

// dev:test 提交前恢复为：export const runtime = 'edge';（账户体系在本地 dev 下需要跨接口共享进程内状态）
// 因此这里使用 Node runtime；Upstash REST 与 crypto.subtle 在 Node 下同样可用。
export const runtime = 'nodejs';

async function requireSuperAdmin(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session) {
    return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  }

  if (!isSuperAdminSession(session)) {
    return { error: NextResponse.json({ error: 'Super admin required' }, { status: 403 }) };
  }

  return { session };
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if ('error' in auth) {
    return auth.error;
  }

  const config = await getPublicAuthConfig();
  const accounts = await listAccountInfo();

  return NextResponse.json({
    loginMode: config.loginMode,
    managed: config.loginMode === 'managed',
    accounts,
    totalCount: accounts.length,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if ('error' in auth) {
    return auth.error;
  }

  const config = await getPublicAuthConfig();
  if (config.loginMode !== 'managed') {
    return NextResponse.json({ error: 'Managed account mode is not enabled' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const account = await createManagedAccount(body);
    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create account' },
      { status: 400 }
    );
  }
}
