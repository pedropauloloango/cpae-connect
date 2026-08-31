export type PresencaEncontroRef = {
  id: string;
  data: string;
  horario: string;
  modulo_curso: string;
  ano_curso: number;
  lista_presenca_fechada?: boolean;
};

export type PresencaInscritoRef = {
  id: string;
  nome_completo: string;
  cpf: string | null;
  escola_texto: string | null;
  school_nome_snapshot: string | null;
  ano_curso: number;
};

export type PresencaRegistroRef = {
  id: string;
  encontro_id: string;
  inscrito_id: string;
};

export type ParticipacaoDot = {
  encontro: PresencaEncontroRef;
  presente: boolean;
  /** Cinza — encontro ainda não realizado e lista manual não fechada. */
  pendente: boolean;
  /** @deprecated use pendente */
  futuro?: boolean;
};

export type ParticipacaoResumo = {
  pct: number;
  presentes: number;
  total: number;
  ultimos: ParticipacaoDot[];
};

/** Um encontro por módulo (curso com 9 módulos). */
export const ENCONTROS_CURSO_COLS = 9;

export function escolaInscritoLabel(i: PresencaInscritoRef): string {
  return (i.school_nome_snapshot ?? i.escola_texto ?? "").trim();
}

export function isEncontroRealizado(encontro: PresencaEncontroRef, hoje = todayIsoDate()): boolean {
  return encontro.data <= hoje;
}

/** Lista manual confirmada — ausências explícitas (bolinha vermelha). */
export function isListaPresencaFechada(encontro: PresencaEncontroRef): boolean {
  return Boolean(encontro.lista_presenca_fechada);
}

/** @deprecated Use isListaPresencaFechada para ausências; data passada não implica ausência. */
export function isEncontroContabilizado(
  encontro: PresencaEncontroRef,
  hoje = todayIsoDate(),
): boolean {
  return isListaPresencaFechada(encontro);
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDataBr(value: string): string {
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pt-BR");
}

export function formatHorario(value: string): string {
  return value.slice(0, 5);
}

export function buildPresencaKey(inscritoId: string, encontroId: string): string {
  return `${inscritoId}:${encontroId}`;
}

export function buildPresencaSet(registros: PresencaRegistroRef[]): Set<string> {
  return new Set(registros.map((p) => buildPresencaKey(p.inscrito_id, p.encontro_id)));
}

export function sortEncontrosChronologicamente<T extends { data: string; horario: string }>(
  list: T[],
): T[] {
  return [...list].sort(
    (a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario),
  );
}

export function filterEncontros(
  encontros: PresencaEncontroRef[],
  opts: {
    modulo?: string;
    ano?: string;
    dataDe?: string;
    dataAte?: string;
    apenasRealizados?: boolean;
  },
): PresencaEncontroRef[] {
  let list = encontros;
  if (opts.modulo && opts.modulo !== "todos") {
    list = list.filter((e) => e.modulo_curso === opts.modulo);
  }
  if (opts.ano && opts.ano !== "todos") {
    list = list.filter((e) => String(e.ano_curso) === opts.ano);
  }
  if (opts.dataDe) list = list.filter((e) => e.data >= opts.dataDe!);
  if (opts.dataAte) list = list.filter((e) => e.data <= opts.dataAte!);
  if (opts.apenasRealizados) {
    const hoje = todayIsoDate();
    list = list.filter((e) => isEncontroRealizado(e, hoje));
  }
  return sortEncontrosChronologicamente(list);
}

export function calcParticipacao(
  inscritoId: string,
  encontros: PresencaEncontroRef[],
  presencaSet: Set<string>,
  ultimosCount = ENCONTROS_CURSO_COLS,
): ParticipacaoResumo {
  const fechados = encontros.filter((e) => isListaPresencaFechada(e));
  const presentes = fechados.filter((e) =>
    presencaSet.has(buildPresencaKey(inscritoId, e.id)),
  ).length;
  const total = fechados.length;
  const pct = total > 0 ? Math.round((presentes / total) * 100) : 0;

  const ultimosBase = encontros.slice(0, ultimosCount);
  const ultimos: ParticipacaoDot[] = ultimosBase.map((encontro) => {
    const presente = presencaSet.has(buildPresencaKey(inscritoId, encontro.id));
    const fechada = isListaPresencaFechada(encontro);
    return {
      encontro,
      presente,
      pendente: !presente && !fechada,
    };
  });

  while (ultimos.length < ultimosCount) {
    ultimos.unshift({
      encontro: {
        id: `placeholder-${ultimos.length}`,
        data: "",
        horario: "",
        modulo_curso: "",
        ano_curso: 0,
      },
      presente: false,
      pendente: true,
    });
  }

  return { pct, presentes, total, ultimos: ultimos.slice(-ultimosCount) };
}

export type PresencaTotais = {
  inscritos: number;
  encontros: number;
  encontrosRealizados: number;
  presencasRegistradas: number;
  mediaParticipacaoPct: number;
};

export function calcPresencaTotais(
  inscritos: PresencaInscritoRef[],
  encontros: PresencaEncontroRef[],
  presencaSet: Set<string>,
): PresencaTotais {
  const listasFechadas = encontros.filter((e) => isListaPresencaFechada(e));
  let presencasRegistradas = 0;
  let somaPct = 0;

  for (const inscrito of inscritos) {
    const { pct, presentes } = calcParticipacao(inscrito.id, encontros, presencaSet);
    presencasRegistradas += presentes;
    somaPct += pct;
  }

  return {
    inscritos: inscritos.length,
    encontros: encontros.length,
    encontrosRealizados: listasFechadas.length,
    presencasRegistradas,
    mediaParticipacaoPct:
      inscritos.length > 0 ? Math.round(somaPct / inscritos.length) : 0,
  };
}

/** Totais focados em um encontro (inclui presenças mesmo com lista ainda aberta). */
export function calcPresencaTotaisEncontro(
  inscritos: PresencaInscritoRef[],
  encontro: PresencaEncontroRef,
  presencaSet: Set<string>,
): PresencaTotais {
  const elegiveis = inscritos.filter((i) => i.ano_curso === encontro.ano_curso);
  let presentes = 0;
  for (const i of elegiveis) {
    if (presencaSet.has(buildPresencaKey(i.id, encontro.id))) presentes += 1;
  }

  return {
    inscritos: elegiveis.length,
    encontros: 1,
    encontrosRealizados: isListaPresencaFechada(encontro) ? 1 : 0,
    presencasRegistradas: presentes,
    mediaParticipacaoPct:
      elegiveis.length > 0 ? Math.round((presentes / elegiveis.length) * 100) : 0,
  };
}
