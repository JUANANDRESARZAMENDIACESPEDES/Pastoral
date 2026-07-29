import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeGoogleCalendarCode,
  fetchGoogleCalendarUserInfo,
  getGoogleCalendarCallbackUrl,
} from '@/lib/googleCalendar';
import { resolveGoogleCalendarCredentials } from '@/lib/googleCalendarServer';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  const redirectTo = new URL('/admin?mod=actividades', request.nextUrl.origin);

  if (error) {
    redirectTo.searchParams.set('gcal', 'error');
    redirectTo.searchParams.set('gcal_message', errorDescription || error);
    return NextResponse.redirect(redirectTo);
  }

  if (!code || !state) {
    redirectTo.searchParams.set('gcal', 'error');
    redirectTo.searchParams.set('gcal_message', 'La autorización de Google Calendar no devolvió un código válido.');
    return NextResponse.redirect(redirectTo);
  }

  const stateCookie = request.cookies.get('pjl_google_calendar_state')?.value || '';
  const redirectUri = request.cookies.get('pjl_google_calendar_redirect')?.value || getGoogleCalendarCallbackUrl(request.nextUrl.origin);
  if (!stateCookie || stateCookie !== state) {
    redirectTo.searchParams.set('gcal', 'error');
    redirectTo.searchParams.set('gcal_message', 'No se pudo validar la solicitud de Google Calendar.');
    return NextResponse.redirect(redirectTo);
  }

  const credentials = await resolveGoogleCalendarCredentials();
  const clientId = credentials?.clientId;
  const clientSecret = credentials?.clientSecret;
  if (!clientId || !clientSecret) {
    redirectTo.searchParams.set('gcal', 'error');
    redirectTo.searchParams.set('gcal_message', 'Faltan configurar Google Client ID y Google Client Secret en el panel de Configuración.');
    return NextResponse.redirect(redirectTo);
  }

  try {
    const tokens = await exchangeGoogleCalendarCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });

    if (!tokens.refresh_token) {
      throw new Error('Google no devolvió un refresh token. Debes autorizar con acceso sin conexión.');
    }

    const userInfo = tokens.access_token ? await fetchGoogleCalendarUserInfo(tokens.access_token).catch(() => null) : null;
    redirectTo.searchParams.set('gcal', 'connected');
    if (userInfo?.email) redirectTo.searchParams.set('gcal_account', userInfo.email);

    const response = NextResponse.redirect(redirectTo);
    response.cookies.set('pjl_google_calendar_refresh_token', tokens.refresh_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: 60 * 60 * 24 * 180,
    });
    response.cookies.set('pjl_google_calendar_account', userInfo?.email || '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: 60 * 60 * 24 * 180,
    });
    response.cookies.delete('pjl_google_calendar_state');
    response.cookies.delete('pjl_google_calendar_redirect');
    response.cookies.set('pjl_google_calendar_connected', 'true', {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: 60 * 60 * 24 * 180,
    });
    return response;
  } catch (err) {
    redirectTo.searchParams.set('gcal', 'error');
    redirectTo.searchParams.set('gcal_message', err instanceof Error ? err.message : 'No se pudo conectar Google Calendar.');
    return NextResponse.redirect(redirectTo);
  }
}
