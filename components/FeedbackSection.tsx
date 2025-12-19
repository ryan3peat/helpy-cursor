import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  Plus,
  Send,
  MessageCircle,
  Trash2,
  CheckCircle,
  RefreshCw,
  Loader2,
  Clock,
  User as UserIcon,
} from 'lucide-react';
import { User, TranslationDictionary, UserRole } from '../types';
import {
  SupportTicket,
  TicketMessage,
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Form state
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [replyMessage, setReplyMessage] = useState<Record<string, string>>({});
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const replyInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  
  // Get user's Supabase UUID (needed for creating tickets)
  const userSupabaseId = getCachedSupabaseUuid(currentUser.id);
  
  // Subscribe to tickets - REMOVED client-side filtering, let RLS handle it
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
      }
    );
    
    return unsubscribe;
  }, [householdId, userSupabaseId, isAdmin]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tickets]);
  
  // Create new ticket with optimistic update
  const handleCreateTicket = async () => {
    if (!newSubject.trim() || !newMessage.trim()) return;
    
    const tempId = `temp-${Date.now()}`;
    const tempMessage: TicketMessage = {
      id: `msg-${Date.now()}`,
      senderId: userSupabaseId,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      message: newMessage.trim(),
      timestamp: new Date().toISOString(),
      isAdminReply: false,
    };
    
    const optimisticTicket: SupportTicket = {
      id: tempId,
      householdId,
      userId: userSupabaseId,
      subject: newSubject.trim(),
      status: 'open',
      priority: 'normal',
      messages: [tempMessage],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Optimistic update
    setTickets(prev => [optimisticTicket, ...prev]);
    setIsSending(true);
    
    const subject = newSubject.trim();
    const message = newMessage.trim();
    setNewSubject('');
    setNewMessage('');
    
    try {
      const ticket = await createTicket(
        householdId,
        userSupabaseId,
        currentUser.name,
        currentUser.role,
        subject,
        message
      );
      
      // Replace optimistic ticket with real one
      setTickets(prev => prev.map(t => t.id === tempId ? ticket : t));
    } catch (error) {
      console.error('Failed to create ticket:', error);
      // Rollback on error
      setTickets(prev => prev.filter(t => t.id !== tempId));
      // Restore form
      setNewSubject(subject);
      setNewMessage(message);
    } finally {
      setIsSending(false);
    }
  };
  
  // Send reply with optimistic update
  const handleSendReply = async (ticketId: string) => {
    const message = replyMessage[ticketId]?.trim();
    if (!message) return;
    
    const tempMessageId = `msg-${Date.now()}`;
    const tempMessage: TicketMessage = {
      id: tempMessageId,
      senderId: userSupabaseId,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      message,
      timestamp: new Date().toISOString(),
      isAdminReply: isAdmin,
    };
    
    // Optimistic update
    setTickets(prev => prev.map(ticket => {
      if (ticket.id === ticketId) {
        return {
          ...ticket,
          messages: [...ticket.messages, tempMessage],
          updatedAt: new Date().toISOString(),
          status: ticket.status === 'open' && isAdmin ? 'in_progress' : ticket.status,
        };
      }
      return ticket;
    }));
    
    // Clear input
    setReplyMessage(prev => ({ ...prev, [ticketId]: '' }));
    setIsSending(true);
    
    try {
      await addMessageToTicket(
        ticketId,
        userSupabaseId,
        currentUser.name,
        currentUser.role,
        message,
        isAdmin
      );
      // Real-time subscription will update with actual data
    } catch (error) {
      console.error('Failed to send reply:', error);
      // Rollback on error
      setTickets(prev => prev.map(ticket => {
        if (ticket.id === ticketId) {
          return {
            ...ticket,
            messages: ticket.messages.filter(m => m.id !== tempMessageId),
          };
        }
        return ticket;
      }));
      // Restore input
      setReplyMessage(prev => ({ ...prev, [ticketId]: message }));
    } finally {
      setIsSending(false);
    }
  };
  
  // Toggle ticket status
  const handleToggleStatus = async (ticket: SupportTicket) => {
    const newStatus = ticket.status === 'resolved' ? 'open' : 'resolved';
    
    // Optimistic update
    setTickets(prev => prev.map(t => 
      t.id === ticket.id ? { ...t, status: newStatus } : t
    ));
    
    try {
      await updateTicketStatus(ticket.id, newStatus);
    } catch (error) {
      console.error('Failed to update status:', error);
      // Rollback
      setTickets(prev => prev.map(t => 
        t.id === ticket.id ? { ...t, status: ticket.status } : t
      ));
    }
  };
  
  // Delete ticket with optimistic update
  const handleDeleteTicket = async (ticketId: string) => {
    // Optimistic update
    setTickets(prev => prev.filter(t => t.id !== ticketId));
    setDeleteConfirmId(null);
    
    try {
      await deleteTicket(ticketId);
    } catch (error) {
      console.error('Failed to delete ticket:', error);
      // Rollback - refetch tickets
      // The subscription will restore it
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
  const renderHeader = () => (
    <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center gap-3 px-4 py-4">
        <button
          onClick={onBack}
          className="p-2 -ml-2 hover:bg-secondary rounded-full transition-colors"
        >
          <ChevronLeft size={24} className="text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">{t['feedback.title'] || 'Feedback'}</h1>
      </div>
    </div>
  );
  
  // Render message bubble
  const renderMessage = (msg: TicketMessage, ticket: SupportTicket) => {
    const isFromMe = msg.senderId === userSupabaseId;
    const isAdminMessage = msg.isAdminReply;
    
    return (
      <div
        key={msg.id}
        className={`flex ${isFromMe ? 'justify-end' : 'justify-start'} mb-3`}
      >
        <div
          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
            isFromMe
              ? 'bg-primary text-white rounded-br-md'
              : 'bg-card border border-border text-foreground rounded-bl-md'
          }`}
        >
          {/* Sender info */}
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
  };
  
  return (
    <div className="min-h-screen bg-background pb-40 animate-fade-in">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {renderHeader()}
        
        <div className="pt-4">
          {/* Description */}
          <p className="text-sm text-muted-foreground mb-4">
            {t['feedback.description'] || 'Send us your feedback, questions, or report issues'}
          </p>
          
          {/* New message form */}
          <div className="bg-card border border-border rounded-2xl p-4 mb-6 space-y-3">
            <input
              type="text"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder={t['feedback.subject_placeholder'] || 'Brief description of your feedback'}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
            />
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={t['feedback.message_placeholder'] || 'Tell us more...'}
              rows={3}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground resize-none"
            />
            <button
              onClick={handleCreateTicket}
              disabled={!newSubject.trim() || !newMessage.trim() || isSending}
              className="w-full py-3 px-4 bg-primary text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
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
                {t['feedback.no_tickets_hint'] || 'Send a message above to get started'}
              </p>
            </div>
          ) : (
            /* Messages list - inline display */
            <div className="space-y-6">
              {tickets.map((ticket) => {
                const isOwner = ticket.userId === userSupabaseId;
                const canReply = isOwner || isAdmin;
                
                return (
                  <div
                    key={ticket.id}
                    className="bg-card border border-border rounded-2xl overflow-hidden"
                  >
                    {/* Ticket header */}
                    <div className="p-4 border-b border-border">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground mb-1">
                            {ticket.subject}
                          </h3>
                          {/* Show user name for admin */}
                          {isAdmin && ticket.userName && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                              <UserIcon size={14} />
                              <span>{ticket.userName}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[ticket.status].bg} ${STATUS_COLORS[ticket.status].text}`}>
                            {t[`feedback.status.${ticket.status}`] || ticket.status}
                          </span>
                          {canReply && (
                            <button
                              onClick={() => handleToggleStatus(ticket)}
                              className="p-1.5 hover:bg-secondary rounded-full transition-colors"
                              title={ticket.status === 'resolved' 
                                ? (t['feedback.reopen'] || 'Reopen')
                                : (t['feedback.mark_resolved'] || 'Mark as Resolved')
                              }
                            >
                              {ticket.status === 'resolved' ? (
                                <RefreshCw size={16} className="text-muted-foreground" />
                              ) : (
                                <CheckCircle size={16} className="text-green-500" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock size={12} />
                        {formatTime(ticket.updatedAt)}
                      </div>
                    </div>
                    
                    {/* Messages */}
                    <div className="p-4 space-y-3">
                      {ticket.messages.map(msg => renderMessage(msg, ticket))}
                      <div ref={messagesEndRef} />
                    </div>
                    
                    {/* Reply input */}
                    {canReply && ticket.status !== 'closed' && (
                      <div className="p-4 border-t border-border bg-secondary/30">
                        <div className="flex items-end gap-2">
                          <textarea
                            ref={(el) => { replyInputRefs.current[ticket.id] = el; }}
                            value={replyMessage[ticket.id] || ''}
                            onChange={(e) => setReplyMessage(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                            placeholder={t['feedback.reply_placeholder'] || 'Type your reply...'}
                            rows={1}
                            className="flex-1 px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground resize-none max-h-32"
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendReply(ticket.id);
                              }
                            }}
                          />
                          <button
                            onClick={() => handleSendReply(ticket.id)}
                            disabled={!replyMessage[ticket.id]?.trim() || isSending}
                            className="p-3 bg-primary text-white rounded-xl disabled:opacity-50 shrink-0"
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
                    
                    {/* Delete button */}
                    {(isAdmin || isOwner) && (
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
                );
              })}
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
