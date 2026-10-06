import { regiaoEscolaLabel } from "@/lib/acolhimento-options";
import {
  moduloCursoOptions,
  nivelEscolaridadeLabels,
  normalizeCpfDigits,
  normalizeNivelEscolaridade,
  sexoLabels,
  sexoOptions,
} from "@/lib/saude-mental-options";
import {
  buildPresencaKey,
  buildPresencaSet,
  calcPresencaTotais,
  calcPresencaTotaisEncontro,
  isListaPresencaFechada,
  sortEncontrosChronologicamente,
  todayIsoDate,
  type PresencaEncontroRef,
  type PresencaInscritoRef,
} from "@/lib/saude-mental-presenca-dashboard";

export const SEM_VINCULO_LABEL = "Sem vínculo";
export const SEM_REGIAO_LABEL = "Sem região";
export const SEXO_NAO_INFORMADO = "Não informado";

export type SmDashInscrito = {
  id: string;
  schoolId: string | null;
  escolaNome: string;
  regiao: string | null;
  regiaoLabel: string;
  sexo: string | null;
  funcao: string | null;
  nivelEscolaridade: string | null;
  status: string;
  anoCurso: number;
  cpf: string | null;
};

export type SmDashFiltros = {
  regiao: string;
  escola: string;
  modulo: string;
  sexo: string;
};

export const FILTROS_DASHBOARD_INICIAIS: SmDashFiltros = {
  regiao: "todas",
  escola: "todas",
  modulo: "todos",
  sexo: "todos",
};

export type SmDashEncontro = PresencaEncontroRef & {
  local: string;
  qr_ativo: boolean;
  qr_expires_at: string | null;
};

export type SmDashPresenca = {
  id: string;
  inscrito_id: string;
  encontro_id: string;
  origem: string;
  cpfInformado: string | null;
};

export type SexoSlice = { name: string; value: number; fill: string };

export type ContagemBar = { name: string; value: number; rotulo: string };

export type RegiaoComparacao = {
  name: string;
  inscritos: number;
  presencas: number;
  percentual: number;
  rotuloPresenca: string;
};

export type ModuloBar = {
  name: string;
  pct: number | null;
  presentes: number;
  rotulo: string;
  detalhe: string;
  estado: "fechada" | "aberta" | "futuro" | "sem_encontro";
};

export type EncontroResumo = {
  id: string;
  modulo: string;
  data: string;
  horario: string;
  local: string;
  qrAtivo: boolean;
  qrExpiresAt: string | null;
  listaFechada: boolean;
  presentes: number;
  inscritos: number;
  pct: number;
  viaQr: number;
  viaManual: number;
};

export type SaudeMentalDashboardData = {
  inscritos: number;
  escolas: number;
  semVinculo: number;
  mediaParticipacaoPct: number | null;
  listasEmAberto: number;
  regiaoComparacao: RegiaoComparacao[];
  sexo: SexoSlice[];
  funcao: ContagemBar[];
  escolaridade: ContagemBar[];
  modulos: ModuloBar[];
  proximo: EncontroResumo | null;
  ultimo: EncontroResumo | null;
};

const SEXO_CORES: Record<string, string> = {
  feminino: "#7c3aed",
  masculino: "#60a5fa",
  outros: "#c4b5fd",
  nao_informado: "#93c5fd",
};

function moduloCurto(modulo: string): string {
  const n = modulo.match(/\d+/);
  return n ? `M${n[0]}` : modulo;
}

function toInscritoRef(row: SmDashInscrito): PresencaInscritoRef {
  return {
    id: row.id,
    nome_completo: "",
    cpf: null,
    escola_texto: null,
    school_nome_snapshot: null,
    ano_curso: row.anoCurso,
  };
}

function resumoEncontro(
  encontro: SmDashEncontro,
  inscritos: PresencaInscritoRef[],
  presencas: SmDashPresenca[],
  presencaSet: Set<string>,
): EncontroResumo {
  const totais = calcPresencaTotaisEncontro(inscritos, encontro, presencaSet);
  let viaQr = 0;
  let viaManual = 0;
  for (const p of presencas) {
    if (p.encontro_id !== encontro.id) continue;
    if (p.origem === "qrcode") viaQr += 1;
    else viaManual += 1;
  }
  return {
    id: encontro.id,
    modulo: encontro.modulo_curso,
    data: encontro.data,
    horario: encontro.horario,
    local: encontro.local,
    qrAtivo: encontro.qr_ativo,
    qrExpiresAt: encontro.qr_expires_at,
    listaFechada: isListaPresencaFechada(encontro),
    presentes: totais.presencasRegistradas,
    inscritos: totais.inscritos,
    pct: totais.mediaParticipacaoPct,
    viaQr,
    viaManual,
  };
}

