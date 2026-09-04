import { NextResponse } from 'next/server';
import { setAdminToken } from '@/lib/pushServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Guard provisorio: el panel manda un "secret" derivado del usuario logueado
// (email|rol). No es infalible, pero evita que cualquiera envíe avisos.
function acceptableSecret(secret?: string): boolean {
  if (!secret || typeof secret !== 'string') return false;
  return /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\|(superadmin|desarrollador|admin|editor)/i.test(secret);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = body?.token;
  if (!token || typeof token !== 'string' || !acceptableSecret(body?.secret)) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
  }
  const ok = await setAdminToken(token);
  if (!ok) {
    return NextResponse.json({ success: false, error: 'No se pudo guardar el token' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
