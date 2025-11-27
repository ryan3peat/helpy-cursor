
import type { User } from '../types';

/**
 * Create an invitation for a new household member
 * Calls the backend API which uses Clerk to send the invite email
 */
export async function createInvite(params: {
  name: string;
  role: string;
  householdId: string;
  inviterId: string;
}): Promise<{ user: User; inviteLink: string }> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL; // ✅ Use env variable for production
  const response = await fetch(`${baseUrl}/api/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    // ✅ Handle non-JSON error responses gracefully
    let errorMessage = 'Failed to create invite';
    try {
      const error = await response.json();
      errorMessage = error.message || error.error || errorMessage;
    } catch {
      const text = await response.text();
      if (text) errorMessage = text;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Resend an invitation that may have expired or wasn't received
 */
export async function resendInvite(
  userId: string,
  householdId: string
): Promise<{ inviteLink: string }> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL; // ✅ Use env variable for production
  const response = await fetch(`${baseUrl}/api/invite/resend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, householdId }),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to resend invite';
    try {
      const error = await response.json();
      errorMessage = error.message || error.error || errorMessage;
    } catch {
      const text = await response.text();
      if (text) errorMessage = text;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}
