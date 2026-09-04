import { NextResponse } from 'next/server';
import { upsertSubscription, PushSubscriptionRecord } from '@/lib/pushServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const sub = body?.subscription as PushSubscriptionRecord | null;
  if (!sub || !sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ success: false, error: 'Suscripción inválida' }, { status: 400 });
  }
  await upsertSubscription({
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    userAgent: request.headers.get('user-agent') || undefined,
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ success: true });
}
