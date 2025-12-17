-- Test JWT token decoding
-- This will show us what's in the JWT token

-- First, let's see if we can access the raw JWT
-- Note: This won't work in SQL directly, but we can check the function

SELECT
  'JWT Function Test' as test,
  get_clerk_id() as clerk_id_result,
  CASE
    WHEN get_clerk_id() IS NULL THEN '❌ No JWT token received by database'
    ELSE '✅ JWT token received, clerk_id extracted: ' || get_clerk_id()
  END as status;

-- Check if the JWT contains the expected claims
-- We'll need to decode it manually in the browser console

-- For now, let's check what the get_clerk_id function is doing
SELECT
  'Function Analysis' as test,
  'get_clerk_id() extracts clerk_id from JWT claims' as description,
  'If NULL, either no JWT sent or missing clerk_id claim' as diagnosis;



