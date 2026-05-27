import { getSupabaseClient } from './supabase';

export const STORE_TABLE = 'pjl_store';

export async function fetchStoreValue<T>(key: string): Promise<T | null> {
  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (e) {
    console.warn('fetchStoreValue: Supabase not configured:', (e as Error).message);
    return null;
  }

  const { data, error } = await supabase
    .from(STORE_TABLE)
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    console.error('Supabase fetchStoreValue error:', error.message);
    return null;
  }

  return data?.value ?? null;
}

export async function fetchAllStoreValues<T>(keys: string[]): Promise<Record<string, T>> {
  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (e) {
    console.warn('fetchAllStoreValues: Supabase not configured:', (e as Error).message);
    return {} as Record<string, T>;
  }

  const { data, error } = await supabase
    .from(STORE_TABLE)
    .select('key, value')
    .in('key', keys);

  if (error) {
    console.error('Supabase fetchAllStoreValues error:', error.message);
    return {} as Record<string, T>;
  }

  return (data || []).reduce((acc: Record<string, T>, row: any) => {
    if (row?.key) acc[row.key] = row.value as T;
    return acc;
  }, {});
}

export async function upsertStoreValue(key: string, value: unknown): Promise<boolean> {
  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (e) {
    console.warn('upsertStoreValue: Supabase not configured:', (e as Error).message);
    return false;
  }

  const { error } = await supabase
    .from(STORE_TABLE)
    .upsert({ key, value }, { onConflict: 'key' });

  if (error) {
    console.error('Supabase upsertStoreValue error:', error.message);
    return false;
  }

  return true;
}

type SupabaseStoreChangePayload = {
  new?: { key?: string; value?: unknown };
  old?: { key?: string; value?: unknown };
};

export function subscribeStoreChanges(onChange: (key: string, value: unknown) => void): () => void {
  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (e) {
    console.warn('subscribeStoreChanges: Supabase not configured:', (e as Error).message);
    return () => {};
  }

  const channel = (supabase as any)
    .channel('pjl_store_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: STORE_TABLE },
      (payload: SupabaseStoreChangePayload) => {
        const key = payload.new?.key ?? payload.old?.key;
        const value = payload.new?.value ?? payload.old?.value;
        if (key) onChange(key, value);
      }
    );

  (channel as any).subscribe();

  return () => {
    try { supabase.removeChannel(channel); } catch (e) { /* ignore */ }
  };
}
