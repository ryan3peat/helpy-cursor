
import type { User } from "../types";
import { UserRole } from "../types";

// Default role for invited users if not specified
const DEFAULT_ROLE: UserRole = UserRole.SPOUSE; // or HELPER based on your logic

/**
 * Fetch invited user details from Supabase
 * Validate status and expiration in real implementation
 */
export async function getUser(
  householdId: string,
  userId: string
): Promise<User | null> {
  // TODO: Replace with Supabase query:
  // SELECT * FROM users WHERE householdId = $1 AND id = $2
  return {
    id: userId,
    email: "placeholder@example.com",
    householdId,
    name: "Invited User",
    role: DEFAULT_ROLE,
    status: "pending", // ✅ Added
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // ✅ Added
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
  // TODO: Replace with Supabase update:
  // UPDATE users SET status = 'active', clerkId = $3 WHERE id = $2 AND householdId = $1
  return {
    id: userId,
    email: "placeholder@example.com",
    householdId,
    name: "Member",
    role: DEFAULT_ROLE,
    status: "active", // ✅ Updated
    expiresAt: null // ✅ Invite no longer needed
  };
}
