// api/google-native-signin.ts
// Handles native Google Sign-In for Android/iOS Capacitor apps.
// Receives a Google ID token from the native SDK, verifies it,
// finds or creates the corresponding Clerk user, and returns a
// one-time sign-in ticket that the frontend uses to create a Clerk session.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient } from '@clerk/backend';

// Inline logger to avoid module resolution issues in Vercel serverless
const isDev = process.env.NODE_ENV !== 'production';
const logger = {
  log: (...args: unknown[]) => isDev && console.log(...args),
  error: (...args: unknown[]) => console.error(...args),
};

// Initialize Clerk backend client
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

// CORS: Only allow helpyfam.com, localhost, and Vercel previews
const ALLOWED_ORIGINS = ['https://app.helpyfam.com', 'https://www.helpyfam.com'];

function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string | undefined;
  if (
    origin &&
    (ALLOWED_ORIGINS.includes(origin) ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('https://localhost') ||
      origin.endsWith('.vercel.app'))
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

/**
 * Verify a Google ID token using Google's tokeninfo endpoint.
 * Returns the decoded token payload or null on failure.
 */
async function verifyGoogleIdToken(idToken: string) {
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!response.ok) {
      logger.error('[google-native-signin] Google tokeninfo returned', response.status);
      return null;
    }
    const payload = await response.json();
    // Ensure the token contains an email
    if (!payload.email) {
      logger.error('[google-native-signin] Token payload missing email');
      return null;
    }
    return payload as {
      email: string;
      email_verified: string;
      name?: string;
      picture?: string;
      given_name?: string;
      family_name?: string;
      sub: string; // Google user ID
    };
  } catch (err) {
    logger.error('[google-native-signin] Token verification error:', err);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { idToken } = req.body || {};
  if (!idToken || typeof idToken !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid idToken' });
  }

  // ── Step 1: Verify the Google ID token ──
  const googleUser = await verifyGoogleIdToken(idToken);
  if (!googleUser) {
    return res.status(401).json({ error: 'Invalid Google ID token' });
  }

  logger.log('[google-native-signin] Verified Google user:', {
    email: googleUser.email,
    sub: googleUser.sub,
    name: googleUser.name,
  });

  try {
    // ── Step 2: Find or create the Clerk user ──
    let clerkUserId: string | null = null;

    // First, search for existing user by email
    const existingUsers = await clerkClient.users.getUserList({
      emailAddress: [googleUser.email],
      limit: 1,
    });

    if (existingUsers.data.length > 0) {
      clerkUserId = existingUsers.data[0].id;
      logger.log('[google-native-signin] Found existing Clerk user:', clerkUserId);
    } else {
      // Create a new Clerk user
      const newUser = await clerkClient.users.createUser({
        emailAddress: [googleUser.email],
        firstName: googleUser.given_name || googleUser.name?.split(' ')[0] || '',
        lastName: googleUser.family_name || '',
        skipPasswordRequirement: true,
      });
      clerkUserId = newUser.id;
      logger.log('[google-native-signin] Created new Clerk user:', clerkUserId);
    }

    // ── Step 3: Create a sign-in token (one-time ticket) ──
    const signInToken = await clerkClient.signInTokens.createSignInToken({
      userId: clerkUserId,
      expiresInSeconds: 300, // 5-minute expiry
    });

    logger.log('[google-native-signin] Created sign-in token for user:', clerkUserId);

    return res.status(200).json({ ticket: signInToken.token });
  } catch (err: any) {
    logger.error('[google-native-signin] Clerk error:', err?.message || err);
    return res.status(500).json({
      error: 'Failed to process sign-in',
      details: isDev ? err?.message : undefined,
    });
  }
}
