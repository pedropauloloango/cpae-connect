import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  lookupAddressCoordinatesServer,
  resolveManualOrLookupResult,
} from "@/lib/geocode-school.server";
import { sanitizeSchoolAddressFields } from "@/lib/school-address-sanitize";

const addressSchema = z.object({
  id: z.string().optional(),
  nome: z.string().nullable().optional(),
  endereco: z.string().nullable().optional(),
  bairro: z.string().nullable().optional(),
  cep: z.string().nullable().optional(),
  regiao: z.string().nullable().optional(),
  latitude: z.union([z.string(), z.number()]).nullable().optional(),
  longitude: z.union([z.string(), z.number()]).nullable().optional(),
});

/** Resolve coordenadas de uma escola (manual ou geocode no servidor). */
export const resolveSchoolCoordsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => addressSchema.parse(d))
  .handler(async ({ data }) => {
    const parseCoord = (v: string | number | null | undefined) => {
      if (v == null || v === "") return null;
      const n = typeof v === "number" ? v : Number(String(v).trim().replace(",", "."));
      return Number.isFinite(n) ? n : null;
    };
    if (parseCoord(data.latitude) != null && parseCoord(data.longitude) != null) {
      return resolveManualOrLookupResult({
        latitude: data.latitude,
        longitude: data.longitude,
        hit: null,
      });
    }

    const hit = await lookupAddressCoordinatesServer({
      id: data.id,
      nome: data.nome ?? null,
      endereco: data.endereco ?? null,
      bairro: data.bairro ?? null,
      cep: data.cep ?? null,
      regiao: data.regiao ?? null,
    });

    return resolveManualOrLookupResult({ hit, latitude: null, longitude: null });
  });

const batchItemSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().nullable(),
  endereco: z.string().nullable(),
  bairro: z.string().nullable(),
  cep: z.string().nullable(),
  regiao: z.string().nullable(),
});

/**
 * Geocodifica um lote (máx. 15): higieniza endereço/bairro/CEP, grava campos limpos + lat/lng.
 * Processar em lotes no cliente para não estourar timeout e exibir progresso.
 */
export const geocodeSchoolsBatchFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        schools: z.array(batchItemSchema).min(1).max(15),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let ok = 0;
    let stillPending = 0;
    const results: Array<{
      id: string;
      geocode_status: string;
      latitude: number | null;
      longitude: number | null;
    }> = [];

    for (const school of data.schools) {
      const clean = sanitizeSchoolAddressFields(school);
      const hit = await lookupAddressCoordinatesServer({
        id: school.id,
        nome: school.nome ?? clean.nome,
        endereco: clean.endereco,
        bairro: clean.bairro,
        cep: clean.cep,
        regiao: clean.regiao,
      });
      const coords = resolveManualOrLookupResult({ hit, latitude: null, longitude: null });

      const { error } = await supabaseAdmin
        .from("schools")
        .update({
          endereco: clean.endereco,
          bairro: clean.bairro,
          cep: clean.cep,
          regiao: clean.regiao ?? school.regiao,
          latitude: coords.latitude,
          longitude: coords.longitude,
          geocode_status: coords.geocode_status,
        })
        .eq("id", school.id);

      if (error) {
        console.error("geocodeSchoolsBatchFn update", school.id, error);
        stillPending += 1;
        results.push({
          id: school.id,
          geocode_status: "manual_required",
          latitude: null,
          longitude: null,
        });
        continue;
      }

      if (coords.geocode_status === "ok") ok += 1;
      else stillPending += 1;
      results.push({
        id: school.id,
        geocode_status: coords.geocode_status,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    }

    return {
      processed: data.schools.length,
      ok,
      stillPending,
      results,
    };
  });
