/**
 * Supabase Edge Function: send-notification
 * 
 * This function is triggered by database triggers when items are added.
 * It sends Web Push notifications to all eligible household members.
 * 
 * Eligibility:
 * - User role is NOT 'Child'
 * - User has notificationsEnabled = true
 * - User is NOT the one who created the item
 * - User has at least one push subscription
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import webPush from 'https://esm.sh/web-push@3.5.0?target=deno';

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
      // Format with HK$ (Hong Kong Dollar) - update when expanding to other markets
      const formattedAmount = `HK$${amount.toFixed(2)}`;
      return {
        title: 'New Expense Added',
        body: `${creatorName} added an expense: ${merchant} (${formattedAmount})`,
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
 * Send a Web Push notification using the standard Web Push protocol
 * 
 * Note: Full encryption requires complex ECDH + HKDF + AES-GCM implementation.
 * For a production-ready solution, consider using a push notification service
 * like Firebase Cloud Messaging (FCM), OneSignal, or Pusher.
 */
async function sendWebPushNotification(
  subscription: PushSubscriptionRecord,
  payload: { title: string; body: string; type: string; referenceId?: string },
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; expired: boolean }> {
  try {
    // Configure VAPID for each send to ensure keys are available in cold starts
    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const response = await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh_key,
          auth: subscription.auth_key,
        },
      },
      JSON.stringify(payload),
      { TTL: 86400 }
    );

    // web-push returns statusCode on the response object
    if (response.statusCode === 201 || response.statusCode === 200) {
      console.log(`[Push] Sent to ${subscription.endpoint.substring(0, 50)}...`);
      return { success: true, expired: false };
    }

    if (response.statusCode === 410 || response.statusCode === 404) {
      console.log(`[Push] Subscription expired: ${subscription.endpoint.substring(0, 50)}...`);
      return { success: false, expired: true };
    }

    console.error(`[Push] Failed (${response.statusCode}): ${response.body}`);
    return { success: false, expired: false };
  } catch (error) {
    // Detect expired/invalid subscriptions to prune them
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const statusCode = (error as { statusCode: number }).statusCode;
      if (statusCode === 410 || statusCode === 404) {
        console.log(`[Push] Subscription expired: ${subscription.endpoint.substring(0, 50)}...`);
        return { success: false, expired: true };
      }
    }

    console.error('[Push] Error:', error);
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
    
    // Try to find creator in users list
    if (creatorId) {
      const creator = users.find(u => u.id === creatorId || u.clerk_id === creatorId);
      if (creator) {
        creatorName = creator.name || 'Someone';
      } else {
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
        }
      }
    }

    // Filter out the creator from recipients
    const recipients = users.filter(u => 
      u.id !== creatorId && u.clerk_id !== creatorId
    );

    if (recipients.length === 0) {
      console.log('[Push] No recipients after filtering');
      return new Response(
        JSON.stringify({ success: true, message: 'No recipients' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get push subscriptions for recipients
    const recipientIds = recipients.map(u => u.id);
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', recipientIds);

    if (subsError) {
      console.error('[Push] Failed to fetch subscriptions:', subsError);
      throw subsError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[Push] No push subscriptions found');
      
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

    // Send to all subscriptions
    const results = await Promise.all(
      subscriptions.map(sub => 
        sendWebPushNotification(
          sub,
          { ...message, referenceId },
          vapidPublicKey,
          vapidPrivateKey,
          vapidSubject
        )
      )
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
    console.log(`[Push] Sent ${successCount}/${subscriptions.length} notifications`);

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
