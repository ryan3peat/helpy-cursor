// ============================================================================
// BACKUP: Edge Function - send-notification (Working as of Dec 11, 2025)
// 
// This is a backup of the working notification edge function.
// If anything breaks, restore this file to:
//   supabase/functions/send-notification/index.ts
// ============================================================================

// @ts-nocheck
/**
 * Supabase Edge Function: send-notification
 * 
 * This function is triggered by database triggers when items are added.
 * It sends Web Push notifications to all eligible household members.
 * 
 * Uses Deno's native Web Crypto API (web-push npm package doesn't work in Deno)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64url.ts';

interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  user_id: string;
}

interface NotificationPayload {
  table: string;
  record: Record<string, unknown>;
  household_id: string;
  created_by_user_id?: string;
}

// CORS headers for edge function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Build notification message based on the table and record
 */
function buildNotificationMessage(
  table: string,
  record: Record<string, unknown>,
  creatorName: string
): { title: string; body: string; type: string } {
  switch (table) {
    case 'todo_items': {
      const itemType = record.type as string;
      const itemName = record.name as string || 'an item';
      
      if (itemType === 'shopping') {
        return {
          title: 'Shopping List Updated',
          body: `${creatorName} added "${itemName}" to the Shopping List`,
          type: 'shopping'
        };
      } else {
        return {
          title: 'New Task Added',
          body: `${creatorName} added a task: "${itemName}"`,
          type: 'task'
        };
      }
    }
    
    case 'meals': {
      const mealType = record.type as string || 'meal';
      const description = record.description as string || 'a meal';
      return {
        title: 'Meal Plan Updated',
        body: `${creatorName} added ${mealType}: "${description}"`,
        type: 'meal'
      };
    }
    
    case 'expenses': {
      const merchant = record.merchant as string || 'Unknown';
      const amount = record.amount as number || 0;
      return {
        title: 'New Expense Added',
        body: `${creatorName} added an expense: ${merchant} ($${amount.toFixed(2)})`,
        type: 'expense'
      };
    }
    
    default:
      return {
        title: 'Helpy Update',
        body: `${creatorName} added something new`,
        type: 'general'
      };
  }
}

/**
 * Convert base64url string to Uint8Array
 */
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  // Add padding if needed
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Convert Uint8Array to base64url string
 */
function uint8ArrayToBase64Url(uint8Array: Uint8Array): string {
  return base64Encode(uint8Array);
}

/**
 * Generate ECDH key pair for encryption
 */
async function generateECDHKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
}

/**
 * Export public key to raw format
 */
async function exportPublicKeyRaw(key: CryptoKey): Promise<Uint8Array> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(exported);
}

/**
 * Derive shared secret using ECDH
 */
async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKeyBytes: Uint8Array
): Promise<Uint8Array> {
  const publicKey = await crypto.subtle.importKey(
    'raw',
    publicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256
  );
  
  return new Uint8Array(sharedSecret);
}

/**
 * HKDF extract and expand
 */
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    ikm,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );
  
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: info,
    },
    key,
    length * 8
  );
  
  return new Uint8Array(derived);
}


/**
 * Encrypt payload using AES-128-GCM (RFC 8291 - aes128gcm encoding)
 * 
 * For aes128gcm, the entire encrypted message (including headers) goes in the body.
 * Format: salt (16) + rs (4) + idlen (1) + keyid (65) + encrypted_content
 * 
 * Key derivation per RFC 8291:
 * 1. ecdh_secret = ECDH(server_private, client_public)
 * 2. key_info = "WebPush: info" || 0x00 || client_public || server_public
 * 3. IKM = HKDF(auth_secret, ecdh_secret, key_info, 32)
 * 4. CEK = HKDF(salt, IKM, "Content-Encoding: aes128gcm\0", 16)
 * 5. NONCE = HKDF(salt, IKM, "Content-Encoding: nonce\0", 12)
 */
