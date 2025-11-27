// services/inviteService.ts
// Frontend service for calling invite API endpoints
// NO email required - uses shareable link approach

import type { User } from '../types';

/**
 * Create an invitation for a new household member
 * Returns a shareable link - NO email sent
 */
export async function createInvite(params: {
  name: string;
  role: string;
  householdId: string;
  inviterId: string;
}): Promise<{ user: User; inviteLink: string }> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  
  const response = await fetch(`${baseUrl}/api/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorMessage = await extractErrorMessage(response, 'Failed to create invite');
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Resend/regenerate an invitation link
 * Extends expiration and returns new link
 */
export async function resendInvite(
  userId: string,
  householdId: string
): Promise<{ inviteLink: string }> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  
  const response = await fetch(`${baseUrl}/api/invite/resend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, householdId }),
  });

  if (!response.ok) {
    const errorMessage = await extractErrorMessage(response, 'Failed to resend invite');
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Safely extract error message from response
 */
async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    return data.error || data.message || fallback;
  } catch {
    return `${fallback} (HTTP ${response.status})`;
  }
}