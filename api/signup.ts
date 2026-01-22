// api/signup.ts
// Handles user signup with household creation
// Uses service role key to bypass RLS during initial user creation

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PLAN_LIMITS = {
  free: { maxFamily: 3, maxHelpers: 1 },
  core: { maxFamily: 4, maxHelpers: 1 },
  pro: { maxFamily: 8, maxHelpers: 4 },
  test: { maxFamily: 4, maxHelpers: 1 },
} as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clerkId, email, name, role = 'Admin' } = req.body;

  console.log('[Signup API] Received request:', { clerkId, email, name, role });

  if (!clerkId || !email || !name) {
    return res.status(400).json({
      error: `Missing required fields: clerkId=${!!clerkId}, email=${!!email}, name=${!!name}`
    });
  }

  try {
    console.log('[Signup API] Creating user and household for:', { clerkId, email, name });

    // Check if user already exists by clerk_id
    const { data: existingUserByClerkId } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', clerkId)
      .single();

    if (existingUserByClerkId) {
      // If user exists but has no household (was removed), create a new household for them
      if (!existingUserByClerkId.household_id) {
        console.log('[Signup API] User exists but was removed from household, creating new household');
        
        // Create a new household for the removed user
        const { data: newHousehold, error: householdError } = await supabase
          .from('households')
          .insert([{
            name: `${name}'s Family`,
            subscription_plan: 'free',
            max_family_members: PLAN_LIMITS.free.maxFamily,
            max_helpers: PLAN_LIMITS.free.maxHelpers,
            trial_started_at: new Date().toISOString() // Start 14-day feature trial
          }])
          .select()
          .single();

        if (householdError) {
          console.error('[Signup API] Household creation error:', householdError);
          return res.status(500).json({
            error: 'Failed to create household',
            details: householdError
          });
        }

        // Update the user with the new household and set role to Admin
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({ 
            household_id: newHousehold.id,
            role: 'Admin',
            name: name || existingUserByClerkId.name // Update name if provided
          })
          .eq('id', existingUserByClerkId.id)
          .select()
          .single();

        if (updateError) {
          console.error('[Signup API] Failed to update user with new household:', updateError);
          return res.status(500).json({
            error: 'Failed to assign user to new household',
            details: updateError
          });
        }

        console.log('[Signup API] User assigned to new household:', newHousehold.id);
        return res.status(200).json({
          user: updatedUser,
          household: newHousehold,
          message: 'New household created for removed user'
        });
      }

      // User exists and already has a household
      console.log('[Signup API] User already exists (by clerk_id):', existingUserByClerkId);
      return res.status(200).json({
        user: existingUserByClerkId,
        message: 'User already exists'
      });
    }

    // Also check by email (user might exist from production with same email)
    const { data: existingUserByEmail } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (existingUserByEmail) {
      // If user exists but has no household (was removed), create a new household for them
      if (!existingUserByEmail.household_id) {
        console.log('[Signup API] User exists by email but was removed, creating new household');
        
        // Create a new household for the removed user
        const { data: newHousehold, error: householdError } = await supabase
          .from('households')
          .insert([{
            name: `${name}'s Family`,
            subscription_plan: 'free',
            max_family_members: PLAN_LIMITS.free.maxFamily,
            max_helpers: PLAN_LIMITS.free.maxHelpers,
            trial_started_at: new Date().toISOString() // Start 14-day feature trial
          }])
          .select()
          .single();

        if (householdError) {
          console.error('[Signup API] Household creation error:', householdError);
          return res.status(500).json({
            error: 'Failed to create household',
            details: householdError
          });
        }

        // Update the user with the new household, clerk_id, and set role to Admin
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({ 
            household_id: newHousehold.id,
            role: 'Admin',
            clerk_id: clerkId,
            name: name || existingUserByEmail.name
          })
          .eq('id', existingUserByEmail.id)
          .select()
          .single();

        if (updateError) {
          console.error('[Signup API] Failed to update user with new household:', updateError);
          return res.status(500).json({
            error: 'Failed to assign user to new household',
            details: updateError
          });
        }

        console.log('[Signup API] User assigned to new household:', newHousehold.id);
        return res.status(200).json({
          user: updatedUser,
          household: newHousehold,
          message: 'New household created for removed user (found by email)'
        });
      }

      console.log('[Signup API] User found by email, updating clerk_id:', { 
        oldClerkId: existingUserByEmail.clerk_id, 
        newClerkId: clerkId 
      });
      
      // Update the clerk_id to the current one (in case it changed)
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ clerk_id: clerkId })
        .eq('id', existingUserByEmail.id)
        .select()
        .single();

      if (updateError) {
        console.error('[Signup API] Failed to update clerk_id:', updateError);
        // Still return the existing user even if update failed
        return res.status(200).json({
          user: existingUserByEmail,
          message: 'User already exists (clerk_id update failed)'
        });
      }

      console.log('[Signup API] User clerk_id updated successfully');
      return res.status(200).json({
        user: updatedUser || existingUserByEmail,
        message: 'User already exists, clerk_id updated'
      });
    }

    // Create household first
    const { data: newHousehold, error: householdError } = await supabase
      .from('households')
      .insert([{
        name: `${name}'s Family`,
        subscription_plan: 'free',
        max_family_members: PLAN_LIMITS.free.maxFamily,
        max_helpers: PLAN_LIMITS.free.maxHelpers,
        trial_started_at: new Date().toISOString() // Start 14-day feature trial
      }])
      .select()
      .single();

    if (householdError) {
      console.error('[Signup API] Household creation error:', householdError);
      return res.status(500).json({
        error: 'Failed to create household',
        details: householdError
      });
    }

    console.log('[Signup API] Household created:', newHousehold.id);

    // Create user
    const userData = {
      clerk_id: clerkId,
      email: email,
      name: name,
      role: role,
      household_id: newHousehold.id,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${name}`,
      allergies: [],
      preferences: [],
      status: 'active',
      notifications_enabled: true
    };

    console.log('[Signup API] Creating user with data:', userData);

    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert([userData])
      .select()
      .single();

    if (userError) {
      console.error('[Signup API] User creation error:', userError);

      // Clean up the household if user creation failed
      await supabase
        .from('households')
        .delete()
        .eq('id', newHousehold.id);

      return res.status(500).json({
        error: 'Failed to create user',
        details: userError
      });
    }

    console.log('[Signup API] User created successfully:', newUser.id);
    console.log('[Signup API] Returning user data:', { id: newUser.id, name: newUser.name, email: newUser.email });

    return res.status(200).json({
      user: newUser,
      household: newHousehold,
      message: 'User and household created successfully'
    });

  } catch (error) {
    console.error('[Signup API] Unexpected error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}