async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authKey: string
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payload);
  
  // Decode subscription keys
  const clientPublicKey = base64UrlToUint8Array(p256dhKey);
  const clientAuthSecret = base64UrlToUint8Array(authKey);
  
  // Generate ephemeral ECDH key pair
  const serverKeyPair = await generateECDHKeyPair();
  const serverPublicKey = await exportPublicKeyRaw(serverKeyPair.publicKey);
  
  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Derive shared secret via ECDH
  const sharedSecret = await deriveSharedSecret(serverKeyPair.privateKey, clientPublicKey);
  
  // RFC 8291: Build key_info = "WebPush: info" || 0x00 || ua_public || as_public
  const keyInfoHeader = encoder.encode('WebPush: info\0');
  const keyInfo = new Uint8Array(keyInfoHeader.length + clientPublicKey.length + serverPublicKey.length);
  keyInfo.set(keyInfoHeader, 0);
  keyInfo.set(clientPublicKey, keyInfoHeader.length);
  keyInfo.set(serverPublicKey, keyInfoHeader.length + clientPublicKey.length);
  
  // RFC 8291: IKM = HKDF(auth_secret, ecdh_secret, key_info, 32)
  const ikm = await hkdf(clientAuthSecret, sharedSecret, keyInfo, 32);
  
  // RFC 8291: CEK = HKDF(salt, IKM, "Content-Encoding: aes128gcm\0", 16)
  const cekInfo = encoder.encode('Content-Encoding: aes128gcm\0');
  const contentEncryptionKey = await hkdf(salt, ikm, cekInfo, 16);

  // RFC 8291: NONCE = HKDF(salt, IKM, "Content-Encoding: nonce\0", 12)
  const nonceInfo = encoder.encode('Content-Encoding: nonce\0');
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  // For aes128gcm, add a delimiter byte (0x02) to mark end of content
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 0x02; // Delimiter byte

  // Encrypt with AES-GCM
  const key = await crypto.subtle.importKey(
    'raw',
    contentEncryptionKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    paddedPayload
  );
  
  const ciphertext = new Uint8Array(encrypted);
  
  // Build the complete aes128gcm body:
  // salt (16) + rs (4) + idlen (1) + keyid (65) + ciphertext
  const recordSize = 4096;
  const rs = new Uint8Array(4);
  rs[0] = (recordSize >> 24) & 0xff;
  rs[1] = (recordSize >> 16) & 0xff;
  rs[2] = (recordSize >> 8) & 0xff;
  rs[3] = recordSize & 0xff;
  
  const idlen = new Uint8Array([serverPublicKey.length]); // 65 for uncompressed P-256
  
  // Combine all parts
  const body = new Uint8Array(
    salt.length + rs.length + idlen.length + serverPublicKey.length + ciphertext.length
  );
  
  let offset = 0;
  body.set(salt, offset); offset += salt.length;
  body.set(rs, offset); offset += rs.length;
  body.set(idlen, offset); offset += idlen.length;
  body.set(serverPublicKey, offset); offset += serverPublicKey.length;
  body.set(ciphertext, offset);
  
  return body;
}

/**
 * Sign JWT for VAPID authentication
 * 
 * IMPORTANT: The VAPID_PRIVATE_KEY must be in PKCS8 format (base64url encoded).
 * Generate keys using the browser script in the docs, NOT web-push CLI.
 */
async function signJwt(
  claims: Record<string, unknown>,
  privateKeyBase64: string
): Promise<string> {
  // Decode private key from base64url (expects PKCS8 format)
  const privateKeyBytes = base64UrlToUint8Array(privateKeyBase64);
  
  console.log(`[Push] Private key length: ${privateKeyBytes.length} bytes`);
  
  // Import as ECDSA key (PKCS8 format)
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  
  // Create JWT header
  const header = { typ: 'JWT', alg: 'ES256' };
  const headerBase64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const claimsBase64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(claims)));
  
  // Sign
  const signatureInput = new TextEncoder().encode(`${headerBase64}.${claimsBase64}`);
  const signatureRaw = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    signatureInput
  );
  
  // Web Crypto returns signature in IEEE P1363 format (r || s, 64 bytes)
  // This is what we need for ES256 JWT
  const signatureBase64 = uint8ArrayToBase64Url(new Uint8Array(signatureRaw));
  
  return `${headerBase64}.${claimsBase64}.${signatureBase64}`;
}

