import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { Expand, Minimize2 } from "lucide-react";
import { CAMPO_GRANDE_CENTER } from "@/lib/campo-grande-regiao-centroids";
import {
  situacaoObservadaChartLabel,
  situacaoObservadaChartSortIndex,
} from "@/lib/acolhimento-options";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type HeatSchoolCount = {
  id: string;
  nome: string;
  endereco: string | null;
  bairro: string | null;
  cep: string | null;
  regiao: string | null;
  latitude: number | null;
  longitude: number | null;
  geocode_status: string | null;
  /** Total de demandas (todas as queixas). */
  count: number;
  /** Contagem por tipo_queixa. */
  byTipo: Record<string, number>;
};

type GeoSchool = HeatSchoolCount & { lat: number; lng: number; filteredCount: number };

declare module "leaflet" {
  function heatLayer(
    latlngs: Array<[number, number, number?]>,
    options?: {
      minOpacity?: number;
      maxZoom?: number;
      max?: number;
      radius?: number;
      blur?: number;
      gradient?: Record<number, string>;
    },
  ): L.Layer;
}


function HeatLayer({ points, maxWeight }: { points: Array<[number, number, number]>; maxWeight: number }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    const layer = L.heatLayer(points, {
      radius: 28,
      blur: 22,
      maxZoom: 16,
      max: Math.max(maxWeight, 1),
      minOpacity: 0.35,
      gradient: {
        0.2: "#93c5fd",
        0.4: "#60a5fa",
        0.6: "#fbbf24",
        0.8: "#f97316",
        1.0: "#dc2626",
      },
    });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points, maxWeight]);

  return null;
}

