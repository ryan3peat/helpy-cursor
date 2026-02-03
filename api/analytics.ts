// api/analytics.ts
// Analytics endpoint - SuperAdmin only
// Returns aggregate stats from users table across all households

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Inline logger to avoid module resolution issues in Vercel serverless
const isDev = process.env.NODE_ENV !== 'production';
const logger = {
  log: (...args: unknown[]) => isDev && console.log(...args),
  error: (...args: unknown[]) => console.error(...args),
};

// Initialize Supabase with service role (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// CORS: Only allow helpyfam.com, localhost, and Vercel previews
const ALLOWED_ORIGINS = ['https://app.helpyfam.com', 'https://www.helpyfam.com'];
function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string | undefined;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('https://localhost') || origin.endsWith('.vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// Helper to get date range based on filter
function getDateRange(filter: string): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (filter) {
    case 'this_week': {
      // Start of this week (Monday)
      const dayOfWeek = today.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const start = new Date(today);
      start.setDate(today.getDate() - diffToMonday);
      return { start, end: now };
    }
    case 'last_week': {
      // Last week (Monday to Sunday)
      const dayOfWeek = today.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() - diffToMonday);
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(thisMonday.getDate() - 1);
      lastSunday.setHours(23, 59, 59, 999);
      return { start: lastMonday, end: lastSunday };
    }
    case 'this_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start, end: now };
    }
    case 'last_month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
      return { start, end };
    }
    case 'last_30_days': {
      const start = new Date(today);
      start.setDate(today.getDate() - 30);
      return { start, end: now };
    }
    case 'ytd': {
      const start = new Date(today.getFullYear(), 0, 1);
      return { start, end: now };
    }
    default:
      // Default to all time (1 year back)
      const start = new Date(today);
      start.setFullYear(today.getFullYear() - 1);
      return { start, end: now };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get date filter from query params
    const dateFilter = (req.query.dateFilter as string) || 'last_30_days';
    const { start: dateStart, end: dateEnd } = getDateRange(dateFilter);

    // Fetch all users with household_id and status
    const { data: users, error } = await supabase
      .from('users')
      .select('id, household_id, status');

    if (error) {
      logger.error('Analytics query error:', error);
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

    // Fetch Betty promo redemptions with user details
    logger.log('Fetching Betty redemptions with date range:', {
      dateFilter,
      dateStart: dateStart.toISOString(),
      dateEnd: dateEnd.toISOString(),
    });

    const { data: bettyRedemptions, error: bettyError } = await supabase
      .from('referral_usage')
      .select(`
        id,
        code_used,
        created_at,
        trial_started_at,
        trial_ends_at,
        converted_to_paid_at,
        household_id
      `)
      .eq('code_used', 'BETTY30DAYS')
      .gte('created_at', dateStart.toISOString())
      .lte('created_at', dateEnd.toISOString())
      .order('created_at', { ascending: false });

    if (bettyError) {
      logger.error('Betty redemptions query error:', bettyError);
      // Continue without Betty data - don't fail the whole request
    }

    logger.log('Betty redemptions found:', {
      count: bettyRedemptions?.length || 0,
      redemptions: bettyRedemptions,
    });

    // Get household IDs for Betty redemptions to fetch user details
    const householdIds = (bettyRedemptions || [])
      .map(r => r.household_id)
      .filter(Boolean);

    // Fetch users (account owners) for these households
    let bettyUsersMap: Record<string, { email: string; name: string }> = {};
    if (householdIds.length > 0) {
      logger.log('Looking up users for household IDs:', householdIds);

      const { data: householdUsers, error: usersError } = await supabase
        .from('users')
        .select('household_id, email, name, role')
        .in('household_id', householdIds)
        .in('role', ['Admin', 'SuperAdmin']); // Get the admin (account owner) for each household

      if (usersError) {
        logger.error('Betty users query error:', usersError);
      } else if (householdUsers) {
        logger.log('Found household users:', householdUsers);
        for (const u of householdUsers) {
          if (u.household_id) {
            bettyUsersMap[u.household_id] = {
              email: u.email || 'N/A',
              name: u.name || 'N/A',
            };
          }
        }
      }
    } else {
      logger.log('No household IDs to look up - redemptions may have null household_id');
    }

    // Build Betty redemptions with user details
    const bettyRedemptionsWithUsers = (bettyRedemptions || []).map(r => ({
      id: r.id,
      codeUsed: r.code_used,
      createdAt: r.created_at,
      trialStartedAt: r.trial_started_at,
      trialEndsAt: r.trial_ends_at,
      convertedToPaidAt: r.converted_to_paid_at,
      userEmail: bettyUsersMap[r.household_id]?.email || 'N/A',
      userName: bettyUsersMap[r.household_id]?.name || 'N/A',
    }));

    // Get total Betty redemptions count (all time) for reference
    const { count: totalBettyCount } = await supabase
      .from('referral_usage')
      .select('id', { count: 'exact', head: true })
      .eq('code_used', 'BETTY30DAYS');

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
      bettyPromo: {
        totalAllTime: totalBettyCount || 0,
        filteredCount: bettyRedemptionsWithUsers.length,
        redemptions: bettyRedemptionsWithUsers,
        dateFilter,
      },
    });

  } catch (error: any) {
    logger.error('Analytics error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error'
    });
  }
}
