import {
  isInsideCampoGrande,
  isInsideCampoGrandeMetro,
  isNearSuspiciousGeneric,
  isRuralRegiao,
  type LatLng,
} from "@/lib/campo-grande-regiao-centroids";
import {
  sanitizeCepDigits,
  sanitizeSchoolAddressFields,
} from "@/lib/school-address-sanitize";

const PHOTON_URL = "https://photon.komoot.io/api/";

export type SchoolGeocodeStatus = "ok" | "manual" | "manual_required";

export type SchoolAddressInput = {
  id?: string;
  nome?: string | null;
  endereco: string | null;
  bairro: string | null;
  cep: string | null;
  regiao: string | null;
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    city?: string;
    state?: string;
    countrycode?: string;
    type?: string;
    osm_key?: string;
    osm_value?: string;
    postcode?: string;
    district?: string;
    locality?: string;
  };
};

let lastPhotonAt = 0;

function acceptPoint(point: LatLng, regiao: string | null | undefined): boolean {
  if (isNearSuspiciousGeneric(point)) return false;
  if (isRuralRegiao(regiao)) return isInsideCampoGrandeMetro(point);
  return isInsideCampoGrande(point) || isInsideCampoGrandeMetro(point);
}

function isLowPrecisionPhoton(f: PhotonFeature): boolean {
  const typ = (f.properties?.type ?? "").toLowerCase();
  const osmValue = (f.properties?.osm_value ?? "").toLowerCase();
  if (["city", "county", "state", "country"].includes(typ)) return true;
  if (osmValue === "grave_yard" || osmValue === "cemetery") return true;
  const name = (f.properties?.name ?? "").toLowerCase();
  if (name.includes("cemitério") || name.includes("cemiterio")) return true;
  return false;
}

function cityLooksLikeCampoGrande(f: PhotonFeature): boolean {
  const city = (f.properties?.city ?? "").toLowerCase();
  if (!city) return true; // sem city no hit — validamos pelo bbox depois
  return city.includes("campo grande");
}

async function photonSearch(q: string): Promise<LatLng | null> {
  const query = q.trim();
  if (!query) return null;

  const wait = Math.max(0, 250 - (Date.now() - lastPhotonAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastPhotonAt = Date.now();

  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "5");
  url.searchParams.set("lang", "en");

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn("photonSearch status", res.status);
      return null;
    }
    const data = (await res.json()) as { features?: PhotonFeature[] };
    const features = data.features ?? [];

    const ranked = [...features].sort((a, b) => {
      const score = (f: PhotonFeature) => {
        let s = 0;
        const typ = (f.properties?.type ?? "").toLowerCase();
        const osmValue = (f.properties?.osm_value ?? "").toLowerCase();
        if (typ === "house" || typ === "building") s += 3;
        if (typ === "street" || osmValue === "residential") s += 2;
        if (typ === "school" || osmValue === "school") s += 2.5;
        if (isLowPrecisionPhoton(f)) s -= 5;
        if (!cityLooksLikeCampoGrande(f)) s -= 4;
        return s;
      };
      return score(b) - score(a);
    });

    for (const f of ranked) {
      if (isLowPrecisionPhoton(f)) continue;
      if (!cityLooksLikeCampoGrande(f)) continue;
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;
      const [lng, lat] = coords;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const point = { lat, lng };
      if (isNearSuspiciousGeneric(point)) continue;
      return point;
    }
  } catch (e) {
    console.warn("photonSearch error", e);
  }
  return null;
}

/**
 * Geocodifica com campos higienizados via Photon (Komoot/OSM).
 * BrasilAPI CEP em CG devolve sempre o mesmo ponto genérico — não usamos.
 * Nominatim público está com 429 sob carga — evitamos.
 */
export async function lookupAddressCoordinatesServer(
  input: SchoolAddressInput,
): Promise<LatLng | null> {
  const clean = sanitizeSchoolAddressFields({
    ...input,
    nome: input.nome ?? null,
  });
  const cepDigits = sanitizeCepDigits(clean.cep);

  // 1) Endereço + bairro + CEP + cidade
  if (clean.endereco) {
    const q = [
      clean.endereco,
      clean.bairro,
      cepDigits || null,
      "Campo Grande",
      "Mato Grosso do Sul",
      "Brasil",
    ]
      .filter(Boolean)
      .join(", ");
    const hit = await photonSearch(q);
    if (hit && acceptPoint(hit, clean.regiao)) return hit;
  }

  // 2) Nome da escola + cidade
  if (clean.nome) {
    const hit = await photonSearch(
      `${clean.nome}, escola, Campo Grande, Mato Grosso do Sul, Brasil`,
    );
    if (hit && acceptPoint(hit, clean.regiao)) return hit;
  }

  // 3) Bairro + região (aproximação melhor que nada, ainda dentro da cidade)
  if (clean.bairro) {
    const hit = await photonSearch(
      `${clean.bairro}, Campo Grande, Mato Grosso do Sul, Brasil`,
    );
    if (hit && acceptPoint(hit, clean.regiao)) return hit;
  }

  return null;
}

export function resolveManualOrLookupResult(input: {
  latitude?: string | number | null;
  longitude?: string | number | null;
  hit: LatLng | null;
}): {
  latitude: number | null;
  longitude: number | null;
  geocode_status: SchoolGeocodeStatus;
} {
  const parseCoord = (v: string | number | null | undefined) => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  const manualLat = parseCoord(input.latitude);
  const manualLng = parseCoord(input.longitude);
  if (manualLat != null && manualLng != null) {
    return { latitude: manualLat, longitude: manualLng, geocode_status: "manual" };
  }
  if (input.hit && !isNearSuspiciousGeneric(input.hit)) {
    return { latitude: input.hit.lat, longitude: input.hit.lng, geocode_status: "ok" };
  }
  return { latitude: null, longitude: null, geocode_status: "manual_required" };
}
