import { NextResponse } from 'next/server';
import { removeSubscription } from '@/lib/pushServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (!endpoint || typeof endpoint !== 'string') {
    return NextResponse.json({ success: false, error: 'Falta endpoint' }, { status: 400 });
  }
  await removeSubscription(endpoint);
  return NextResponse.json({ success: true });
}
