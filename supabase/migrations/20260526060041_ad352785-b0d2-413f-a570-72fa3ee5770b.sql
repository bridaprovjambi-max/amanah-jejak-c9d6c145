CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Always create a profile at the safest default jenjang.
  -- Role is hard-coded to 'pokja_member' to prevent privilege escalation
  -- via user-controlled raw_user_meta_data. Admins must elevate roles
  -- afterwards via the Users admin panel.
  INSERT INTO public.profiles (id, full_name, jabatan, jenjang)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'jabatan',
    'pokja'::public.jenjang
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'pokja_member'::public.app_role);

  RETURN NEW;
END;
$function$;

-- Demote any existing privileged roles that were self-assigned via the old flow,
-- EXCEPT keep the very first admin/kepala (if any) so an operator can elevate others.
-- (No-op safe: if there are none, nothing changes.)
WITH keepers AS (
  SELECT DISTINCT ON (role) id
  FROM public.user_roles
  WHERE role IN ('admin','kepala')
  ORDER BY role, created_at ASC
)
DELETE FROM public.user_roles ur
WHERE ur.role IN ('admin','kepala','sekretaris','kasubbag')
  AND ur.id NOT IN (SELECT id FROM keepers);

-- Ensure every user still has at least the pokja_member role.
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'pokja_member'::public.app_role
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id
);