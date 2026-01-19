// api/analytics.ts
// Analytics endpoint - SuperAdmin only
// Returns aggregate stats from users table across all households

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch all users with household_id and status
    const { data: users, error } = await supabase
      .from('users')
      .select('id, household_id, status');

    if (error) {
      console.error('Analytics query error:', error);
      return res.status(500).json({ error: 'Failed to fetch analytics data' });
    }

    // Count unique household IDs by status
    const householdsByStatus: Record<string, Set<string>> = {
      active: new Set(),
      pending: new Set(),
    };

    // Count unique user IDs by status
    const usersByStatus: Record<string, number> = {
      active: 0,
      pending: 0,
    };

    for (const user of users || []) {
      const status = user.status || 'active'; // Default to active if not set
      const normalizedStatus = status === 'active' ? 'active' : 'pending';
      
      if (user.household_id) {
        householdsByStatus[normalizedStatus].add(user.household_id);
      }
      
      if (user.id) {
        usersByStatus[normalizedStatus]++;
      }
    }

    const totalUsers = usersByStatus.active + usersByStatus.pending;

    return res.status(200).json({
      households: {
        active: householdsByStatus.active.size,
        pending: householdsByStatus.pending.size,
        total: new Set([...householdsByStatus.active, ...householdsByStatus.pending]).size,
      },
      users: {
        active: usersByStatus.active,
        pending: usersByStatus.pending,
        total: totalUsers,
      },
    });

  } catch (error: any) {
    console.error('Analytics error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error'
    });
  }
}
