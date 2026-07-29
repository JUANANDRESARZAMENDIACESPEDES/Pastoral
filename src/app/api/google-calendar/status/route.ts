import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const connected = !!request.cookies.get('pjl_google_calendar_refresh_token')?.value;
  const account = request.cookies.get('pjl_google_calendar_account')?.value || '';

  return NextResponse.json({
    ok: true,
    connected,
    account,
  });
}
