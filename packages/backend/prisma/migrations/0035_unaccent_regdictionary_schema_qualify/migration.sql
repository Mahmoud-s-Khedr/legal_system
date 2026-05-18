CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$func$
  SELECT public.unaccent('public.unaccent'::pg_catalog.regdictionary, $1)
$func$;