function FitBounds({ schools }: { schools: GeoSchool[] }) {
  const map = useMap();
  useEffect(() => {
    if (schools.length === 0) return;
    if (schools.length === 1) {
      map.setView([schools[0].lat, schools[0].lng], 13);
      return;
    }
    const bounds = L.latLngBounds(schools.map((s) => [s.lat, s.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.15));
  }, [map, schools]);
  return null;
}

function InvalidateSize({ trigger }: { trigger: string | number | boolean }) {
  const map = useMap();
  useEffect(() => {
    const t = window.setTimeout(() => {
      map.invalidateSize();
    }, 80);
    return () => window.clearTimeout(t);
  }, [map, trigger]);
  return null;
}

function countForFilter(school: HeatSchoolCount, selectedTipos: Set<string>): number {
  if (selectedTipos.size === 0) return school.count;
  let n = 0;
  for (const tipo of selectedTipos) {
    n += school.byTipo[tipo] ?? 0;
  }
  return n;
}

function MapView({
  geoSchools,
  heightClass,
  mapKey,
}: {
  geoSchools: GeoSchool[];
  heightClass: string;
  mapKey: string;
}) {
  const heatPoints = useMemo(
    () => geoSchools.map((s) => [s.lat, s.lng, s.filteredCount] as [number, number, number]),
    [geoSchools],
  );
  const maxWeight = useMemo(
    () => geoSchools.reduce((max, s) => Math.max(max, s.filteredCount), 0),
    [geoSchools],
  );

  return (
    <MapContainer
      key={mapKey}
      center={[CAMPO_GRANDE_CENTER.lat, CAMPO_GRANDE_CENTER.lng]}
      zoom={12}
      className={cn("z-0 w-full", heightClass)}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {heatPoints.length > 0 && <HeatLayer points={heatPoints} maxWeight={maxWeight} />}
      <FitBounds schools={geoSchools} />
      <InvalidateSize trigger={mapKey} />
      {geoSchools.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.lat, s.lng]}
          radius={Math.min(6 + s.filteredCount, 18)}
          pathOptions={{
            color: "#0F52BA",
            fillColor: "#0F52BA",
            fillOpacity: 0.55,
            weight: 1,
          }}
        >
          <Popup>
            <div className="space-y-0.5 text-sm">
              <div className="font-semibold text-[#0F172A]">{s.nome}</div>
              <div>
                <span className="font-medium tabular-nums">{s.filteredCount}</span>{" "}
                {s.filteredCount === 1 ? "demanda" : "demandas"}
              </div>
              {(s.endereco || s.bairro) && (
                <div className="text-xs text-muted-foreground">
                  {[s.endereco, s.bairro].filter(Boolean).join(" — ")}
                </div>
              )}
              {s.regiao && (
                <div className="text-xs text-muted-foreground">Região: {s.regiao}</div>
              )}
              <div className="text-[11px] text-muted-foreground">
                {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
                {s.geocode_status === "manual" ? " · manual" : ""}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

export function ComplaintsHeatMap({ schools }: { schools: HeatSchoolCount[] }) {
  const [selectedTipos, setSelectedTipos] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState(false);

  const availableTipos = useMemo(() => {
    const present = new Set<string>();
    for (const s of schools) {
      for (const [tipo, n] of Object.entries(s.byTipo ?? {})) {
        if (n > 0) present.add(tipo);
      }
    }
    return [...present].sort(
      (a, b) => situacaoObservadaChartSortIndex(a) - situacaoObservadaChartSortIndex(b),
    );
  }, [schools]);

  const geoSchools = useMemo(() => {
    return schools
      .map((s) => {
        const filteredCount = countForFilter(s, selectedTipos);
        if (filteredCount <= 0) return null;
        if (
          typeof s.latitude !== "number" ||
          typeof s.longitude !== "number" ||
          !Number.isFinite(s.latitude) ||
          !Number.isFinite(s.longitude)
        ) {
          return null;
        }
        return {
          ...s,
          lat: s.latitude,
          lng: s.longitude,
          filteredCount,
        } satisfies GeoSchool;
      })
      .filter((s): s is GeoSchool => s != null);
  }, [schools, selectedTipos]);

  const schoolsWithCoords = useMemo(
    () =>
      schools.filter(
        (s) =>
          typeof s.latitude === "number" &&
          typeof s.longitude === "number" &&
          Number.isFinite(s.latitude) &&
          Number.isFinite(s.longitude),
      ).length,
    [schools],
  );
  const pendingCount = schools.length - schoolsWithCoords;

  const filterKey = selectedTipos.size === 0 ? "all" : [...selectedTipos].sort().join(",");

  const toggleTipo = (tipo: string) => {
    setSelectedTipos((prev) => {
      const next = new Set(prev);
      if (next.has(tipo)) next.delete(tipo);
      else next.add(tipo);
      return next;
    });
  };

  const filterBar = (
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-3 py-2">
      <span className="text-xs font-medium text-[#0F172A]">Tipo de queixa:</span>
      <Button
        type="button"
        size="sm"
        variant={selectedTipos.size === 0 ? "default" : "outline"}
        className="h-7 text-xs"
        onClick={() => setSelectedTipos(new Set())}
      >
        Todas
      </Button>
      {availableTipos.map((tipo) => {
        const active = selectedTipos.has(tipo);
        return (
          <Button
            key={tipo}
            type="button"
            size="sm"
            variant={active ? "default" : "outline"}
            className={cn("h-7 text-xs", active && "bg-[#0F52BA] hover:bg-[#0F52BA]/90")}
            onClick={() => toggleTipo(tipo)}
          >
            {situacaoObservadaChartLabel(tipo)}
          </Button>
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="ml-auto h-7 gap-1.5 text-xs"
        onClick={() => setExpanded(true)}
      >
        <Expand className="h-3.5 w-3.5" />
        Ampliar
      </Button>
    </div>
  );

  const legend = (
    <div className="flex flex-wrap items-center gap-3 border-t bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
      <span className="font-medium text-[#0F172A]">Intensidade = nº de demandas</span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-[#93c5fd]" /> Baixa
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-[#fbbf24]" /> Média
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-[#dc2626]" /> Alta
      </span>
      <span className="ml-auto">
        {geoSchools.length} no mapa
        {pendingCount > 0 ? ` · ${pendingCount} pendente(s)` : ""}
        {selectedTipos.size > 0
          ? ` · filtro: ${[...selectedTipos].map((t) => situacaoObservadaChartLabel(t)).join(", ")}`
          : ""}
      </span>
    </div>
  );

  if (schools.length === 0) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Nenhuma demanda com escola vinculada para montar o mapa.
      </div>
    );
  }

  if (schoolsWithCoords === 0) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">
        <p>Nenhuma escola com coordenadas cadastradas.</p>
        <p className="text-xs">
          Em <strong>Escolas</strong>, use “Localizar pendentes” ou preencha latitude/longitude manualmente.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-lg border">
        {filterBar}
        {pendingCount > 0 && (
          <div className="absolute left-3 top-14 z-[1000] max-w-sm rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow">
            {pendingCount} escola(s) sem coordenadas — não aparecem no mapa. Complete em Escolas.
          </div>
        )}
        {geoSchools.length === 0 ? (
          <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
            Nenhuma escola com demandas para o filtro selecionado.
          </div>
        ) : (
          <MapView
            geoSchools={geoSchools}
            heightClass="h-[420px]"
            mapKey={`compact-${filterKey}`}
          />
        )}
        {legend}
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent
          className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0"
          hideCloseButton
        >
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b px-4 py-3">
            <DialogTitle className="text-base">Mapa de calor — queixas por escola</DialogTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => setExpanded(false)}
            >
              <Minimize2 className="h-3.5 w-3.5" />
              Fechar
            </Button>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-3 py-2">
              <span className="text-xs font-medium text-[#0F172A]">Tipo de queixa:</span>
              <Button
                type="button"
                size="sm"
                variant={selectedTipos.size === 0 ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setSelectedTipos(new Set())}
              >
                Todas
              </Button>
              {availableTipos.map((tipo) => {
                const active = selectedTipos.has(tipo);
                return (
                  <Button
                    key={tipo}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    className={cn("h-7 text-xs", active && "bg-[#0F52BA] hover:bg-[#0F52BA]/90")}
                    onClick={() => toggleTipo(tipo)}
                  >
                    {situacaoObservadaChartLabel(tipo)}
                  </Button>
                );
              })}
            </div>
            <div className="relative min-h-0 flex-1">
              {geoSchools.length === 0 ? (
                <div className="flex h-full min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
                  Nenhuma escola com demandas para o filtro selecionado.
                </div>
              ) : (
                <div className="absolute inset-0">
                  <MapView
                    geoSchools={geoSchools}
                    heightClass="h-full"
                    mapKey={`expanded-${filterKey}-${expanded}`}
                  />
                </div>
              )}
            </div>
            {legend}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
