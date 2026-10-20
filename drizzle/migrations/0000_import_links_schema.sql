CREATE TABLE public.links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  destination_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  click_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT links_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  CONSTRAINT links_destination_protocol CHECK (destination_url ~* '^https?://')
);

CREATE TABLE public.click_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id uuid NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  referrer text
);

CREATE INDEX links_slug_active_idx ON public.links (slug) WHERE is_active;
CREATE INDEX links_created_by_idx ON public.links (created_by, created_at DESC);
CREATE INDEX click_events_link_time_idx ON public.click_events (link_id, clicked_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.links TO authenticated;
GRANT ALL ON public.links TO service_role;
GRANT SELECT ON public.click_events TO authenticated;
GRANT ALL ON public.click_events TO service_role;

ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.click_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own links" ON public.links
  FOR ALL TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users view clicks for their own links" ON public.click_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.links l WHERE l.id = link_id AND l.created_by = auth.uid()));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_links_updated_at BEFORE UPDATE ON public.links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.resolve_link(_slug text, _referrer text DEFAULT NULL)
RETURNS TABLE (destination_url text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _link_id uuid;
  _resolved_destination text;
  _is_active boolean;
BEGIN
  SELECT l.id, l.destination_url, l.is_active
    INTO _link_id, _resolved_destination, _is_active
  FROM public.links AS l
  WHERE l.slug = lower(_slug);

  IF _link_id IS NULL THEN
    RETURN QUERY SELECT NULL::text, 'not_found'::text;
    RETURN;
  END IF;

  IF NOT _is_active THEN
    RETURN QUERY SELECT NULL::text, 'disabled'::text;
    RETURN;
  END IF;

  INSERT INTO public.click_events (link_id, referrer)
  VALUES (_link_id, left(_referrer, 500));

  RETURN QUERY SELECT _resolved_destination, 'ok'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_link(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_link(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_link(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_link(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.lookup_link(_slug text)
RETURNS TABLE (link_id uuid, destination_url text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    CASE WHEN l.is_active THEN l.destination_url ELSE NULL END,
    CASE WHEN l.is_active THEN 'ok' ELSE 'disabled' END
  FROM public.links AS l
  WHERE l.slug = lower(_slug)
  UNION ALL
  SELECT NULL::uuid, NULL::text, 'not_found'::text
  WHERE NOT EXISTS (SELECT 1 FROM public.links AS l2 WHERE l2.slug = lower(_slug))
$$;

REVOKE ALL ON FUNCTION public.lookup_link(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lookup_link(text) FROM anon;
REVOKE ALL ON FUNCTION public.lookup_link(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_link(text) TO service_role;

CREATE OR REPLACE FUNCTION public.log_click(_link_id uuid, _referrer text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.click_events (link_id, referrer)
  VALUES (_link_id, left(_referrer, 500));
END;
$$;

REVOKE ALL ON FUNCTION public.log_click(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_click(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.log_click(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.log_click(uuid, text) TO service_role;