-- Check current household policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as "Command",
  qual as "USING Expression",
  with_check as "WITH CHECK Expression"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'households'
ORDER BY cmd, policyname;




