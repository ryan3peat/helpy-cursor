-- TEMPORARY: Allow household access for debugging
-- This temporarily allows all authenticated users to read households
-- REMOVE THIS AFTER DEBUGGING

DROP POLICY IF EXISTS "Users can view their household" ON households;

CREATE POLICY "TEMP: Allow authenticated users to view households"
ON households FOR SELECT
USING (get_clerk_id() IS NOT NULL);

-- This will allow the household fetch to work for testing
-- But it's not secure - remove after identifying the issue



