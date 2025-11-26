
import type { User } from "../types";
import { UserRole } from "../types"


const DEFAULT_ROLE: UserRole = UserRole.MASTER; // or "Spouse"/whatever makes sense

export async function getUser(
  householdId: string,
  clerkUserId: string
): Promise<User | null> {
  return {
    id: clerkUserId,
    email: "placeholder@example.com",
    householdId,
    name: "Invited User",
    role: DEFAULT_ROLE,
  };
}

export async function completeInviteRegistration(
  householdId: string,
  clerkUserId: string,
  role: UserRole = DEFAULT_ROLE // optional param if you want to set role on accept
): Promise<User> {
  return {
    id: clerkUserId,
    email: "placeholder@example.com",
    householdId,
    name: "Member",
    role, // ✅ include role
  };
}

