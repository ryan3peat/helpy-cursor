// services/userService.ts
import { supabase } from './supabase';
import type { User } from "../types";

/**
 * Fetch invited user details from Supabase
 */
export async function getUser(
  householdId: string,
  userId: string
): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .eq('household_id', householdId)
    .maybeSingle();

  if (error || !data) {
    console.error('getUser error:', error);
    return null;
  }

  // Convert snake_case to camelCase
  return {
    id: data.id,
    email: data.email,
    householdId: data.household_id,
    name: data.name,
    role: data.role,
    status: data.status,
    avatar: data.avatar,
    allergies: data.allergies || [],
    preferences: data.preferences || [],
    expiresAt: data.invite_expires_at
  };
}

/**
 * Complete invite registration by linking Clerk ID and activating user
 */
export async function completeInviteRegistration(
  householdId: string,
  userId: string,
  clerkId: string
): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update({ 
      status: 'active',
      clerk_id: clerkId,
      invite_expires_at: null
    })
    .eq('id', userId)
    .eq('household_id', householdId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to activate user');
  }

  return {
    id: data.clerk_id || data.id,
    email: data.email,
    householdId: data.household_id,
    name: data.name,
    role: data.role,
    status: 'active',
    avatar: data.avatar,
    allergies: data.allergies || [],
    preferences: data.preferences || [],
    expiresAt: null
  };
}