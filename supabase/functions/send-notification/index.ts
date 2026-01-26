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
  // Event type for UPDATE/DELETE support (defaults to INSERT for backward compatibility)
  event?: 'INSERT' | 'UPDATE' | 'DELETE';
  // Old record for UPDATE events (to detect what changed)
  old_record?: Record<string, unknown>;
  // BATCHING: New fields for batched notifications
  is_batch?: boolean;
  item_type?: string; // 'shopping' or 'task' for todo_items
  items?: Array<{
    id: string;
    record: Record<string, unknown>;
    old_record?: Record<string, unknown>;
  }>;
  item_count?: number;
}

// =============================================================================
// HELPER: Format due date context for tasks
// Returns "(due today)", "(due tomorrow)", "(overdue!)" or ""
// =============================================================================
function formatDueDateContext(dueDate: string | null | undefined): string {
  if (!dueDate) return '';
  
  try {
    // Parse YYYY-MM-DD format (timezone-safe, no Date object)
    const [year, month, day] = dueDate.split('-').map(Number);
    
    // Get current date in local timezone
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth() + 1; // 0-indexed
    const todayDay = now.getDate();
    
    // Calculate days difference using simple date math
    // Convert both dates to days since epoch for comparison
    const dueDays = year * 365 + month * 30 + day;
    const todayDays = todayYear * 365 + todayMonth * 30 + todayDay;
    const diff = dueDays - todayDays;
    
    if (diff < 0) return '(overdue!)';
    if (diff === 0) return '(due today)';
    if (diff === 1) return '(due tomorrow)';
    
    return ''; // More than 1 day away, no special label
  } catch {
    return '';
  }
}

// =============================================================================
// HELPER: Get assignee name from household users
// Returns first name only for cleaner notifications
// =============================================================================
function getAssigneeName(
  assigneeId: string | null | undefined,
  creatorId: string | null | undefined,
  householdUsers?: Array<{ id: string; name: string; clerk_id?: string }>
): string | null {
  // No assignee or same as creator = don't show
  if (!assigneeId || !householdUsers || assigneeId === creatorId) return null;
  
  // Look up by Supabase UUID
  const assignee = householdUsers.find(u => u.id === assigneeId);
  if (assignee && assignee.name) {
    return assignee.name.split(' ')[0]; // First name only
  }
  
  return null;
}

// CORS headers for edge function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Build notification message based on the table, record, and event type
 * 
 * NEW FORMAT (3 lines):
 * Line 1 (Title): [Emoji] [Page Name]
 * Line 2 (Body):  [Item/Content]
 * Line 3 (Body):  [action] by [User]
 * 
 * Body is combined as: "Line2\nLine3"
 */
