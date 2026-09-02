import * as XLSX from "xlsx";

export type VivenciasDemandasExportRow = {
  Protocolo: string;
  Escola: string;
  Região: string;
  Tipo: string;
  "Data vivência": string;
  Período: string;
  Turmas: string;
  Profissionais: string;
  Status: string;
  Recebida: string;
};

export function exportVivenciasDemandasToExcel(rows: VivenciasDemandasExportRow[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Demandas Vivências");

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `demandas_vivencias_${date}.xlsx`);
}