/**
 * Send a Web Push notification using native Deno crypto
 */
async function sendWebPushNotification(
  subscription: PushSubscriptionRecord,
  payload: { title: string; body: string; type: string; referenceId?: string },
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; expired: boolean }> {
  try {
    const endpoint = subscription.endpoint;
    const audience = new URL(endpoint).origin;
    
    // Create VAPID JWT
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      aud: audience,
      exp: now + 12 * 60 * 60, // 12 hours
      sub: vapidSubject
    };
    
    // Try to sign JWT - if this fails, VAPID private key format might be wrong
    let jwt: string;
    try {
      console.log(`[Push] Signing VAPID JWT:`, {
        audience: audience,
        subject: vapidSubject,
        expiresIn: '12 hours',
        hasPrivateKey: !!vapidPrivateKey,
        privateKeyLength: vapidPrivateKey?.length || 0
      });
      jwt = await signJwt(claims, vapidPrivateKey);
      console.log(`[Push] JWT signed successfully (length: ${jwt.length})`);
    } catch (jwtError) {
      console.error('[Push] ❌ Failed to sign VAPID JWT:', {
        error: jwtError instanceof Error ? jwtError.message : String(jwtError),
        stack: jwtError instanceof Error ? jwtError.stack : undefined,
        hasPrivateKey: !!vapidPrivateKey,
        privateKeyLength: vapidPrivateKey?.length || 0
      });
      return { success: false, expired: false };
    }
    
    // Encrypt the payload
    const payloadJson = JSON.stringify(payload);
    console.log(`[Push] Encrypting payload:`, {
      payloadLength: payloadJson.length,
      payloadPreview: payloadJson.substring(0, 100) + '...',
      endpoint: endpoint.substring(0, 50) + '...',
      hasP256dh: !!subscription.p256dh_key,
      hasAuth: !!subscription.auth_key,
      p256dhLength: subscription.p256dh_key?.length || 0,
      authLength: subscription.auth_key?.length || 0
    });
    
    // encryptPayload returns the complete aes128gcm body including headers
    const body = await encryptPayload(
      payloadJson,
      subscription.p256dh_key,
      subscription.auth_key
    );
    
    console.log(`[Push] Encryption complete:`, {
      bodyLength: body.length,
      encoding: 'aes128gcm'
    });
    
    // Build authorization header for VAPID
    const vapidAuth = `vapid t=${jwt}, k=${vapidPublicKey}`;
    
    console.log(`[Push] Sending to push endpoint:`, {
      endpoint: endpoint,
      method: 'POST',
      headers: {
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Urgency': 'normal',
        'Authorization': 'vapid t=... (JWT present)'
      },
      bodyLength: body.length
    });
    
    // Send the push message
    // For aes128gcm, salt and server key are embedded in the body, not in headers
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': vapidAuth,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Urgency': 'normal'
      },
      body: body
    });
    
    // Log response details
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    console.log(`[Push] FCM Response:`, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      endpoint: endpoint.substring(0, 50) + '...'
    });
    
    if (response.status === 201 || response.status === 200) {
      console.log(`[Push] ✅ Successfully sent to ${endpoint.substring(0, 50)}...`);
      const responseBody = await response.text();
      if (responseBody) {
        console.log(`[Push] Response body:`, responseBody);
      }
      return { success: true, expired: false };
    }
    
    if (response.status === 410 || response.status === 404) {
      console.log(`[Push] ⚠️ Subscription expired (${response.status}): ${endpoint.substring(0, 50)}...`);
      const responseBody = await response.text();
      if (responseBody) {
        console.log(`[Push] Expiration response:`, responseBody);
      }
      return { success: false, expired: true };
    }
    
    // Log detailed error information
    const errorText = await response.text();
    console.error(`[Push] ❌ Failed to send (${response.status} ${response.statusText}):`, {
      endpoint: endpoint,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      errorBody: errorText,
      errorBodyLength: errorText.length,
      timestamp: new Date().toISOString()
    });
    return { success: false, expired: false };
    
  } catch (error) {
    console.error('[Push] ❌ Exception during send:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      endpoint: subscription.endpoint?.substring(0, 50) + '...',
      timestamp: new Date().toISOString()
    });
    return { success: false, expired: false };
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:hello@helpy.app';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('[Push] VAPID keys not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'VAPID not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Parse request body
    const body: NotificationPayload = await req.json();
    const { table, record, household_id, created_by_user_id } = body;

    console.log(`[Push] Processing ${table} notification for household ${household_id}`);

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all users in the household who should receive notifications
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, role, notifications_enabled, clerk_id')
      .eq('household_id', household_id)
      .neq('role', 'Child')
      .eq('notifications_enabled', true);

    if (usersError) {
      console.error('[Push] Failed to fetch users:', usersError);
      throw usersError;
    }

    console.log(`[Push] Found ${users?.length || 0} eligible user(s) (not Child, notifications_enabled=true)`);
    if (users && users.length > 0) {
      console.log('[Push] Eligible users:', users.map(u => ({
        id: u.id,
        name: u.name,
        role: u.role,
        notifications_enabled: u.notifications_enabled
      })));
    }

    if (!users || users.length === 0) {
      console.log('[Push] No eligible users');
      return new Response(
        JSON.stringify({ success: true, message: 'No eligible users' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find creator's name
    let creatorName = 'Someone';
    let creatorId = created_by_user_id;
    
    console.log(`[Push] Creator ID from trigger: ${creatorId}`);
    
    // Try to find creator in users list
    if (creatorId) {
      const creator = users.find(u => u.id === creatorId || u.clerk_id === creatorId);
      if (creator) {
        creatorName = creator.name || 'Someone';
        console.log(`[Push] Creator found in eligible users: ${creatorName} (${creator.id})`);
      } else {
        console.log(`[Push] Creator not in eligible users list, fetching separately...`);
        // Creator might be excluded (Child role, etc.) - fetch their name anyway
        const { data: creatorData } = await supabase
          .from('users')
          .select('name, id, clerk_id')
          .eq('household_id', household_id)
          .or(`id.eq.${creatorId},clerk_id.eq.${creatorId}`)
          .single();
        
        if (creatorData) {
          creatorName = creatorData.name || 'Someone';
          creatorId = creatorData.id; // Use the actual Supabase ID
          console.log(`[Push] Creator resolved: ${creatorName} (${creatorId})`);
        } else {
          console.log(`[Push] Could not resolve creator ID: ${creatorId}`);
        }
      }
    } else {
      console.log(`[Push] No creator ID provided (created_by_user_id is null/undefined)`);
    }

    // Filter out the creator from recipients (except for testing - Liko gets self-notifications)
    const LIKO_TEST_MODE = true; // TODO: Set to false in production
    const recipients = users.filter(u => {
      // In test mode, don't filter out Liko so he can test by adding items himself
      if (LIKO_TEST_MODE && (u.name === 'Liko' || u.name?.includes('Liko'))) {
        return true;
      }
      return u.id !== creatorId && u.clerk_id !== creatorId;
    });

    console.log(`[Push] After filtering out creator (${creatorId}), ${recipients.length} recipient(s) remain`);
    if (recipients.length > 0) {
      console.log('[Push] Recipients:', recipients.map(u => ({
        id: u.id,
        name: u.name
      })));
    }

    if (recipients.length === 0) {
      console.log('[Push] No recipients after filtering out creator');
      return new Response(
        JSON.stringify({ success: true, message: 'No recipients' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get push subscriptions for recipients
    const recipientIds = recipients.map(u => u.id);
    console.log(`[Push] Looking for subscriptions for ${recipientIds.length} recipient(s):`, recipientIds);
    
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', recipientIds);

    if (subsError) {
      console.error('[Push] Failed to fetch subscriptions:', subsError);
      throw subsError;
    }

    console.log(`[Push] Found ${subscriptions?.length || 0} subscription(s) in database`);
    
    // Debug: Check all subscriptions in household to see what's there
    const { data: allSubs } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint')
      .eq('household_id', household_id);
    console.log(`[Push] All subscriptions in household:`, allSubs?.map(s => ({
      user_id: s.user_id,
      endpoint: s.endpoint.substring(0, 50) + '...'
    })));

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[Push] No push subscriptions found for recipients');
      
      // Still save to notifications table for in-app history
      const notificationRecords = recipients.map(user => ({
        household_id,
        recipient_user_id: user.id,
        type: table === 'todo_items' ? 'todo_item' : table.replace(/s$/, ''),
        title: buildNotificationMessage(table, record, creatorName).title,
        body: buildNotificationMessage(table, record, creatorName).body,
        reference_id: record.id as string,
        reference_table: table,
        triggered_by_user_id: creatorId,
        triggered_by_name: creatorName,
        read: false
      }));

      await supabase.from('notifications').insert(notificationRecords);
      
      return new Response(
        JSON.stringify({ success: true, message: 'No subscriptions, saved to history' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build notification message
    const message = buildNotificationMessage(table, record, creatorName);
    const referenceId = record.id as string;

    console.log(`[Push] 📤 Sending to ${subscriptions.length} subscription(s)...`);
    console.log(`[Push] Notification details:`, {
      title: message.title,
      body: message.body,
      type: message.type,
      referenceId: referenceId,
      creatorName: creatorName
    });

    // Send to all subscriptions with detailed logging
    const results = await Promise.all(
      subscriptions.map((sub, index) => {
        console.log(`[Push] [${index + 1}/${subscriptions.length}] Sending to subscription:`, {
          subscriptionId: sub.id,
          userId: sub.user_id,
          endpoint: sub.endpoint.substring(0, 50) + '...',
          hasKeys: !!(sub.p256dh_key && sub.auth_key)
        });
        return sendWebPushNotification(
          sub,
          { ...message, referenceId },
          vapidPublicKey,
          vapidPrivateKey,
          vapidSubject
        );
      })
    );

    // Remove expired subscriptions
    const expiredSubs = subscriptions.filter((_, i) => results[i].expired);
    if (expiredSubs.length > 0) {
      const expiredIds = expiredSubs.map(s => s.id);
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', expiredIds);
      console.log(`[Push] Removed ${expiredIds.length} expired subscriptions`);
    }

    // Save to notifications table
    const notificationRecords = recipients.map(user => ({
      household_id,
      recipient_user_id: user.id,
      type: table === 'todo_items' ? 'todo_item' : table.replace(/s$/, ''),
      title: message.title,
      body: message.body,
      reference_id: referenceId,
      reference_table: table,
      triggered_by_user_id: creatorId,
      triggered_by_name: creatorName,
      read: false
    }));

    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notificationRecords);

    if (notifError) {
      console.warn('[Push] Failed to save notifications:', notifError);
    }

    const successCount = results.filter(r => r.success).length;
    const expiredCount = results.filter(r => r.expired).length;
    const failedCount = results.filter(r => !r.success && !r.expired).length;
    
    console.log(`[Push] 📊 Final results:`, {
      total: subscriptions.length,
      successful: successCount,
      expired: expiredCount,
      failed: failedCount,
      successRate: `${Math.round((successCount / subscriptions.length) * 100)}%`
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount, 
        total: subscriptions.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Push] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

