export type GoogleCalendarMode = 'MONTH' | 'WEEK' | 'AGENDA';

export interface GoogleCalendarOptions {
  showTitle: boolean;
  showNav: boolean;
  showPrint: boolean;
  showTabs: boolean;
  showCalendars: boolean;
  showTz: boolean;
  mode: GoogleCalendarMode;
}

export const DEFAULT_GOOGLE_CALENDAR_OPTIONS: GoogleCalendarOptions = {
  showTitle: false,
  showNav: true,
  showPrint: false,
  showTabs: false,
  showCalendars: false,
  showTz: false,
  mode: 'MONTH',
};

const GOOGLE_EMBED_BASE = 'https://calendar.google.com/calendar/embed';
const GOOGLE_CALENDAR_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_CALENDAR_TOKEN_BASE = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_USERINFO_BASE = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

export const GOOGLE_CALENDAR_EVENT_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
export const GOOGLE_CALENDAR_OAUTH_SCOPES = ['openid', 'email', 'profile', GOOGLE_CALENDAR_EVENT_SCOPE];

export interface GoogleCalendarEventInput {
  title: string;
  date: string;
  description?: string;
  category?: string;
}

export interface GoogleCalendarTokenSet {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
}

export interface GoogleCalendarUserInfo {
  email?: string;
  name?: string;
  picture?: string;
  sub?: string;
}

export const getGoogleCalendarAuthUrl = (params: {
  clientId: string;
  redirectUri: string;
  state: string;
  prompt?: string;
}) => {
  const searchParams = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: GOOGLE_CALENDAR_OAUTH_SCOPES.join(' '),
    access_type: 'offline',
    prompt: params.prompt || 'consent',
    include_granted_scopes: 'true',
    state: params.state,
  });

  return `${GOOGLE_CALENDAR_AUTH_BASE}?${searchParams.toString()}`;
};

export const getGoogleCalendarCallbackUrl = (baseUrl: string) => {
  return new URL('/api/google-calendar/callback', baseUrl).toString();
};

export const buildGoogleCalendarEventResource = (input: GoogleCalendarEventInput) => {
  const title = input.title.trim();
  const date = input.date.trim();
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const [year, month, day] = date.split('-').map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day));
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const endDate = nextDay.toISOString().slice(0, 10);

  const details = [
    input.category?.trim() ? `Categoría: ${input.category.trim()}` : '',
    input.description?.trim() || '',
  ].filter(Boolean).join('\n\n');

  return {
    summary: title,
    description: details,
    start: { date },
    end: { date: endDate },
  };
};

export const exchangeGoogleCalendarCode = async (params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) => {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(GOOGLE_CALENDAR_TOKEN_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = (await response.json().catch(() => ({}))) as GoogleCalendarTokenSet & { error?: string; error_description?: string };
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'No se pudo completar la autorización de Google Calendar.');
  }

  return data;
};

export const refreshGoogleCalendarAccessToken = async (params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}) => {
  const body = new URLSearchParams({
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: 'refresh_token',
  });

  const response = await fetch(GOOGLE_CALENDAR_TOKEN_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = (await response.json().catch(() => ({}))) as GoogleCalendarTokenSet & { error?: string; error_description?: string };
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'No se pudo renovar el acceso a Google Calendar.');
  }

  return data.access_token;
};

export const fetchGoogleCalendarUserInfo = async (accessToken: string) => {
  const response = await fetch(GOOGLE_CALENDAR_USERINFO_BASE, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = (await response.json().catch(() => ({}))) as GoogleCalendarUserInfo & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo obtener la información de la cuenta de Google.');
  }

  return data;
};

export const insertGoogleCalendarEvent = async (params: {
  accessToken: string;
  event: ReturnType<typeof buildGoogleCalendarEventResource>;
}) => {
  if (!params.event) return null;

  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events?sendUpdates=none`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params.event),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || data?.error_description || 'No se pudo crear el evento en Google Calendar.';
    throw new Error(message);
  }

  return data as { id?: string; htmlLink?: string };
};

export const updateGoogleCalendarEvent = async (params: {
  accessToken: string;
  eventId: string;
  event: ReturnType<typeof buildGoogleCalendarEventResource>;
}) => {
  if (!params.event) return null;

  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events/${encodeURIComponent(params.eventId)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params.event),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || data?.error_description || 'No se pudo actualizar el evento en Google Calendar.';
    throw new Error(message);
  }

  return data as { id?: string; htmlLink?: string };
};

export const deleteGoogleCalendarEvent = async (params: {
  accessToken: string;
  eventId: string;
}) => {
  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events/${encodeURIComponent(params.eventId)}?sendUpdates=none`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = data?.error?.message || data?.error_description || 'No se pudo borrar el evento en Google Calendar.';
    throw new Error(message);
  }

  return true;
};

export const normalizeGoogleCalendarSource = (value: string): string => {
  const raw = value.trim();
  if (!raw) return '';

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const src = url.searchParams.get('src') || url.searchParams.get('cid');
      if (src) return decodeURIComponent(src);

      const icalMatch = url.pathname.match(/\/calendar\/ical\/([^/]+)\//i);
      if (icalMatch?.[1]) return decodeURIComponent(icalMatch[1]);
    } catch {
      return raw;
    }
  }

  return raw;
};

export const buildGoogleCalendarEmbedUrl = (
  value: string,
  options: Partial<GoogleCalendarOptions> = {},
  timezone = 'America/Asuncion'
) => {
  const source = normalizeGoogleCalendarSource(value);
  if (!source) return '';

  const settings = { ...DEFAULT_GOOGLE_CALENDAR_OPTIONS, ...options };
  const params = [
    `src=${encodeURIComponent(source)}`,
    `ctz=${encodeURIComponent(timezone)}`,
    `showTitle=${settings.showTitle ? '1' : '0'}`,
    `showNav=${settings.showNav ? '1' : '0'}`,
    `showPrint=${settings.showPrint ? '1' : '0'}`,
    `showTabs=${settings.showTabs ? '1' : '0'}`,
    `showCalendars=${settings.showCalendars ? '1' : '0'}`,
    `showTz=${settings.showTz ? '1' : '0'}`,
    `mode=${encodeURIComponent(settings.mode)}`,
  ];

  return `${GOOGLE_EMBED_BASE}?${params.join('&')}`;
};

export const buildGoogleCalendarCreateUrl = (
  title: string,
  date: string,
  details = '',
  location = '',
  timezone = 'America/Asuncion'
) => {
  if (!title.trim() || !date.trim()) return '';

  const cleanDate = date.replace(/-/g, '');
  if (!/^\d{8}$/.test(cleanDate)) return '';

  const nextDay = new Date(`${date}T00:00:00`);
  nextDay.setDate(nextDay.getDate() + 1);
  const endDate = nextDay.toISOString().slice(0, 10).replace(/-/g, '');

  const params = [
    `action=TEMPLATE`,
    `text=${encodeURIComponent(title.trim())}`,
    `dates=${encodeURIComponent(`${cleanDate}/${endDate}`)}`,
    `details=${encodeURIComponent(details.trim())}`,
    `location=${encodeURIComponent(location.trim())}`,
    `ctz=${encodeURIComponent(timezone)}`,
  ];

  return `https://calendar.google.com/calendar/render?${params.join('&')}`;
};
