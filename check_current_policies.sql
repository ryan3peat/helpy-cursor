-- Check all current policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as "Command",
  qual as "USING Expression",
  with_check as "WITH CHECK Expression"
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;



