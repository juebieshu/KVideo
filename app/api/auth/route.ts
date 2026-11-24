import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateLogin,
  createLoginResponse,
  getPublicAuthConfig,
  ManagedAuthStorageError,
  validatePremiumAccess,
} from '@/lib/server/auth';

// dev:test 提交前恢复为：export const runtime = 'edge';（账户体系在本地 dev 下需要跨接口共享进程内状态）
// 因此这里使用 Node runtime；Upstash REST 与 crypto.subtle 在 Node 下同样可用。
export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(await getPublicAuthConfig());
  } catch (error) {
    if (error instanceof ManagedAuthStorageError) {
      return NextResponse.json(
        { error: 'Managed authentication storage is unavailable' },
        { status: 503 },
      );
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, type } = body || {};

    if (type === 'premium') {
      const valid = await validatePremiumAccess(request, { username, password });
      return NextResponse.json({ valid });
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ valid: false, message: 'Password required' }, { status: 400 });
    }

    const session = await authenticateLogin({ username, password });
    if (!session) {
      return NextResponse.json({ valid: false });
    }

    return createLoginResponse(session, request);
  } catch (error) {
    if (error instanceof ManagedAuthStorageError) {
      return NextResponse.json(
        { valid: false, message: 'Managed authentication storage is unavailable' },
        { status: 503 },
      );
    }
    return NextResponse.json({ valid: false, message: 'Invalid request' }, { status: 400 });
  }
}
