import { NextRequest, NextResponse } from 'next/server';
import { getGoogleCalendarAuthUrl, getGoogleCalendarCallbackUrl } from '@/lib/googleCalendar';
import { resolveGoogleCalendarCredentials } from '@/lib/googleCalendarServer';

export async function GET(request: NextRequest) {
  const credentials = await resolveGoogleCalendarCredentials();
  const clientId = credentials?.clientId;
  if (!clientId) {
    const redirectTo = new URL('/admin?mod=actividades', request.nextUrl.origin);
    redirectTo.searchParams.set('gcal', 'error');
    redirectTo.searchParams.set('gcal_message', 'Falta configurar Google Client ID en el panel de Configuración.');
    return NextResponse.redirect(redirectTo);
  }

  const state = crypto.randomUUID();
  const callbackUrl = getGoogleCalendarCallbackUrl(request.nextUrl.origin);
  const authUrl = getGoogleCalendarAuthUrl({
    clientId,
    redirectUri: callbackUrl,
    state,
    prompt: 'consent',
  });

  const response = NextResponse.redirect(authUrl);
  response.cookies.set('pjl_google_calendar_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 10 * 60,
  });
  response.cookies.set('pjl_google_calendar_redirect', callbackUrl, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 10 * 60,
  });

  return response;
}
