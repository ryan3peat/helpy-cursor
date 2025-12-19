import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  Plus,
  Send,
  MessageCircle,
  Trash2,
  CheckCircle,
  RefreshCw,
  X,
  Loader2,
  Clock,
  User as UserIcon,
} from 'lucide-react';
import { User, TranslationDictionary, UserRole } from '../types';
import {
  SupportTicket,
  subscribeToTickets,
  createTicket,
  addMessageToTicket,
  updateTicketStatus,
  deleteTicket,
} from '../services/feedbackService';
import { getCachedSupabaseUuid } from '../services/supabaseService';

interface FeedbackSectionProps {
  currentUser: User;
  householdId: string;
  t: TranslationDictionary;
  onBack: () => void;
}

// Status badge colors
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open: { bg: 'bg-blue-100', text: 'text-blue-700' },
  in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  resolved: { bg: 'bg-green-100', text: 'text-green-700' },
  closed: { bg: 'bg-gray-100', text: 'text-gray-500' },
};

const FeedbackSection: React.FC<FeedbackSectionProps> = ({
  currentUser,
  householdId,
  t,
  onBack,
}) => {
  const isAdmin = currentUser.role === UserRole.MASTER;
  
  // State
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Form state
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Get user's Supabase UUID (needed for creating tickets)
  const userSupabaseId = getCachedSupabaseUuid(currentUser.id);
  
  // Subscribe to tickets
  useEffect(() => {
    if (!householdId || !userSupabaseId) return;
    
    setIsLoading(true);
    const unsubscribe = subscribeToTickets(
      householdId,
      userSupabaseId,
      isAdmin,
      (data) => {
        setTickets(data);
        setIsLoading(false);
        
        // Update selected ticket if it exists
        if (selectedTicket) {
          const updated = data.find(t => t.id === selectedTicket.id);
          if (updated) {
            setSelectedTicket(updated);
          }
        }
      }
    );
    
    return unsubscribe;
  }, [householdId, userSupabaseId, isAdmin]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (selectedTicket && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket?.messages]);
  
  // Create new ticket
  const handleCreateTicket = async () => {
    if (!newSubject.trim() || !newMessage.trim()) return;
    
    setIsSending(true);
    try {
      const ticket = await createTicket(
        householdId,
        userSupabaseId,
        currentUser.name,
        currentUser.role,
        newSubject.trim(),
        newMessage.trim()
      );
      
      setNewSubject('');
      setNewMessage('');
      setIsNewTicketOpen(false);
      setSelectedTicket(ticket);
    } catch (error) {
      console.error('Failed to create ticket:', error);
    } finally {
      setIsSending(false);
    }
  };
  
  // Send reply
  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    
    setIsSending(true);
    try {
      await addMessageToTicket(
        selectedTicket.id,
        userSupabaseId,
        currentUser.name,
        currentUser.role,
        replyMessage.trim(),
        isAdmin
      );
      setReplyMessage('');
    } catch (error) {
      console.error('Failed to send reply:', error);
    } finally {
      setIsSending(false);
    }
  };
  
  // Toggle ticket status
  const handleToggleStatus = async (ticket: SupportTicket) => {
    const newStatus = ticket.status === 'resolved' ? 'open' : 'resolved';
    try {
      await updateTicketStatus(ticket.id, newStatus);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };
  
  // Delete ticket
  const handleDeleteTicket = async (ticketId: string) => {
    try {
      await deleteTicket(ticketId);
      setDeleteConfirmId(null);
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(null);
      }
    } catch (error) {
      console.error('Failed to delete ticket:', error);
    }
  };
  
  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };
  
  // Render header
  const renderHeader = (title: string, showBackToList?: boolean) => (
    <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center gap-3 px-4 py-4">
        <button
          onClick={() => {
            if (showBackToList) {
              setSelectedTicket(null);
            } else {
              onBack();
            }
          }}
          className="p-2 -ml-2 hover:bg-secondary rounded-full transition-colors"
        >
          <ChevronLeft size={24} className="text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
      </div>
    </div>
  );
  
  // Render new ticket form
  if (isNewTicketOpen) {
    return (
      <div className="min-h-screen bg-background pb-40 animate-fade-in">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          {renderHeader(t['feedback.new_ticket'] || 'New Message', false)}
          
          <div className="pt-6 space-y-6">
            {/* Subject */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t['feedback.subject'] || 'Subject'}
              </label>
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder={t['feedback.subject_placeholder'] || 'Brief description of your feedback'}
                className="w-full px-4 py-3 bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                autoFocus
              />
            </div>
            
            {/* Message */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t['feedback.message'] || 'Message'}
              </label>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={t['feedback.message_placeholder'] || 'Tell us more...'}
                rows={6}
                className="w-full px-4 py-3 bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground resize-none"
              />
            </div>
            
            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setIsNewTicketOpen(false)}
                className="flex-1 py-3 px-4 bg-secondary text-foreground rounded-2xl font-semibold"
              >
                {t['common.cancel'] || 'Cancel'}
              </button>
              <button
                onClick={handleCreateTicket}
                disabled={!newSubject.trim() || !newMessage.trim() || isSending}
                className="flex-1 py-3 px-4 bg-primary text-white rounded-2xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {t['feedback.sending'] || 'Sending...'}
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    {t['feedback.send'] || 'Send'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Render ticket detail / chat view
  if (selectedTicket) {
    const isOwner = selectedTicket.userId === userSupabaseId;
    const canReply = isOwner || isAdmin;
    
    return (
      <div className="min-h-screen bg-background flex flex-col animate-fade-in">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-2 -ml-2 hover:bg-secondary rounded-full transition-colors"
              >
                <ChevronLeft size={24} className="text-foreground" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-foreground line-clamp-1">
                  {selectedTicket.subject}
                </h1>
                {isAdmin && selectedTicket.userName && (
                  <p className="text-sm text-muted-foreground">
                    {t['feedback.from'] || 'From'}: {selectedTicket.userName}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Status badge */}
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[selectedTicket.status].bg} ${STATUS_COLORS[selectedTicket.status].text}`}>
                {t[`feedback.status.${selectedTicket.status}`] || selectedTicket.status}
              </span>
              
              {/* Actions */}
              {canReply && (
                <button
                  onClick={() => handleToggleStatus(selectedTicket)}
                  className="p-2 hover:bg-secondary rounded-full transition-colors"
                  title={selectedTicket.status === 'resolved' 
                    ? (t['feedback.reopen'] || 'Reopen')
                    : (t['feedback.mark_resolved'] || 'Mark as Resolved')
                  }
                >
                  {selectedTicket.status === 'resolved' ? (
                    <RefreshCw size={20} className="text-muted-foreground" />
                  ) : (
                    <CheckCircle size={20} className="text-green-500" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32">
          {selectedTicket.messages.map((msg) => {
            const isFromMe = msg.senderId === userSupabaseId;
            const isAdminMessage = msg.isAdminReply;
            
            return (
              <div
                key={msg.id}
                className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    isFromMe
                      ? 'bg-primary text-white rounded-br-md'
                      : 'bg-card border border-border text-foreground rounded-bl-md'
                  }`}
                >
                  {/* Sender info (only show for others' messages or in admin view) */}
                  {!isFromMe && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold">
                        {msg.senderName}
                      </span>
                      {isAdminMessage && (
                        <span className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
                          {t['feedback.admin_badge'] || 'Admin'}
                        </span>
                      )}
                    </div>
                  )}
                  
                  <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                  
                  <div className={`text-xs mt-1 ${isFromMe ? 'text-white/70' : 'text-muted-foreground'}`}>
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Reply input */}
        {canReply && selectedTicket.status !== 'closed' && (
          <div className="sticky bottom-0 bg-background border-t border-border px-4 py-4 pb-[max(env(safe-area-inset-bottom),16px)]">
            <div className="flex items-end gap-2">
              <textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder={t['feedback.reply_placeholder'] || 'Type your reply...'}
                rows={1}
                className="flex-1 px-4 py-3 bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground resize-none max-h-32"
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                }}
              />
              <button
                onClick={handleSendReply}
                disabled={!replyMessage.trim() || isSending}
                className="p-3 bg-primary text-white rounded-full disabled:opacity-50"
              >
                {isSending ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Send size={20} />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Render ticket list
  return (
    <div className="min-h-screen bg-background pb-40 animate-fade-in">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {renderHeader(t['feedback.title'] || 'Feedback')}
        
        <div className="pt-4">
          {/* Description */}
          <p className="text-sm text-muted-foreground mb-4">
            {t['feedback.description'] || 'Send us your feedback, questions, or report issues'}
          </p>
          
          {/* New message button */}
          <button
            onClick={() => setIsNewTicketOpen(true)}
            className="w-full py-3 px-4 bg-primary text-white rounded-2xl font-semibold flex items-center justify-center gap-2 mb-6"
          >
            <Plus size={20} />
            {t['feedback.new_ticket'] || 'New Message'}
          </button>
          
          {/* Admin view label */}
          {isAdmin && tickets.length > 0 && (
            <p className="text-sm font-medium text-muted-foreground mb-3">
              {t['feedback.admin_view'] || 'All Household Messages'}
            </p>
          )}
          
          {/* Loading state */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          ) : tickets.length === 0 ? (
            /* Empty state */
            <div className="text-center py-12">
              <MessageCircle size={48} className="mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {t['feedback.no_tickets'] || 'No messages yet'}
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {t['feedback.no_tickets_hint'] || 'Tap the button above to send us feedback'}
              </p>
            </div>
          ) : (
            /* Ticket list */
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="bg-card border border-border rounded-2xl overflow-hidden"
                >
                  <button
                    onClick={() => setSelectedTicket(ticket)}
                    className="w-full text-left p-4 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground truncate">
                            {ticket.subject}
                          </h3>
                          <span className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[ticket.status].bg} ${STATUS_COLORS[ticket.status].text}`}>
                            {t[`feedback.status.${ticket.status}`] || ticket.status}
                          </span>
                        </div>
                        
                        {/* Show user name for admin */}
                        {isAdmin && ticket.userName && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                            <UserIcon size={14} />
                            <span>{ticket.userName}</span>
                          </div>
                        )}
                        
                        {/* Last message preview */}
                        {ticket.messages.length > 0 && (
                          <p className="text-sm text-muted-foreground truncate">
                            {ticket.messages[ticket.messages.length - 1].message}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock size={12} />
                          {formatTime(ticket.updatedAt)}
                        </div>
                        {ticket.messages.length > 1 && (
                          <span className="text-xs text-muted-foreground">
                            {ticket.messages.length} messages
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  
                  {/* Delete button */}
                  {(isAdmin || ticket.userId === userSupabaseId) && (
                    <div className="border-t border-border">
                      {deleteConfirmId === ticket.id ? (
                        <div className="p-3 flex items-center justify-between bg-red-50">
                          <span className="text-sm text-red-700">
                            {t['feedback.delete_confirm'] || 'Are you sure you want to delete this conversation?'}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-3 py-1.5 text-sm bg-white border border-border rounded-lg"
                            >
                              {t['common.cancel'] || 'Cancel'}
                            </button>
                            <button
                              onClick={() => handleDeleteTicket(ticket.id)}
                              className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg"
                            >
                              {t['common.delete'] || 'Delete'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(ticket.id)}
                          className="w-full py-2 px-4 text-sm text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                        >
                          <Trash2 size={14} />
                          {t['common.delete'] || 'Delete'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="helpy-footer mt-8">
          <span className="helpy-logo">helpy</span>
        </div>
      </div>
    </div>
  );
};

export default FeedbackSection;
