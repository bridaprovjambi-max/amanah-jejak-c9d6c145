
CREATE TABLE public.external_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['tasks:create']::text[],
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  note text
);

CREATE INDEX idx_external_api_keys_hash ON public.external_api_keys(key_hash);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_api_keys TO authenticated;
GRANT ALL ON public.external_api_keys TO service_role;

ALTER TABLE public.external_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_select_admin" ON public.external_api_keys
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'kepala'::app_role));

CREATE POLICY "api_keys_insert_admin" ON public.external_api_keys
  FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'kepala'::app_role)) AND auth.uid() = created_by);

CREATE POLICY "api_keys_update_admin" ON public.external_api_keys
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'kepala'::app_role));

CREATE POLICY "api_keys_delete_admin" ON public.external_api_keys
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'kepala'::app_role));
