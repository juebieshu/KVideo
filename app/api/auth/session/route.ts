import { NextRequest } from 'next/server';
import {
  createSessionStatusResponse,
  logoutResponse,
  ManagedAuthStorageError,
} from '@/lib/server/auth';

// dev:test 提交前恢复为：export const runtime = 'edge';（账户体系在本地 dev 下需要跨接口共享进程内状态）
// 因此这里使用 Node runtime；Upstash REST 与 crypto.subtle 在 Node 下同样可用。
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    return await createSessionStatusResponse(request);
  } catch (error) {
    if (error instanceof ManagedAuthStorageError) {
      return Response.json(
        { authenticated: false, error: 'Managed authentication storage is unavailable' },
        { status: 503 },
      );
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest) {
  return logoutResponse(request);
}
