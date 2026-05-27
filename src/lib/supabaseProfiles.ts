import { supabase } from './supabase';
import type { User } from './pjlStore';

const PROFILE_TABLE = 'user_profiles';

export interface SupabaseProfile {
  id: string;
  auth_uid: string;
  name: string;
  email: string;
  role: 'desarrollador' | 'editor' | 'viewer';
  status: 'pendiente' | 'activo' | 'inactivo';
  permissions?: string[];
  created_at?: string;
}

export async function signUpProfile(name: string, email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, role: 'viewer', status: 'pendiente' }
    }
  });

  if (error) {
    return { error };
  }

  const authUid = data.user?.id;
  if (!authUid) {
    return { error: new Error('No se obtuvo el UID de Supabase al registrar al usuario.') };
  }

  const { error: profileError } = await supabase.from(PROFILE_TABLE).insert({
    auth_uid: authUid,
    email,
    name,
    role: 'viewer',
    status: 'pendiente',
    permissions: ['dashboard'],
  });

  return { error: profileError };
}

export async function signInProfile(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function fetchProfileByEmail(email: string): Promise<SupabaseProfile | null> {
  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .select('*')
    .eq('email', email)
    .single();

  if (error) {
    console.error('Supabase fetchProfileByEmail error:', error.message);
    return null;
  }

  return data as SupabaseProfile;
}

export async function fetchPendingProfiles(): Promise<SupabaseProfile[]> {
  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .select('*')
    .eq('status', 'pendiente')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Supabase fetchPendingProfiles error:', error.message);
    return [];
  }

  return data as SupabaseProfile[];
}

export async function approveProfile(profileId: string): Promise<boolean> {
  const { error } = await supabase
    .from(PROFILE_TABLE)
    .update({ status: 'activo' })
    .eq('id', profileId);

  if (error) {
    console.error('Supabase approveProfile error:', error.message);
    return false;
  }

  return true;
}

export async function updateAuthUser(email?: string, password?: string) {
  return supabase.auth.updateUser({ email, password });
}

export async function fetchAllProfiles(): Promise<SupabaseProfile[]> {
  const { data, error } = await supabase.from(PROFILE_TABLE).select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Supabase fetchAllProfiles error:', error.message);
    return [];
  }
  return data as SupabaseProfile[];
}

export async function updateProfile(profileId: string, updates: Partial<SupabaseProfile>) {
  const { error } = await supabase.from(PROFILE_TABLE).update(updates).eq('id', profileId);
  if (error) {
    console.error('Supabase updateProfile error:', error.message);
    return false;
  }
  return true;
}
