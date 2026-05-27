ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nip text,
  ADD COLUMN IF NOT EXISTS pangkat_golongan text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, jabatan, nip, pangkat_golongan, jenjang)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'jabatan',
    NEW.raw_user_meta_data->>'nip',
    NEW.raw_user_meta_data->>'pangkat_golongan',
    'pokja'::public.jenjang
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'pokja_member'::public.app_role);

  RETURN NEW;
END;
$function$;