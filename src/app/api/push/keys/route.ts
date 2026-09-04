import { NextResponse } from 'next/server';
import { getVapidConfig } from '@/lib/pushServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = await getVapidConfig();
  if (!config?.publicKey) {
    return NextResponse.json({ success: false, error: 'Web Push no configurado' }, { status: 503 });
  }
  return NextResponse.json({ success: true, publicKey: config.publicKey });
}