export function labelRegiaoInscrito(row: { schoolId: string | null; regiao: string | null }): string {
  if (!row.schoolId) return SEM_VINCULO_LABEL;
  if (!row.regiao?.trim()) return SEM_REGIAO_LABEL;
  return regiaoEscolaLabel(row.regiao) || row.regiao.trim();
}

function regiaoDoInscrito(row: SmDashInscrito): string {
  return row.regiaoLabel || labelRegiaoInscrito(row);
}

export function filtrarFonteDashboard(
  fonte: {
    inscritos: SmDashInscrito[];
    encontros: SmDashEncontro[];
    presencas: SmDashPresenca[];
  },
  filtros: SmDashFiltros,
) {
  let inscritos = fonte.inscritos;
  if (filtros.regiao !== "todas") {
    inscritos = inscritos.filter((row) => regiaoDoInscrito(row) === filtros.regiao);
  }
  if (filtros.escola !== "todas") {
    inscritos = inscritos.filter((row) => (row.schoolId ?? "sem-vinculo") === filtros.escola);
  }
  if (filtros.sexo === "nao_informado") {
    inscritos = inscritos.filter((row) => !row.sexo || !sexoLabels[row.sexo]);
  } else if (filtros.sexo !== "todos") {
    inscritos = inscritos.filter((row) => row.sexo === filtros.sexo);
  }

  let encontros = fonte.encontros;
  if (filtros.modulo !== "todos") {
    encontros = encontros.filter((row) => row.modulo_curso === filtros.modulo);
  }

  const ids = new Set(inscritos.map((row) => row.id));
  const encontroIds = new Set(encontros.map((row) => row.id));
  const presencas = fonte.presencas.filter(
    (row) => ids.has(row.inscrito_id) && encontroIds.has(row.encontro_id),
  );

  return { inscritos, encontros, presencas };
}

function cpfDistinto(presenca: SmDashPresenca, cpfInscrito: string | null | undefined): string {
  const informado = normalizeCpfDigits(presenca.cpfInformado);
  if (informado) return informado;
  const doInscrito = normalizeCpfDigits(cpfInscrito);
  if (doInscrito) return doInscrito;
  return `inscrito:${presenca.inscrito_id}`;
}

/** CPFs distintos com presença registrada ÷ inscritos da região. */
export function buildRegiaoComparacao(
  inscritos: SmDashInscrito[],
  presencas: SmDashPresenca[],
): RegiaoComparacao[] {
  const porRegiao = new Map<string, { inscritos: number; cpfs: Set<string> }>();
  const idRegiao = new Map<string, string>();
  const cpfPorInscrito = new Map<string, string | null>();

  for (const row of inscritos) {
    const name = regiaoDoInscrito(row);
    const bucket = porRegiao.get(name) ?? { inscritos: 0, cpfs: new Set<string>() };
    bucket.inscritos += 1;
    porRegiao.set(name, bucket);
    idRegiao.set(row.id, name);
    cpfPorInscrito.set(row.id, row.cpf);
  }

  for (const presenca of presencas) {
    const name = idRegiao.get(presenca.inscrito_id);
    if (!name) continue;
    const bucket = porRegiao.get(name);
    if (!bucket) continue;
    bucket.cpfs.add(cpfDistinto(presenca, cpfPorInscrito.get(presenca.inscrito_id)));
  }

  return [...porRegiao.entries()]
    .filter(([, counts]) => counts.inscritos > 0)
    .map(([name, counts]) => {
      const presencasDistintas = counts.cpfs.size;
      const percentual =
        counts.inscritos > 0 ? Math.round((presencasDistintas / counts.inscritos) * 100) : 0;
      return {
        name,
        inscritos: counts.inscritos,
        presencas: presencasDistintas,
        percentual,
        rotuloPresenca: `${presencasDistintas} (${percentual}%)`,
      };
    })
    .sort((a, b) => b.percentual - a.percentual || b.inscritos - a.inscritos);
}

