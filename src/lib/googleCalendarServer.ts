import { createClient } from '@supabase/supabase-js';
import { getSupabaseRouteConfig } from './supabaseRoute';
import { GOOGLE_CALENDAR_EVENT_SCOPE } from './googleCalendar';

type GoogleCalendarAdminConfig = {
  googleCalendarClientId?: string;
  googleCalendarClientSecret?: string;
};

export interface ResolvedGoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
}

const readContentConfig = async (): Promise<GoogleCalendarAdminConfig | null> => {
  const config = getSupabaseRouteConfig();
  if (!config) return null;

  const supabase = createClient(config.url, config.key);
  const { data, error } = await supabase
    .from('pjl_store')
    .select('value')
    .eq('key', 'content')
    .maybeSingle();

  if (error || !data?.value) return null;
  return data.value as GoogleCalendarAdminConfig;
};

export const resolveGoogleCalendarCredentials = async (): Promise<ResolvedGoogleCalendarConfig | null> => {
  const content = await readContentConfig();
  const clientId = content?.googleCalendarClientId?.trim() || process.env.GOOGLE_CLIENT_ID?.trim() || '';
  const clientSecret = content?.googleCalendarClientSecret?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim() || '';

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
};

export const resolveGoogleCalendarScope = GOOGLE_CALENDAR_EVENT_SCOPE;
