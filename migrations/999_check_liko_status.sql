DO $$
DECLARE
  v_user_id uuid;
  v_enabled boolean;
  v_sub_count int;
  v_name text := 'Liko';
BEGIN
  -- Get User ID and Status
  SELECT id, notifications_enabled INTO v_user_id, v_enabled
  FROM users WHERE name = v_name LIMIT 1;

  -- Get Subscription Count
  SELECT count(*) INTO v_sub_count
  FROM push_subscriptions
  WHERE user_id = v_user_id;

  RAISE NOTICE 'User: %, ID: %, Enabled: %, Subscriptions: %', v_name, v_user_id, v_enabled, v_sub_count;
END $$;
