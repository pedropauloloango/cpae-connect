import type { LatLng } from "@/lib/campo-grande-regiao-centroids";
import {
  CAMPO_GRANDE_CENTER,
  centroidForRegiao,
  jitterAround,
} from "@/lib/campo-grande-regiao-centroids";

export type SchoolGeocodeStatus = "ok" | "manual" | "manual_required";

export type SchoolGeoInput = {
  id: string;
  nome: string;
  endereco: string | null;
  bairro: string | null;
  cep: string | null;
  regiao: string | null;
};

export type SchoolGeoPoint = SchoolGeoInput &
  LatLng & {
    source: "address" | "regiao" | "city";
  };

/**
 * Resolve coordenadas para persistir no cadastro (via server function).
 * Manual lat/lng → status manual; geocode ok → ok; senão → manual_required.
 */
export async function resolveSchoolCoordinatesForSave(input: {
  id?: string;
  nome?: string | null;
  endereco: string | null;
  bairro: string | null;
  cep: string | null;
  regiao: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
}): Promise<{
  latitude: number | null;
  longitude: number | null;
  geocode_status: SchoolGeocodeStatus;
}> {
  const { resolveSchoolCoordsFn } = await import("@/lib/geocode-school.functions");
  return resolveSchoolCoordsFn({
    data: {
      id: input.id,
      nome: input.nome ?? null,
      endereco: input.endereco,
      bairro: input.bairro,
      cep: input.cep,
      regiao: input.regiao,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    },
  });
}

/** Fallback legado para mapa (sem lat/lng no banco). */
export async function geocodeSchool(input: SchoolGeoInput): Promise<SchoolGeoPoint> {
  try {
    const coords = await resolveSchoolCoordinatesForSave(input);
    if (coords.latitude != null && coords.longitude != null) {
      return {
        ...input,
        lat: coords.latitude,
        lng: coords.longitude,
        source: coords.geocode_status === "manual" ? "address" : "address",
      };
    }
  } catch {
    /* fall through */
  }
  if (input.regiao?.trim()) {
    const c = jitterAround(centroidForRegiao(input.regiao), input.id);
    return { ...input, ...c, source: "regiao" };
  }
  return { ...input, ...jitterAround(CAMPO_GRANDE_CENTER, input.id, 600), source: "city" };
}

export async function geocodeSchools(inputs: SchoolGeoInput[]): Promise<SchoolGeoPoint[]> {
  const results: SchoolGeoPoint[] = [];
  for (const input of inputs) {
    results.push(await geocodeSchool(input));
  }
  return results;
}
