import { getSupabaseClient } from './supabase';
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
  const supabase = getSupabaseClient();

  const { data: existingProfile, error: existingError } = await supabase
    .from(PROFILE_TABLE)
    .select('id, status')
    .eq('email', email)
    .maybeSingle();

  if (existingError) {
    console.error('Supabase signUpProfile check error:', existingError.message);
  }
  if (existingProfile) {
    const message = existingProfile.status === 'pendiente'
      ? 'Ya existe una solicitud pendiente para este correo.'
      : 'Este correo ya está registrado.';
    return { error: new Error(message) };
  }

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

type SupabaseProfileChangePayload = {
  new?: SupabaseProfile;
  old?: SupabaseProfile;
  eventType?: string;
};

export function subscribeProfileChanges(
  onChange: (profile: SupabaseProfile, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void
): () => void {
  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch {
    return () => {};
  }

  const channel = (supabase.channel('profile_changes') as any).on(
    'postgres_changes',
    { event: '*', schema: 'public', table: PROFILE_TABLE },
    (payload: SupabaseProfileChangePayload) => {
      const profile = payload.new ?? payload.old;
      if (!profile) return;
      const eventType = (payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE') || (payload.new ? 'INSERT' : 'UPDATE');
      onChange(profile, eventType);
    }
  );

  (channel as any).subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function signInProfile(email: string, password: string) {
  const supabase = getSupabaseClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function fetchProfileByEmail(email: string): Promise<SupabaseProfile | null> {
  const supabase = getSupabaseClient();
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
  const supabase = getSupabaseClient();
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
  const supabase = getSupabaseClient();
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
  const supabase = getSupabaseClient();
  return supabase.auth.updateUser({ email, password });
}

export async function fetchAllProfiles(): Promise<SupabaseProfile[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(PROFILE_TABLE).select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Supabase fetchAllProfiles error:', error.message);
    return [];
  }
  return data as SupabaseProfile[];
}

export async function updateProfile(profileId: string, updates: Partial<SupabaseProfile>) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(PROFILE_TABLE).update(updates).eq('id', profileId);
  if (error) {
    console.error('Supabase updateProfile error:', error.message);
    return false;
  }
  return true;
}
