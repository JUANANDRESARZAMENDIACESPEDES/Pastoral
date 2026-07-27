import { NextResponse } from 'next/server';

export interface SupabaseRouteConfig {
  url: string;
  key: string;
}

export const getSupabaseRouteConfig = (): SupabaseRouteConfig | null => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  return { url, key };
};

export const missingSupabaseConfigResponse = () =>
  NextResponse.json(
    {
      success: false,
      error: 'Missing Supabase configuration',
    },
    { status: 503 }
  );
