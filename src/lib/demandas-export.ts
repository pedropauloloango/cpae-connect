import * as XLSX from "xlsx";
import { summarizeMeetings } from "@/components/requests/MeetingCountIndicators";
import { complaintTypeLabels, requestStatusLabels } from "@/lib/labels";

export type DemandaExportRow = {
  numero: string;
  aluno_nome: string;
  tipo_queixa: string | null;
  status: string;
  created_at: string;
  school_nome_snapshot: string | null;
  school: { regiao: string | null } | null;
  professional: { nome: string } | null;
  meetings: { status: string }[] | null;
};

export function exportDemandasToExcel(rows: DemandaExportRow[]) {
  const data = rows.map((r) => {
    const { total, registered } = summarizeMeetings(r.meetings);
    return {
      Número: r.numero,
      Aluno: r.aluno_nome,
      Escola: r.school_nome_snapshot ?? "",
      Região: r.school?.regiao ?? "",
      Queixa: r.tipo_queixa ? (complaintTypeLabels[r.tipo_queixa] ?? r.tipo_queixa) : "",
      Profissional: r.professional?.nome ?? "",
      "Qtde de Encontros": total,
      "Encontros concluídos": registered,
      Status: requestStatusLabels[r.status] ?? r.status,
      Criado: new Date(r.created_at).toLocaleDateString("pt-BR"),
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Demandas");

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `demandas_${date}.xlsx`);
}
