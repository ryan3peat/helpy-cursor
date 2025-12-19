-- ============================================================================
-- Migration: 056_support_tickets
-- Description: Create support tickets table for user feedback/support system
-- 
-- Features:
-- - Users can create support tickets (feedback messages)
-- - Messages are stored as JSONB array for simple chat-like interface
-- - Admins can view and respond to all tickets in their household
-- - Real-time updates supported
-- 
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================================

-- 1. Create the support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  -- Messages stored as JSONB array: [{sender_id, sender_name, sender_role, message, timestamp, is_admin_reply}]
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_support_tickets_household 
ON support_tickets(household_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user 
ON support_tickets(user_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status 
ON support_tickets(status);

CREATE INDEX IF NOT EXISTS idx_support_tickets_updated 
ON support_tickets(updated_at DESC);

-- 3. Enable Row Level Security
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies using Clerk JWT
-- Users can view their own tickets OR all tickets if they are Admin
CREATE POLICY "Users can view their own tickets or all if admin"
ON support_tickets FOR SELECT
USING (
  -- User can see their own tickets
  user_id IN (SELECT id FROM users WHERE clerk_id = get_clerk_id())
  OR
  -- Admins can see all tickets in their household
  (
    household_id = get_user_household_id()
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE clerk_id = get_clerk_id() 
      AND role = 'Admin'
    )
  )
);

-- Users can create their own tickets
CREATE POLICY "Users can create their own tickets"
ON support_tickets FOR INSERT
WITH CHECK (
  household_id = get_user_household_id()
  AND user_id IN (SELECT id FROM users WHERE clerk_id = get_clerk_id())
);

-- Users can update their own tickets (add messages) OR Admins can update any ticket
CREATE POLICY "Users can update own tickets or admins can update any"
ON support_tickets FOR UPDATE
USING (
  -- User can update their own tickets
  user_id IN (SELECT id FROM users WHERE clerk_id = get_clerk_id())
  OR
  -- Admins can update all tickets in their household
  (
    household_id = get_user_household_id()
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE clerk_id = get_clerk_id() 
      AND role = 'Admin'
    )
  )
);

-- Only allow deleting own tickets (or admin can delete)
CREATE POLICY "Users can delete own tickets or admins can delete any"
ON support_tickets FOR DELETE
USING (
  -- User can delete their own tickets
  user_id IN (SELECT id FROM users WHERE clerk_id = get_clerk_id())
  OR
  -- Admins can delete all tickets in their household
  (
    household_id = get_user_household_id()
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE clerk_id = get_clerk_id() 
      AND role = 'Admin'
    )
  )
);

-- 5. Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_support_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS support_tickets_updated_at ON support_tickets;
CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_support_ticket_timestamp();

-- 6. Enable realtime for this table (only if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'support_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE support_tickets;
  END IF;
END $$;

-- ============================================================================
-- Done! Support tickets table is ready for use
-- ============================================================================
