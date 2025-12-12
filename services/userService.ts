// services/userService.ts
import type { User } from "../types";

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Fetch invited user details using API (bypasses RLS for pending users)
 * This is needed because pending users don't have a clerk_id yet,
 * so RLS policies would block direct database access.
 */
export async function getUser(
  householdId: string,
  userId: string
): Promise<User | null> {
  try {
    // Use API endpoint that bypasses RLS
    const response = await fetch(
      `${API_URL}/api/get-invite-info?hid=${encodeURIComponent(householdId)}&uid=${encodeURIComponent(userId)}`
    );
    
    const result = await response.json();
    
    if (!response.ok || !result.isValid) {
      console.error('getUser API error:', result.error);
      return null;
    }

    // Handle already active user (re-clicking old invite link)
    if (result.alreadyActive) {
      return {
        id: userId,
        email: null,
        householdId: householdId,
        name: result.pendingUserName,
        role: result.pendingUserRole,
        status: 'active', // User is already active
        avatar: null,
        allergies: [],
        preferences: [],
        expiresAt: null
      };
    }

    // Return user data from API response
    // Note: API returns limited data for pending users (no sensitive info)
    return {
      id: userId,
      email: null, // Not returned by API for privacy
      householdId: householdId,
      name: result.pendingUserName,
      role: result.pendingUserRole,
      status: 'pending',
      avatar: null,
      allergies: [],
      preferences: [],
      expiresAt: result.expiresAt
    };
  } catch (error) {
    console.error('getUser fetch error:', error);
    return null;
  }
}

/**
 * Complete invite registration by linking Clerk ID and activating user
 * Uses API endpoint to bypass RLS (pending users don't have clerk_id yet)
 */
export async function completeInviteRegistration(
  householdId: string,
  userId: string,
  clerkId: string
): Promise<User> {
  try {
    const response = await fetch(`${API_URL}/api/accept-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pendingUserId: userId,
        householdId: householdId,
        clerkId: clerkId,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to activate user');
    }

    const data = result.user;
    
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
  } catch (error: any) {
    console.error('completeInviteRegistration error:', error);
    throw new Error(error?.message || 'Failed to activate user');
  }
}