import { getAuthenticatedSupabaseClient } from '../contexts/SupabaseContext';
import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface TicketMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  message: string;
  timestamp: string;
  isAdminReply: boolean;
}

export interface SupportTicket {
  id: string;
  householdId: string;
  userId: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high';
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
  // Joined user info (for admin view)
  userName?: string;
  userAvatar?: string;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function getSupabaseClient() {
  const authClient = getAuthenticatedSupabaseClient();
  if (authClient) {
    return authClient;
  }
  console.warn('[feedbackService] No authenticated client available, using default');
  return supabase;
}

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Convert snake_case to camelCase
function convertTicket(data: any): SupportTicket {
  return {
    id: data.id,
    householdId: data.household_id,
    userId: data.user_id,
    subject: data.subject,
    status: data.status,
    priority: data.priority,
    messages: (data.messages || []).map((msg: any) => ({
      id: msg.id,
      senderId: msg.sender_id,
      senderName: msg.sender_name,
      senderRole: msg.sender_role,
      message: msg.message,
      timestamp: msg.timestamp,
      isAdminReply: msg.is_admin_reply || false,
    })),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    // Joined user info
    userName: data.users?.name,
    userAvatar: data.users?.avatar,
  };
}

// ─────────────────────────────────────────────────────────────────
// API Functions
// ─────────────────────────────────────────────────────────────────

/**
 * Subscribe to support tickets (real-time updates)
 * - Regular users see only their own tickets (enforced by RLS)
 * - Household Admins see all tickets in their household (enforced by RLS)
 * - SuperAdmins see ALL tickets across ALL households (enforced by RLS)
 * 
 * NOTE: We don't filter client-side - RLS policies handle access control
 */
export function subscribeToTickets(
  householdId: string,
  userId: string,
  isAdmin: boolean,
  isSuperAdmin: boolean,
  callback: (tickets: SupportTicket[]) => void
): () => void {
  const client = getSupabaseClient();
  
  // Build query - RLS will filter based on user role
  // SuperAdmins: don't filter by household_id (they see all)
  // Regular users/Admins: filter by household_id
  const fetchTickets = async () => {
    let query = client
      .from('support_tickets')
      .select('*, users!support_tickets_user_id_fkey(name, avatar)');
    
    // Only filter by household if not SuperAdmin
    if (!isSuperAdmin) {
      query = query.eq('household_id', householdId);
    }
    
    const { data, error } = await query.order('updated_at', { ascending: false });
    
    if (error) {
      console.error('[feedbackService] Error fetching tickets:', error);
      console.error('[feedbackService] Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return;
    }
    
    console.log('[feedbackService] Fetched tickets:', {
      count: data?.length || 0,
      isAdmin,
      isSuperAdmin,
      userId,
      householdId,
    });
    
    callback((data || []).map(convertTicket));
  };
  
  // Initial fetch
  fetchTickets();
  
  // Subscribe to changes
  const subscription = client
    .channel(`support-tickets-${householdId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'support_tickets',
        filter: `household_id=eq.${householdId}`
      },
      () => {
        // Refetch on any change
        fetchTickets();
      }
    )
    .subscribe((status) => {
      console.log('[feedbackService] Subscription status:', status);
    });
  
  return () => {
    subscription.unsubscribe();
  };
}

/**
 * Create a new support ticket
 */
export async function createTicket(
  householdId: string,
  userId: string,
  userName: string,
  userRole: string,
  subject: string,
  initialMessage: string
): Promise<SupportTicket> {
  const client = getSupabaseClient();
  
  const message: any = {
    id: generateMessageId(),
    sender_id: userId,
    sender_name: userName,
    sender_role: userRole,
    message: initialMessage,
    timestamp: new Date().toISOString(),
    is_admin_reply: false,
  };
  
  const { data, error } = await client
    .from('support_tickets')
    .insert({
      household_id: householdId,
      user_id: userId,
      subject,
      status: 'open',
      priority: 'normal',
      messages: [message],
    })
    .select('*, users!support_tickets_user_id_fkey(name, avatar)')
    .single();
  
  if (error) {
    console.error('[feedbackService] Error creating ticket:', error);
    throw error;
  }
  
  return convertTicket(data);
}

/**
 * Add a message to an existing ticket
 */
export async function addMessageToTicket(
  ticketId: string,
  senderId: string,
  senderName: string,
  senderRole: string,
  message: string,
  isAdminReply: boolean = false
): Promise<void> {
  const client = getSupabaseClient();
  
  // First get current messages
  const { data: ticket, error: fetchError } = await client
    .from('support_tickets')
    .select('messages')
    .eq('id', ticketId)
    .single();
  
  if (fetchError) {
    console.error('[feedbackService] Error fetching ticket:', fetchError);
    throw fetchError;
  }
  
  const currentMessages = ticket.messages || [];
  const newMessage: any = {
    id: generateMessageId(),
    sender_id: senderId,
    sender_name: senderName,
    sender_role: senderRole,
    message,
    timestamp: new Date().toISOString(),
    is_admin_reply: isAdminReply,
  };
  
  // Update with new message
  const updateData: any = {
    messages: [...currentMessages, newMessage],
  };
  
  // If admin replies to an open ticket, set status to in_progress
  if (isAdminReply && ticket.status === 'open') {
    updateData.status = 'in_progress';
  }
  
  const { error: updateError } = await client
    .from('support_tickets')
    .update(updateData)
    .eq('id', ticketId);
  
  if (updateError) {
    console.error('[feedbackService] Error adding message:', updateError);
    throw updateError;
  }
}

/**
 * Update ticket status
 */
export async function updateTicketStatus(
  ticketId: string,
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
): Promise<void> {
  const client = getSupabaseClient();
  
  const { error } = await client
    .from('support_tickets')
    .update({ status })
    .eq('id', ticketId);
  
  if (error) {
    console.error('[feedbackService] Error updating status:', error);
    throw error;
  }
}

/**
 * Delete a ticket
 */
export async function deleteTicket(ticketId: string): Promise<void> {
  const client = getSupabaseClient();
  
  const { error } = await client
    .from('support_tickets')
    .delete()
    .eq('id', ticketId);
  
  if (error) {
    console.error('[feedbackService] Error deleting ticket:', error);
    throw error;
  }
}

/**
 * Get unread ticket count for admins (tickets with new messages since last view)
 */
export async function getOpenTicketCount(householdId: string): Promise<number> {
  const client = getSupabaseClient();
  
  const { count, error } = await client
    .from('support_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .in('status', ['open', 'in_progress']);
  
  if (error) {
    console.error('[feedbackService] Error getting ticket count:', error);
    return 0;
  }
  
  return count || 0;
}
