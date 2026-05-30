
-- 1. Prevent non-privileged users from escalating their jenjang/pokja via self profile update
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow admin and kepala to change any field
  IF has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kepala'::app_role) THEN
    RETURN NEW;
  END IF;

  -- For other users, disallow changes to privilege-bearing columns
  IF NEW.jenjang IS DISTINCT FROM OLD.jenjang THEN
    RAISE EXCEPTION 'Not allowed to change jenjang';
  END IF;
  IF NEW.pokja_id IS DISTINCT FROM OLD.pokja_id THEN
    RAISE EXCEPTION 'Not allowed to change pokja_id';
  END IF;
  IF NEW.is_pptk IS DISTINCT FROM OLD.is_pptk THEN
    -- Allow self-toggle of is_pptk (user-declared); keep as allowed.
    NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 2. Add storage UPDATE policy on documents bucket mirroring DELETE
DROP POLICY IF EXISTS "documents_storage_update" ON storage.objects;
CREATE POLICY "documents_storage_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'kepala'::app_role)
    OR has_role(auth.uid(), 'sekretaris'::app_role)
  )
)
WITH CHECK (
  bucket_id = 'documents'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'kepala'::app_role)
    OR has_role(auth.uid(), 'sekretaris'::app_role)
  )
);

-- 3. Restrict task creation to leaders (kepala/sekretaris/admin)
DROP POLICY IF EXISTS "tasks_insert_auth" ON public.tasks;
CREATE POLICY "tasks_insert_auth"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = assigned_by
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'kepala'::app_role)
    OR has_role(auth.uid(), 'sekretaris'::app_role)
  )
);

-- 4. Revoke EXECUTE on has_role from anon/public to address SECURITY DEFINER exposure
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
