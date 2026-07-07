import { createClient } from '@/utils/supabase/client';
import type { UserProfile, UserRole } from '@/types';

// Singleton browser client — safe to use in 'use client' components
export const supabase = createClient();

export async function signUpWithEmail(
  email: string,
  password: string,
  role: UserRole,
  displayName: string,
) {
  // Store role + displayName in user_metadata so we can create the profile
  // after email confirmation when no session exists yet.
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, display_name: displayName },
    },
  });
  if (authError) throw authError;
  if (!authData.user) throw new Error('Sign up failed — please try again.');

  // If Supabase immediately returns a session (email confirmation disabled),
  // insert the profile now. Otherwise it will be created on first sign-in.
  if (authData.session) {
    const { error: profileError } = await supabase.from('user_profiles').upsert({
      id: authData.user.id,
      email,
      role,
      display_name: displayName,
      wallet_address: null,
    });
    if (profileError) {
      console.warn('Profile insert failed:', profileError.message);
    }
  }

  return authData;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  // Ensure a profile row exists. Handles the case where registration
  // succeeded but the profile insert was deferred (email confirmation flow).
  if (data.user) {
    await ensureProfile(data.user.id, data.user.email ?? '', data.user.user_metadata);
  }

  return data;
}

async function ensureProfile(
  userId: string,
  email: string,
  meta: Record<string, unknown> = {},
) {
  const { data: existing } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (!existing) {
    await supabase.from('user_profiles').insert({
      id: userId,
      email,
      role: (meta.role as UserRole) ?? 'business',
      display_name: (meta.display_name as string) ?? null,
      wallet_address: null,
    });
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data as UserProfile;
}

export async function linkWalletAddress(userId: string, walletAddress: string) {
  const { error } = await supabase
    .from('user_profiles')
    .update({ wallet_address: walletAddress })
    .eq('id', userId);
  if (error) throw error;
}
