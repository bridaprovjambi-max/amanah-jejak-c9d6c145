DO $$
DECLARE
  v_user_id uuid;
  v_new_email text := 'd34r.w3ndy@gmail.com';
  v_old_email text := 'bakibuku.store@gmail.com';
  v_password text := 'AdminDeLapan2026!';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_old_email;

  IF v_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET email = v_new_email,
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', 'Administrator DeLapan'),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_user_id;

    UPDATE auth.identities
    SET identity_data = jsonb_set(
          COALESCE(identity_data, '{}'::jsonb),
          '{email}', to_jsonb(v_new_email)
        ),
        updated_at = now()
    WHERE user_id = v_user_id AND provider = 'email';
  ELSE
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_new_email;

    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
        v_new_email, crypt(v_password, gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', 'Administrator DeLapan'),
        now(), now(), '', '', '', ''
      );

      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_new_email, 'email_verified', true),
        'email', v_user_id::text, now(), now(), now());
    END IF;
  END IF;

  INSERT INTO public.profiles (id, full_name, jenjang)
  VALUES (v_user_id, 'Administrator DeLapan', 'eselon_ii'::public.jenjang)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, jenjang = EXCLUDED.jenjang;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;