
CREATE OR REPLACE FUNCTION public.get_public_stats_aggregate()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  tasks_data jsonb;
  pokja_data jsonb;
  docs_count integer;
  users_count integer;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'status', t.status,
    'deadline', t.deadline,
    'created_at', t.created_at,
    'updated_at', t.updated_at,
    'assigned_to_pokja', t.assigned_to_pokja
  )), '[]'::jsonb)
  INTO tasks_data FROM public.tasks t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name)), '[]'::jsonb)
  INTO pokja_data FROM public.pokja p;

  SELECT COUNT(*) INTO docs_count FROM public.documents;
  SELECT COUNT(*) INTO users_count FROM public.profiles;

  result := jsonb_build_object(
    'tasks', tasks_data,
    'pokja', pokja_data,
    'documentsCount', docs_count,
    'usersCount', users_count
  );

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_stats_aggregate() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_stats_aggregate() TO anon, authenticated, service_role;
