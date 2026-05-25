
-- Enums
CREATE TYPE public.jenjang AS ENUM ('eselon_ii', 'eselon_iii', 'eselon_iv', 'pokja');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'overdue');
CREATE TYPE public.app_role AS ENUM ('admin', 'kepala', 'sekretaris', 'kasubbag', 'pokja_member');

-- Pokja
CREATE TABLE public.pokja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  jabatan text,
  jenjang public.jenjang NOT NULL DEFAULT 'pokja',
  pokja_id uuid REFERENCES public.pokja(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- User roles (separate table)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Tasks
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assigned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to_pokja uuid REFERENCES public.pokja(id) ON DELETE SET NULL,
  deadline timestamptz,
  status public.task_status NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (assigned_to IS NOT NULL OR assigned_to_pokja IS NOT NULL)
);

-- Reports
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  progress int NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status public.task_status,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Activity log
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- handle_new_user trigger - creates profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jenjang public.jenjang;
  v_role public.app_role;
BEGIN
  v_jenjang := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'jenjang','')::public.jenjang,
    'pokja'
  );
  v_role := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'role','')::public.app_role,
    'pokja_member'
  );

  INSERT INTO public.profiles (id, full_name, jabatan, jenjang)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'jabatan',
    v_jenjang
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pokja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'kepala'));

-- user_roles policies
CREATE POLICY "user_roles_select_auth" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_manage_admin" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'kepala'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'kepala'));

-- pokja policies
CREATE POLICY "pokja_select_auth" ON public.pokja FOR SELECT TO authenticated USING (true);
CREATE POLICY "pokja_manage_leaders" ON public.pokja FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'kepala')
    OR public.has_role(auth.uid(), 'sekretaris')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'kepala')
    OR public.has_role(auth.uid(), 'sekretaris')
  );

-- tasks policies
CREATE POLICY "tasks_select_auth" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "tasks_insert_auth" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = assigned_by);
CREATE POLICY "tasks_update_assigner" ON public.tasks FOR UPDATE TO authenticated
  USING (auth.uid() = assigned_by OR auth.uid() = assigned_to
    OR public.has_role(auth.uid(), 'kepala')
    OR public.has_role(auth.uid(), 'sekretaris'));
CREATE POLICY "tasks_delete_assigner" ON public.tasks FOR DELETE TO authenticated
  USING (auth.uid() = assigned_by OR public.has_role(auth.uid(), 'admin'));

-- reports policies
CREATE POLICY "reports_select_auth" ON public.reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "reports_insert_own" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "reports_update_own" ON public.reports FOR UPDATE TO authenticated
  USING (auth.uid() = reported_by);
CREATE POLICY "reports_delete_own" ON public.reports FOR DELETE TO authenticated
  USING (auth.uid() = reported_by OR public.has_role(auth.uid(), 'admin'));

-- activity_log policies
CREATE POLICY "activity_insert_auth" ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "activity_select_leaders" ON public.activity_log FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'kepala')
    OR public.has_role(auth.uid(), 'sekretaris')
  );

-- Indexes
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_assigned_by ON public.tasks(assigned_by);
CREATE INDEX idx_tasks_pokja ON public.tasks(assigned_to_pokja);
CREATE INDEX idx_reports_task ON public.reports(task_id);
CREATE INDEX idx_profiles_pokja ON public.profiles(pokja_id);
