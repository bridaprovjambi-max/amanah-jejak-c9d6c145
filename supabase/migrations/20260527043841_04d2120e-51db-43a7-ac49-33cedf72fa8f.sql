DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Check if admin already exists
  SELECT id INTO new_user_id FROM auth.users WHERE email = 'admin@admin.com';

  IF new_user_id IS NULL THEN
    new_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      'admin@admin.com',
      crypt('admin123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Administrator"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
    VALUES (
      gen_random_uuid(), new_user_id, new_user_id::text,
      jsonb_build_object('sub', new_user_id::text, 'email', 'admin@admin.com', 'email_verified', true),
      'email', now(), now(), now()
    );
  END IF;

  -- Ensure profile
  INSERT INTO public.profiles (id, full_name, jabatan, jenjang)
  VALUES (new_user_id, 'Administrator', 'Admin Sistem', 'pokja'::public.jenjang)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  -- Ensure admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;