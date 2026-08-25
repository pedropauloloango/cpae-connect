/** Centroides aproximados das regiões administrativas de Campo Grande (MS). */
export type LatLng = { lat: number; lng: number };

export const CAMPO_GRANDE_CENTER: LatLng = { lat: -20.4697, lng: -54.6201 };

/** Bounding box aproximado de Campo Grande (south, west, north, east). */
export const CAMPO_GRANDE_BBOX = {
  south: -20.62,
  west: -54.82,
  north: -20.35,
  east: -54.42,
} as const;

/** Área metropolitana / zona rural no entorno de Campo Grande. */
export const CAMPO_GRANDE_METRO_BBOX = {
  south: -20.95,
  west: -55.15,
  north: -20.05,
  east: -54.05,
} as const;

export const CAMPO_GRANDE_REGIAO_CENTROIDS: Record<string, LatLng> = {
  anhanduizinho: { lat: -20.535, lng: -54.655 },
  bandeira: { lat: -20.48, lng: -54.69 },
  centro: { lat: -20.463, lng: -54.616 },
  imbirussu: { lat: -20.425, lng: -54.655 },
  lagoa: { lat: -20.49, lng: -54.54 },
  prosa: { lat: -20.415, lng: -54.545 },
  rural: { lat: -20.58, lng: -54.75 },
  segredo: { lat: -20.53, lng: -54.575 },
};

export function normalizeRegiaoKey(regiao: string | null | undefined): string | null {
  if (!regiao?.trim()) return null;
  return regiao
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ú/g, "u");
}

export function centroidForRegiao(regiao: string | null | undefined): LatLng {
  const key = normalizeRegiaoKey(regiao);
  if (!key) return CAMPO_GRANDE_CENTER;
  return CAMPO_GRANDE_REGIAO_CENTROIDS[key] ?? CAMPO_GRANDE_CENTER;
}

export function isInsideCampoGrande(point: LatLng): boolean {
  return (
    point.lat >= CAMPO_GRANDE_BBOX.south &&
    point.lat <= CAMPO_GRANDE_BBOX.north &&
    point.lng >= CAMPO_GRANDE_BBOX.west &&
    point.lng <= CAMPO_GRANDE_BBOX.east
  );
}

export function isInsideCampoGrandeMetro(point: LatLng): boolean {
  return (
    point.lat >= CAMPO_GRANDE_METRO_BBOX.south &&
    point.lat <= CAMPO_GRANDE_METRO_BBOX.north &&
    point.lng >= CAMPO_GRANDE_METRO_BBOX.west &&
    point.lng <= CAMPO_GRANDE_METRO_BBOX.east
  );
}

export function isRuralRegiao(regiao: string | null | undefined): boolean {
  const key = normalizeRegiaoKey(regiao);
  return key === "rural";
}

/** Distância aproximada em km (Haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Ponto genérico que o geocode antigo atribuiu a várias escolas (Cemitério Santo Amaro). */
export const SUSPICIOUS_GENERIC_POINTS: LatLng[] = [
  { lat: -20.44278, lng: -54.64639 },
  { lat: -20.4428, lng: -54.6464 },
];

export function isNearSuspiciousGeneric(point: LatLng, maxMeters = 80): boolean {
  const maxKm = maxMeters / 1000;
  return SUSPICIOUS_GENERIC_POINTS.some((p) => distanceKm(point, p) <= maxKm);
}

export function isSuspiciousStoredCoords(lat: number | null, lng: number | null): boolean {
  if (lat == null || lng == null) return false;
  return isNearSuspiciousGeneric({ lat, lng }, 120);
}

/**
 * Pequeno deslocamento estável por escola, para não empilhar todos os pontos
 * no mesmo centroide de região.
 */
export function jitterAround(center: LatLng, seed: string, meters = 350): LatLng {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const angle = ((h % 360) * Math.PI) / 180;
  const dist = ((h % 1000) / 1000) * meters;
  const dLat = (dist * Math.cos(angle)) / 111_320;
  const dLng = (dist * Math.sin(angle)) / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  return { lat: center.lat + dLat, lng: center.lng + dLng };
}
