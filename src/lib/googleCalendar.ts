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