export function buildSexoChart(inscritos: SmDashInscrito[]): SexoSlice[] {
  const counts = new Map<string, number>();
  for (const opt of sexoOptions) counts.set(opt.value, 0);
  counts.set("nao_informado", 0);

  for (const row of inscritos) {
    const key = row.sexo && sexoLabels[row.sexo] ? row.sexo : "nao_informado";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const slices: SexoSlice[] = [
    ...sexoOptions.map((opt) => ({
      name: opt.label,
      value: counts.get(opt.value) ?? 0,
      fill: SEXO_CORES[opt.value] ?? "#8b5cf6",
    })),
    {
      name: SEXO_NAO_INFORMADO,
      value: counts.get("nao_informado") ?? 0,
      fill: SEXO_CORES.nao_informado,
    },
  ];

  return slices.filter((slice) => slice.value > 0);
}

function rotuloContagem(value: number, total: number): string {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return `${value} (${pct}%)`;
}

function ordenarContagem(itens: ContagemBar[]): ContagemBar[] {
  return itens.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pt-BR"));
}

export function buildFuncaoChart(inscritos: SmDashInscrito[]): ContagemBar[] {
  const grupos = new Map<string, { name: string; value: number }>();
  for (const row of inscritos) {
    const texto = row.funcao?.replace(/\s+/g, " ").trim() ?? "";
    const key = texto
      ? texto
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{M}/gu, "")
      : "nao_informado";
    const atual = grupos.get(key);
    if (atual) atual.value += 1;
    else grupos.set(key, { name: texto || "Não informado", value: 1 });
  }
  const total = inscritos.length;
  return ordenarContagem(
    [...grupos.values()].map((item) => ({
      ...item,
      rotulo: rotuloContagem(item.value, total),
    })),
  );
}

function labelEscolaridade(raw: string | null): string {
  const texto = raw?.trim() ?? "";
  if (!texto) return "Não informado";
  if (nivelEscolaridadeLabels[texto]) return nivelEscolaridadeLabels[texto];
  const canonico = normalizeNivelEscolaridade(texto);
  return nivelEscolaridadeLabels[canonico] ?? canonico;
}

export function buildEscolaridadeChart(inscritos: SmDashInscrito[]): ContagemBar[] {
  const counts = new Map<string, number>();
  for (const row of inscritos) {
    const name = labelEscolaridade(row.nivelEscolaridade);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const total = inscritos.length;
  return ordenarContagem(
    [...counts.entries()].map(([name, value]) => ({
      name,
      value,
      rotulo: rotuloContagem(value, total),
    })),
  );
}

export function buildSaudeMentalDashboard(input: {
  inscritos: SmDashInscrito[];
  encontros: SmDashEncontro[];
  presencas: SmDashPresenca[];
}): SaudeMentalDashboardData {
  const ativos = input.inscritos.filter((row) => row.status !== "cancelado");
  const refs = ativos.map(toInscritoRef);
  const encontros = sortEncontrosChronologicamente(input.encontros);
  const presencaSet = buildPresencaSet(input.presencas);
  const hoje = todayIsoDate();
  const escolas = new Set(ativos.map((row) => row.schoolId).filter(Boolean));
  const totais = calcPresencaTotais(refs, encontros, presencaSet);
  const temListaFechada = totais.encontrosRealizados > 0;

  const modulos: ModuloBar[] = moduloCursoOptions.map((opt) => {
    const encontro = encontros.find((item) => item.modulo_curso === opt.value);
    if (!encontro) {
      return {
        name: moduloCurto(opt.value),
        pct: null,
        presentes: 0,
        rotulo: "",
        detalhe: "Sem encontro",
        estado: "sem_encontro",
      };
    }
    const fechada = isListaPresencaFechada(encontro);
    let presentes = 0;
    for (const row of ativos) {
      if (presencaSet.has(buildPresencaKey(row.id, encontro.id))) presentes += 1;
    }
    if (!fechada) {
      const futuro = encontro.data > hoje;
      return {
        name: moduloCurto(opt.value),
        pct: null,
        presentes,
        rotulo: "",
        detalhe: futuro ? "Ainda não realizado" : `${presentes} presença(s), lista em aberto`,
        estado: futuro ? "futuro" : "aberta",
      };
    }
    const pct = ativos.length > 0 ? Math.round((presentes / ativos.length) * 100) : 0;
    return {
      name: moduloCurto(opt.value),
      pct,
      presentes,
      rotulo: `${presentes} (${pct}%)`,
      detalhe: `${presentes} de ${ativos.length}`,
      estado: "fechada",
    };
  });

  const proximoRaw = encontros.find((item) => item.data >= hoje) ?? null;
  const ultimoRaw = [...encontros].reverse().find((item) => item.data < hoje) ?? null;

  return {
    inscritos: ativos.length,
    escolas: escolas.size,
    semVinculo: ativos.filter((row) => !row.schoolId).length,
    mediaParticipacaoPct: temListaFechada ? totais.mediaParticipacaoPct : null,
    listasEmAberto: encontros.filter((item) => item.data <= hoje && !isListaPresencaFechada(item))
      .length,
    regiaoComparacao: buildRegiaoComparacao(ativos, input.presencas),
    sexo: buildSexoChart(ativos),
    funcao: buildFuncaoChart(ativos),
    escolaridade: buildEscolaridadeChart(ativos),
    modulos,
    proximo: proximoRaw ? resumoEncontro(proximoRaw, refs, input.presencas, presencaSet) : null,
    ultimo: ultimoRaw ? resumoEncontro(ultimoRaw, refs, input.presencas, presencaSet) : null,
  };
}
