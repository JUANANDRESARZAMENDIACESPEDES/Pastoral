import { getSupabaseClient } from './supabase';

export const STORE_TABLE = 'pjl_store';

export async function fetchStoreValue<T>(key: string): Promise<T | null> {
  const supabase = getSupabaseClient();
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
  const supabase = getSupabaseClient();
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
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(STORE_TABLE)
    .upsert({ key, value }, { onConflict: 'key' });

  if (error) {
    console.error('Supabase upsertStoreValue error:', error.message);
    return false;
  }

  return true;
}

export function subscribeStoreChanges(onChange: (key: string, value: unknown) => void): () => void {
  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch {
    return () => {};
  }

  const channel = supabase
    .channel('pjl_store_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: STORE_TABLE }, (payload) => {
      const key = payload.new?.key ?? payload.old?.key;
      const value = payload.new?.value ?? payload.old?.value;
      if (key) onChange(key, value);
    });

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
