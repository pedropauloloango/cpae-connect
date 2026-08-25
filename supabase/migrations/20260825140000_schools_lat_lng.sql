-- Coordenadas geográficas das escolas para mapa de calor / localização.
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geocode_status TEXT;

COMMENT ON COLUMN public.schools.latitude IS 'Latitude WGS84 (preenchida automaticamente ou manualmente)';
COMMENT ON COLUMN public.schools.longitude IS 'Longitude WGS84 (preenchida automaticamente ou manualmente)';
COMMENT ON COLUMN public.schools.geocode_status IS
  'ok = geocodificado pelo endereço; manual = informado manualmente; manual_required = precisa preenchimento manual';

ALTER TABLE public.schools
  DROP CONSTRAINT IF EXISTS schools_geocode_status_check;

ALTER TABLE public.schools
  ADD CONSTRAINT schools_geocode_status_check
  CHECK (
    geocode_status IS NULL
    OR geocode_status IN ('ok', 'manual', 'manual_required')
  );

-- Demanda preenchimento manual quando ainda não há coordenadas.
UPDATE public.schools
SET geocode_status = 'manual_required'
WHERE deleted_at IS NULL
  AND latitude IS NULL
  AND longitude IS NULL
  AND (geocode_status IS NULL OR geocode_status = '');
