import { NextRequest, NextResponse } from 'next/server';
import {
  deleteManagedAccount,
  getPublicAuthConfig,
  getServerSession,
  isSuperAdminSession,
  updateManagedAccount,
} from '@/lib/server/auth';

// dev:test 提交前恢复为：export const runtime = 'edge';（账户体系在本地 dev 下需要跨接口共享进程内状态）
// 因此这里使用 Node runtime；Upstash REST 与 crypto.subtle 在 Node 下同样可用。
export const runtime = 'nodejs';

async function requireManagedSuperAdmin(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session) {
    return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  }

  if (!isSuperAdminSession(session)) {
    return { error: NextResponse.json({ error: 'Super admin required' }, { status: 403 }) };
  }

  const config = await getPublicAuthConfig();
  if (config.loginMode !== 'managed') {
    return { error: NextResponse.json({ error: 'Managed account mode is not enabled' }, { status: 400 }) };
  }

  return { session };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ accountId: string }> }
) {
  const auth = await requireManagedSuperAdmin(request);
  if ('error' in auth) {
    return auth.error;
  }

  try {
    const { accountId } = await context.params;
    const body = await request.json();
    const account = await updateManagedAccount(accountId, body);
    return NextResponse.json({ account });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update account' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ accountId: string }> }
) {
  const auth = await requireManagedSuperAdmin(request);
  if ('error' in auth) {
    return auth.error;
  }

  try {
    const { accountId } = await context.params;
    await deleteManagedAccount(accountId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete account' },
      { status: 400 }
    );
  }
}