function buildNotificationMessage(
  table: string,
  record: Record<string, unknown>,
  creatorName: string,
  event: 'INSERT' | 'UPDATE' | 'DELETE' = 'INSERT',
  oldRecord?: Record<string, unknown>,
  creatorId?: string,  // Actor's Supabase UUID - for detecting self-actions
  householdUsers?: Array<{ id: string; name: string; clerk_id?: string }> // For looking up removed user names
): { title: string; body: string; type: string } {
  
  switch (table) {
    case 'todo_items': {
      const itemType = record.type as string;
      const itemName = record.name as string || 'an item';
      const isCompleted = record.completed as boolean;
      const wasCompleted = oldRecord?.completed as boolean;
      const dueDate = record.due_date as string | null;
      const assigneeId = record.assignee_id as string | null;
      
      // SOFT DELETE DETECTION: Check if deleted_at was set (null → timestamp)
      const isDeleted = record.deleted_at !== null && record.deleted_at !== undefined;
      const wasDeleted = oldRecord?.deleted_at !== null && oldRecord?.deleted_at !== undefined;
      const isSoftDelete = event === 'UPDATE' && isDeleted && !wasDeleted;
      
      // UN-COMPLETE DETECTION: completed changed true → false/null
      const isUncompletion = event === 'UPDATE' && wasCompleted && !isCompleted;
      
      // If this is a soft delete of an ALREADY COMPLETED item, skip notification
      if (isSoftDelete && wasCompleted) {
        return {
          title: '',
          body: '',
          type: 'skip' // Special type to indicate no notification should be sent
        };
      }
      
      // Get due date context for INSERT (today/tomorrow/overdue)
      const dueDateContext = event === 'INSERT' ? formatDueDateContext(dueDate) : '';
      
      // Get assignee name for INSERT (if assigned to someone else)
      const assigneeName = event === 'INSERT' 
        ? getAssigneeName(assigneeId, creatorId, householdUsers)
        : null;
      
      // Build item label with optional context
      // Format: "Item name → Assignee (due today)" or just "Item name"
      let itemLabel = itemName;
      if (assigneeName) {
        itemLabel += ` → ${assigneeName}`;
      }
      if (dueDateContext) {
        itemLabel += ` ${dueDateContext}`;
      }
      
      if (itemType === 'shopping') {
        // Shopping List notifications
        if (event === 'UPDATE' && isCompleted && !wasCompleted) {
          // Item was bought (completed changed false → true)
          return {
            title: '✅ Shopping',
            body: `${itemName}\nbought by ${creatorName}`,
            type: 'shopping'
          };
        } else if (isUncompletion) {
          // Item was marked as NOT bought (completed changed true → false)
          return {
            title: '🛒 Shopping',
            body: `${itemName}\nmarked as not bought by ${creatorName}`,
            type: 'shopping'
          };
        } else if (event === 'DELETE' || isSoftDelete) {
          // Real delete OR soft delete of non-completed item
          return {
            title: '🛒 Shopping',
            body: `${itemName}\ndeleted by ${creatorName}`,
            type: 'shopping'
          };
        } else if (event === 'UPDATE') {
          return {
            title: '🛒 Shopping',
            body: `${itemName}\nchanged by ${creatorName}`,
            type: 'shopping'
          };
        } else {
          // INSERT (default) - includes assignee and due date context
          return {
            title: '🛒 Shopping',
            body: `${itemLabel}\nadded by ${creatorName}`,
            type: 'shopping'
          };
        }
      } else {
        // Tasks notifications
        if (event === 'UPDATE' && isCompleted && !wasCompleted) {
          // Task was completed
          return {
            title: '✅ Tasks',
            body: `${itemName}\ndone by ${creatorName}`,
            type: 'task'
          };
        } else if (isUncompletion) {
          // Task was marked as NOT done (completed changed true → false)
          return {
            title: '📝 Tasks',
            body: `${itemName}\nmarked as incomplete by ${creatorName}`,
            type: 'task'
          };
        } else if (event === 'DELETE' || isSoftDelete) {
          // Real delete OR soft delete of non-completed item
          return {
            title: '📝 Tasks',
            body: `${itemName}\ndeleted by ${creatorName}`,
            type: 'task'
          };
        } else if (event === 'UPDATE') {
          return {
            title: '📝 Tasks',
            body: `${itemName}\nchanged by ${creatorName}`,
            type: 'task'
          };
        } else {
          // INSERT (default) - includes assignee and due date context
          return {
            title: '📝 Tasks',
            body: `${itemLabel}\nadded by ${creatorName}`,
            type: 'task'
          };
        }
      }
    }
    
    case 'meals': {
      const mealType = record.type as string || 'meal';
      const mealDate = record.date as string || ''; // "2026-01-08" format
      
      // Format date as "8 Jan 2026" using string parsing (timezone-safe)
      let formattedDate = 'unknown date';
      if (mealDate && mealDate.includes('-')) {
        const [year, month, day] = mealDate.split('-');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        formattedDate = `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
      }
      
      const mealLabel = `${mealType} on ${formattedDate}`;
      
      if (event === 'DELETE') {
        // Check if this was a "leave" action (empty meal slot, user was the only one)
        const description = record.description as string || '';
        const forUserIds = (record.for_user_ids as string[]) || [];
        const wasLeaveAction = !description.trim() && forUserIds.length <= 1;
        
        if (wasLeaveAction) {
          return {
            title: '🍽️ Meals',
            body: `${mealLabel}\n${creatorName} will not join`,
            type: 'meal'
          };
        }
        
        // Otherwise it's a real meal removal
        return {
          title: '🍽️ Meals',
          body: `${mealLabel}\nremoved by ${creatorName}`,
          type: 'meal'
        };
      } else if (event === 'UPDATE') {
        // Check for RSVP changes (for_user_ids changed)
        const oldUserIds = (oldRecord?.for_user_ids as string[]) || [];
        const newUserIds = (record.for_user_ids as string[]) || [];
        
        // Detect joins and leaves
        const joinedUsers = newUserIds.filter(id => !oldUserIds.includes(id));
        const leftUsers = oldUserIds.filter(id => !newUserIds.includes(id));
        
        // Check if ONLY for_user_ids changed (pure RSVP action)
        const descriptionChanged = oldRecord?.description !== record.description;
        const typeChanged = oldRecord?.type !== record.type;
        const audienceChanged = oldRecord?.audience !== record.audience;
        const onlyRsvpChanged = !descriptionChanged && !typeChanged && !audienceChanged;
        
        // If someone joined (and it's a pure RSVP action)
        if (joinedUsers.length > 0 && leftUsers.length === 0 && onlyRsvpChanged) {
          // CRITICAL FIX: Check if creator added THEMSELVES vs adding someone else
          // All IDs here are Supabase UUIDs (for_user_ids and creatorId)
          const creatorJoinedSelf = creatorId && joinedUsers.includes(creatorId);
          
          if (creatorJoinedSelf) {
            // Self-joining: "Liko is joining"
            return {
              title: '🍽️ Meals',
              body: `${mealLabel}\n${creatorName} is joining`,
              type: 'meal'
            };
          } else {
            // Adding someone else: "Liko added Chaeyoung"
            // Look up the added user's name from the household users list
            let addedUserName = 'someone';
            if (householdUsers && joinedUsers.length > 0) {
              // joinedUsers[0] is a Supabase UUID, match against user.id (also UUID)
              const addedUser = householdUsers.find(u => u.id === joinedUsers[0]);
              if (addedUser) {
                // Use first name only for cleaner notification (consistent with other notifications)
                addedUserName = addedUser.name?.split(' ')[0] || 'someone';
              }
            }
            return {
              title: '🍽️ Meals',
              body: `${mealLabel}\n${creatorName} added ${addedUserName}`,
              type: 'meal'
            };
          }
        }
        
        // If someone left (and it's a pure RSVP action)
        if (leftUsers.length > 0 && joinedUsers.length === 0 && onlyRsvpChanged) {
          // CRITICAL FIX: Check if creator removed THEMSELVES vs removing someone else
          // All IDs here are Supabase UUIDs (for_user_ids and creatorId)
          const creatorRemovedSelf = creatorId && leftUsers.includes(creatorId);
          
          if (creatorRemovedSelf) {
            // Self-removal: "Liko will not join"
            return {
              title: '🍽️ Meals',
              body: `${mealLabel}\n${creatorName} will not join`,
              type: 'meal'
            };
          } else {
            // Removing someone else: "Liko removed Chaeyoung"
            // Look up the removed user's name from the household users list
            let removedUserName = 'someone';
            if (householdUsers && leftUsers.length > 0) {
              // leftUsers[0] is a Supabase UUID, match against user.id (also UUID)
              const removedUser = householdUsers.find(u => u.id === leftUsers[0]);
              if (removedUser) {
                // Use first name only for cleaner notification (consistent with other notifications)
                removedUserName = removedUser.name?.split(' ')[0] || 'someone';
              }
            }
            return {
              title: '🍽️ Meals',
              body: `${mealLabel}\n${creatorName} removed ${removedUserName}`,
              type: 'meal'
            };
          }
        }
        
        // Default: generic "changed" for other updates
        return {
          title: '🍽️ Meals',
          body: `${mealLabel}\nchanged by ${creatorName}`,
          type: 'meal'
        };
      } else {
        // INSERT
        // Check if this is a "quick RSVP" scenario (user joining empty meal slot)
        // Indicators: empty description AND exactly 1 person in the meal (self-join)
        const description = record.description as string || '';
        const forUserIds = (record.for_user_ids as string[]) || [];
        
        const isQuickRsvp = !description.trim() && forUserIds.length === 1;
        
        if (isQuickRsvp) {
          return {
            title: '🍽️ Meals',
            body: `${mealLabel}\n${creatorName} is joining`,
            type: 'meal'
          };
        }
        
        return {
          title: '🍽️ Meals',
          body: `${mealLabel}\nadded by ${creatorName}`,
          type: 'meal'
        };
      }
    }
    
    case 'expenses': {
      const merchant = record.merchant as string || 'Unknown';
      const amount = record.amount as number || 0;
      const amountStr = `$${amount.toFixed(2)}`;
      
      if (event === 'DELETE') {
        return {
          title: '💰 Expenses',
          body: `${merchant} ${amountStr}\nremoved by ${creatorName}`,
          type: 'expense'
        };
      } else if (event === 'UPDATE') {
        // Use "expense updated" format for clarity
        return {
          title: '💰 Expenses',
          body: `${merchant} expense\nupdated by ${creatorName}`,
          type: 'expense'
        };
      } else {
        // INSERT
        return {
          title: '💰 Expenses',
          body: `${merchant} ${amountStr}\nadded by ${creatorName}`,
          type: 'expense'
        };
      }
    }
    
    // NEW: Family Board (households table)
    case 'households': {
      // Get the note content and truncate if needed
      const noteContent = (record.family_notes as string) || '';
      const MAX_PREVIEW_LENGTH = 50; // Character limit for preview
      
      // Create truncated preview
      let notePreview = noteContent.trim();
      if (notePreview.length > MAX_PREVIEW_LENGTH) {
        notePreview = notePreview.substring(0, MAX_PREVIEW_LENGTH).trim() + '...';
      }
      // Replace newlines with spaces for cleaner single-line preview
      notePreview = notePreview.replace(/\n+/g, ' ');
      
      if (event === 'DELETE' || !noteContent.trim()) {
        // Note was cleared/deleted
        return {
          title: '📌 Family Board',
          body: `Note cleared\nby ${creatorName}`,
          type: 'family_board'
        };
      } else if (event === 'UPDATE') {
        return {
          title: '📌 Family Board',
          body: `${notePreview}\nupdated by ${creatorName}`,
          type: 'family_board'
        };
      } else {
        // INSERT (new note pinned)
        return {
          title: '📌 Family Board',
          body: `${notePreview}\npinned by ${creatorName}`,
          type: 'family_board'
        };
      }
    }
    
    default:
      return {
        title: 'Helpy Update',
        body: `Something new\nby ${creatorName}`,
        type: 'general'
      };
  }
}

/**
 * Build notification message for BATCHED items
 * 
 * Format: "Milk, Eggs +3 more — added by Ryan"
 */
function buildBatchedNotificationMessage(
  table: string,
  items: Array<{ id: string; record: Record<string, unknown>; old_record?: Record<string, unknown> }>,
  creatorName: string,
  event: 'INSERT' | 'UPDATE' | 'DELETE',
  itemType?: string, // 'shopping' or 'task' for todo_items
  creatorId?: string,  // Actor's Supabase UUID - for detecting self-actions
  householdUsers?: Array<{ id: string; name: string; clerk_id?: string }> // For looking up removed user names
): { title: string; body: string; type: string } {
  
  const count = items.length;
  
  // Get item names for display
  const getItemName = (item: { record: Record<string, unknown> }) => {
    return (item.record.name as string) || 
           (item.record.merchant as string) || 
           (item.record.description as string) || 
           'item';
  };
  
  // Format items list: "Item1, Item2 +N more" or just "Item1" or "Item1, Item2, Item3"
  const formatItemsList = () => {
    if (count === 1) {
      return getItemName(items[0]);
    } else if (count === 2) {
      return `${getItemName(items[0])}, ${getItemName(items[1])}`;
    } else if (count === 3) {
      return `${getItemName(items[0])}, ${getItemName(items[1])}, ${getItemName(items[2])}`;
    } else {
      return `${getItemName(items[0])}, ${getItemName(items[1])} +${count - 2} more`;
    }
  };
  
  // Detect if this is a "completion" batch (items marked as bought/done)
  const isCompletionBatch = event === 'UPDATE' && items.some(item => {
    const isCompleted = item.record.completed as boolean;
    const wasCompleted = item.old_record?.completed as boolean;
    return isCompleted && !wasCompleted;
  });
  
  // UN-COMPLETE DETECTION for batches (items marked as NOT bought/done)
  const isUncompletionBatch = event === 'UPDATE' && items.some(item => {
    const isCompleted = item.record.completed as boolean;
    const wasCompleted = item.old_record?.completed as boolean;
    return wasCompleted && !isCompleted;
  });
  
  // SOFT DELETE DETECTION for batches
  const isSoftDeleteBatch = event === 'UPDATE' && items.some(item => {
    const isDeleted = item.record.deleted_at !== null && item.record.deleted_at !== undefined;
    const wasDeleted = item.old_record?.deleted_at !== null && item.old_record?.deleted_at !== undefined;
    return isDeleted && !wasDeleted;
  });
  
  // Check if ALL soft-deleted items were already completed (skip notification)
  const allSoftDeletedWereCompleted = isSoftDeleteBatch && items.every(item => {
    const isDeleted = item.record.deleted_at !== null && item.record.deleted_at !== undefined;
    const wasDeleted = item.old_record?.deleted_at !== null && item.old_record?.deleted_at !== undefined;
    const wasCompleted = item.old_record?.completed as boolean;
    // If this item was soft deleted, check if it was completed
    if (isDeleted && !wasDeleted) {
      return wasCompleted;
    }
    return true; // Non-deleted items don't affect this check
  });
  
  // Build message based on table type
  switch (table) {
    case 'todo_items': {
      const isShopping = itemType === 'shopping';
      
      // Skip notification if all soft-deleted items were already completed
      if (allSoftDeletedWereCompleted && isSoftDeleteBatch) {
        return {
          title: '',
          body: '',
          type: 'skip'
        };
      }
      
      if (isCompletionBatch) {
        // Bought/Done batch
        return {
          title: isShopping ? '✅ Shopping' : '✅ Tasks',
          body: `${formatItemsList()}\n${isShopping ? 'bought' : 'done'} by ${creatorName}`,
          type: isShopping ? 'shopping' : 'task'
        };
      }
      
      // UN-COMPLETION batch (marked as NOT bought/done)
      if (isUncompletionBatch) {
        return {
          title: isShopping ? '🛒 Shopping' : '📝 Tasks',
          body: `${formatItemsList()}\nmarked as ${isShopping ? 'not bought' : 'incomplete'} by ${creatorName}`,
          type: isShopping ? 'shopping' : 'task'
        };
      }
      
      // Soft delete batch of non-completed items
      if (isSoftDeleteBatch) {
        return {
          title: isShopping ? '🛒 Shopping' : '📝 Tasks',
          body: `${formatItemsList()}\ndeleted by ${creatorName}`,
          type: isShopping ? 'shopping' : 'task'
        };
      }
      
      const actionWord = event === 'DELETE' ? 'deleted' : event === 'UPDATE' ? 'changed' : 'added';
      
      return {
        title: isShopping ? '🛒 Shopping' : '📝 Tasks',
        body: `${formatItemsList()}\n${actionWord} by ${creatorName}`,
        type: isShopping ? 'shopping' : 'task'
      };
    }
    
    case 'expenses': {
      const actionWord = event === 'DELETE' ? 'removed' : event === 'UPDATE' ? 'updated' : 'added';
      
      if (count === 1) {
        const merchant = items[0].record.merchant as string || 'Unknown';
        const amount = items[0].record.amount as number || 0;
        return {
          title: '💰 Expenses',
          body: `${merchant} $${amount.toFixed(2)}\n${actionWord} by ${creatorName}`,
          type: 'expense'
        };
      }
      
      return {
        title: '💰 Expenses',
        body: `${count} items ${actionWord}\nby ${creatorName}`,
        type: 'expense'
      };
    }
    
    case 'meals': {
      // If only 1 item, use single notification logic which has proper RSVP detection
      if (count === 1) {
        return buildNotificationMessage(table, items[0].record, creatorName, event, items[0].old_record, creatorId, householdUsers);
      }
      
      // For multiple meals, check if this is a batch of quick RSVPs (joining empty meal slots)
      const allQuickRsvps = event === 'INSERT' && items.every(item => {
        const description = item.record.description as string || '';
        const forUserIds = (item.record.for_user_ids as string[]) || [];
        return !description.trim() && forUserIds.length === 1;
      });
      
      // Check if all items are "leave" actions (DELETE of empty meal slots)
      const allLeaveActions = event === 'DELETE' && items.every(item => {
        const description = item.record.description as string || '';
        const forUserIds = (item.record.for_user_ids as string[]) || [];
        return !description.trim() && forUserIds.length <= 1;
      });
      
      // Format date from first item
      const mealDate = items[0].record.date as string || '';
      let formattedDate = 'unknown date';
      if (mealDate && mealDate.includes('-')) {
        const [year, month, day] = mealDate.split('-');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        formattedDate = `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
      }
      
      if (allQuickRsvps) {
        // All items are quick RSVPs - user is joining multiple empty meal slots
        return {
          title: '🍽️ Meals',
          body: `${count} meals on ${formattedDate}\n${creatorName} is joining`,
          type: 'meal'
        };
      }
      
      if (allLeaveActions) {
        // All items are leave actions - user is leaving multiple empty meal slots
        return {
          title: '🍽️ Meals',
          body: `${count} meals on ${formattedDate}\n${creatorName} will not join`,
          type: 'meal'
        };
      }
      
      // Multiple meals changed at once - use generic message
      const mealType = items[0].record.type as string || 'meal';
      const actionWord = event === 'DELETE' ? 'removed' : event === 'UPDATE' ? 'changed' : 'added';
      
      const mealLabel = `${mealType} on ${formattedDate}`;
      
      return {
        title: '🍽️ Meals',
        body: `${mealLabel}\n${actionWord} by ${creatorName}`,
        type: 'meal'
      };
    }
    
    case 'households': {
      // Family Board - instant (uses same logic as single item)
      const noteContent = (items[0].record.family_notes as string) || '';
      const MAX_PREVIEW_LENGTH = 50;
      let notePreview = noteContent.trim();
      if (notePreview.length > MAX_PREVIEW_LENGTH) {
        notePreview = notePreview.substring(0, MAX_PREVIEW_LENGTH).trim() + '...';
      }
      notePreview = notePreview.replace(/\n+/g, ' ');
      
      if (!noteContent.trim()) {
        return {
          title: '📌 Family Board',
          body: `Note cleared\nby ${creatorName}`,
          type: 'family_board'
        };
      }
      return {
        title: '📌 Family Board',
        body: `${notePreview}\nupdated by ${creatorName}`,
        type: 'family_board'
      };
    }
    
    default:
      return {
        title: 'Helpy Update',
        body: `${count} items\nby ${creatorName}`,
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
): Promise<{ success: boolean; expired: boolean; shouldRetry?: boolean; errorMessage?: string }> {
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
    
    // Return retry info for 5xx server errors
    const shouldRetry = response.status >= 500 && response.status < 600;
    return { success: false, expired: false, shouldRetry, errorMessage: `${response.status}: ${errorText.substring(0, 100)}` };
    
  } catch (error) {
    console.error('[Push] ❌ Exception during send:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      endpoint: subscription.endpoint?.substring(0, 50) + '...',
      timestamp: new Date().toISOString()
    });
    return { success: false, expired: false, shouldRetry: true, errorMessage: error instanceof Error ? error.message : String(error) };
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
    const { 
      table, 
      record, 
      household_id, 
      created_by_user_id, 
      event = 'INSERT', 
      old_record,
      // Batching fields
      is_batch = false,
      item_type,
      items,
      item_count
    } = body;

    console.log(`[Push] Processing ${table} ${event} notification for household ${household_id}`, {
      is_batch,
      item_count: is_batch ? item_count : 1,
      item_type
    });

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all users in the household who should receive notifications
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, role, notifications_enabled, clerk_id, email')
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
        // Use first name only for cleaner notifications (consistent with Profile page display)
        creatorName = creator.name?.split(' ')[0] || 'Someone';
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
          // Use first name only for cleaner notifications (consistent with Profile page display)
          creatorName = creatorData.name?.split(' ')[0] || 'Someone';
          creatorId = creatorData.id; // Use the actual Supabase ID
          console.log(`[Push] Creator resolved: ${creatorName} (${creatorId})`);
        } else {
          console.log(`[Push] Could not resolve creator ID: ${creatorId}`);
        }
      }
    } else {
      console.log(`[Push] No creator ID provided (created_by_user_id is null/undefined)`);
    }

    // Filter out the creator from recipients
    // Rule: Users don't receive notifications for their own actions
    // Exception: If NOTIFICATION_TEST_EMAIL env var is set, that user receives their own notifications (for testing)
    const NOTIFICATION_TEST_EMAIL = Deno.env.get('NOTIFICATION_TEST_EMAIL') || '';

    const recipients = users.filter(u => {
      // Check if this user is in test mode (receives own notifications)
      const isTestMode = NOTIFICATION_TEST_EMAIL && u.email === NOTIFICATION_TEST_EMAIL;
      
      // Exclude self-actions UNLESS user is in test mode
      if (u.id === creatorId || u.clerk_id === creatorId) {
        if (isTestMode) {
          console.log(`[Push] 🧪 TEST MODE: Including ${u.name} (${u.email}) in own notifications`);
          // Continue to other checks, don't return false
        } else {
          console.log(`[Push] Excluding creator ${u.name} from recipients`);
          return false;
        }
      }
      
      // HELPER ROLE RESTRICTION: Helpers only see their own expenses
      // If this is an expense notification and user is a Helper, skip them
      if (table === 'expenses' && u.role === 'Helper') {
        console.log(`[Push] Skipping Helper ${u.name} for expense notification (not their expense)`);
        return false;
      }
      
      return true;
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
      let msgForHistory: { title: string; body: string; type: string };
      let refId: string;
      
      if (is_batch && items && items.length > 0) {
        msgForHistory = buildBatchedNotificationMessage(table, items, creatorName, event, item_type, creatorId, users);
        refId = items[0].id;
      } else {
        msgForHistory = buildNotificationMessage(table, record, creatorName, event, old_record, creatorId, users);
        refId = record.id as string;
      }
      
      // Skip notification if type is 'skip' (completed item deleted)
      if (msgForHistory.type === 'skip') {
        console.log('[Push] Skipping notification (completed item deleted)');
        return new Response(
          JSON.stringify({ success: true, message: 'Skipped (completed item deleted)' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const notificationRecords = recipients.map(user => ({
        household_id,
        recipient_user_id: user.id,
        type: table === 'todo_items' ? 'todo_item' : table.replace(/s$/, ''),
        title: msgForHistory.title,
        body: msgForHistory.body,
        reference_id: refId,
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

    // Build notification message - use batched function if this is a batch
    let message: { title: string; body: string; type: string };
    let referenceId: string;
    
    if (is_batch && items && items.length > 0) {
      // BATCHED notification
      message = buildBatchedNotificationMessage(table, items, creatorName, event, item_type, creatorId, users);
      referenceId = items[0].id; // Use first item's ID for reference
      console.log(`[Push] 📦 Building BATCHED notification for ${items.length} items`);
    } else {
      // Single item notification (backwards compatible)
      message = buildNotificationMessage(table, record, creatorName, event, old_record, creatorId, users);
      referenceId = record.id as string;
    }

    // Skip notification if type is 'skip' (completed item deleted)
    if (message.type === 'skip') {
      console.log('[Push] Skipping notification (completed item deleted)');
      return new Response(
        JSON.stringify({ success: true, message: 'Skipped (completed item deleted)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Queue failed pushes for retry (5xx errors)
    const retryableSubs = subscriptions.filter((_, i) => results[i].shouldRetry);
    if (retryableSubs.length > 0) {
      console.log(`[Push] Queuing ${retryableSubs.length} failed push(es) for retry`);
      for (let i = 0; i < subscriptions.length; i++) {
        if (results[i].shouldRetry) {
          try {
            await supabase.rpc('queue_push_for_retry', {
              p_subscription_id: subscriptions[i].id,
              p_payload: { ...message, referenceId },
              p_error_message: results[i].errorMessage || 'Unknown error'
            });
          } catch (retryErr) {
            // Ignore if retry queue doesn't exist yet (migration not run)
            console.warn('[Push] Could not queue for retry:', retryErr);
          }
        }
      }
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
    const retriedCount = results.filter(r => r.shouldRetry).length;
    const failedCount = results.filter(r => !r.success && !r.expired && !r.shouldRetry).length;
    
    console.log(`[Push] 📊 Final results:`, {
      total: subscriptions.length,
      successful: successCount,
      expired: expiredCount,
      queued_for_retry: retriedCount,
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
