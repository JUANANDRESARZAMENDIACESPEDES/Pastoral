import { supabase } from './supabase';

export const STORE_TABLE = 'pjl_store';

export async function fetchStoreValue<T>(key: string): Promise<T | null> {
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
  const { error } = await supabase
    .from(STORE_TABLE)
    .upsert({ key, value }, { onConflict: 'key' });

  if (error) {
    console.error('Supabase upsertStoreValue error:', error.message);
    return false;
  }

  return true;
}
