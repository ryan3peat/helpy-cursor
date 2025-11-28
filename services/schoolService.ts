
// services/schoolService.ts
import { createClient } from "@supabase/supabase-js";
import type { School } from "@/src/types/school";

/**
 * Create Supabase client
 * - Expects VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your env
 */
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

/**
 * List schools for a household.
 * Requires the current user to be authenticated and to pass RLS (creator-only by your current policies).
 */
export async function listSchoolsByHousehold(householdId: string): Promise<School[]> {
  // SELECT * FROM public.schools WHERE household_id = :householdId ORDER BY created_at DESC
  const { data, error } = await supabase
    .from("schools")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as School[];
}

/**
 * Create a school for a household.
 * Inserts created_by = auth.uid(), required by your RLS "creator-only" policies.
 */
export async function createSchoolForHousehold(
  householdId: string,
  payload: Omit<School, "id">
): Promise<School> {
  // Get current authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user?.id) {
    throw new Error("Not authenticated. Please sign in before creating a school.");
  }

  // INSERT INTO public.schools (...) VALUES (..., created_by = auth.uid())
  const { data, error } = await supabase
    .from("schools")
    .insert([
      {
        ...payload,
        household_id: householdId,
        created_by: user.id,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as School;
}

/**
 * Update an existing school row.
 * Must pass RLS: only the creator of the row (created_by == auth.uid()) can update.
 */
export async function updateSchoolForHousehold(householdId: string, school: School): Promise<School> {
  // Optional: confirm auth for clearer error messaging
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("Not authenticated. Please sign in before updating a school.");

  const { data, error } = await supabase
    .from("schools")
    .update({
      // Keep fields aligned with your School type
      name: school.name,
      type: school.type ?? null,
      address: school.address ?? null,
      city: school.city ?? null,
      state: school.state ?? null,
      country: school.country ?? null,
      phone: school.phone ?? null,
      website: school.website ?? null,
      description: school.description ?? null,
      household_id: householdId,
    })
    .eq("id", school.id)
    .select()
    .single();

  if (error) throw error;
  return data as School;
}

/** (Optional) Delete — only if you want it in the UI */
export async function deleteSchool(id: string): Promise<void> {
  const { error } = await supabase.from("schools").delete().eq("id", id);
  if (error) throw error;
}
