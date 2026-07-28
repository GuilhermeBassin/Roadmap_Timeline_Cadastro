// ============================================================================
// Exportação .xlsx — todos os projetos, campos completos, uma linha por
// projeto, datas como data e números como número. Download direto no browser.
// Também gera o template de importação (mesmas colunas do cadastro).
// ============================================================================
import ExcelJS from "exceljs";
import { FupItem, CRITERIOS_PRIORIDADE } from "./dicionario";

function toDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso.slice(0, 10) + "T12:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function simNao(v?: boolean | null): string {
  return v === true ? "Sim" : v === false ? "Não" : "";
}

async function download(wb: ExcelJS.Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const HEADER_FILL: ExcelJS.FillPattern = {
  type: "pattern", pattern: "solid", fgColor: { argb: "FF0033B0" }, // azul Agibank
};

export async function exportarXlsx(projects: FupItem[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Dash Unificado — Agibank";
  const ws = wb.addWorksheet("Projetos", { views: [{ state: "frozen", ySplit: 1 }] });

  ws.columns = [
    { header: "Frente", key: "area", width: 15 },
    { header: "Atividade", key: "atividade", width: 42 },
    { header: "Origem", key: "origem", width: 20 },
    { header: "Tema Macro", key: "temaMacro", width: 20 },
    { header: "Status", key: "status", width: 16 },
    { header: "Prioridade", key: "prioridade", width: 11 },
    { header: "Nº Prioridade", key: "prioridadeNum", width: 13 },
    { header: "Pontuação", key: "pontuacaoPrioridade", width: 11 },
    { header: "Impacto Financeiro", key: "impactoFinanceiro", width: 17 },
    { header: "Nota do Impacto", key: "notaImpacto", width: 15 },
    { header: "Dependência de Squads", key: "dependenciaSquads", width: 20 },
    { header: "Emergencial", key: "emergencial", width: 12 },
    { header: "Data Início", key: "dataInicio", width: 12 },
    { header: "Data Limite", key: "dataLimite", width: 12 },
    { header: "Progresso (%)", key: "progresso", width: 13 },
    { header: "Focal", key: "focal", width: 14 },
    { header: "Descrição", key: "descricao", width: 40 },
    { header: "Resumo de Status", key: "resumoStatus", width: 30 },
    { header: "Dependências", key: "dependencias", width: 24 },
    { header: "Link UX", key: "linkUX", width: 28 },
    { header: "Link RoadMap / Épico", key: "linkRoadMap", width: 20 },
    { header: "Chave Jira", key: "jiraKey", width: 15 },
    { header: "Status Jira", key: "jiraStatus", width: 16 },
    { header: "Última Sync Jira", key: "jiraSyncAt", width: 18 },
  ];

  for (const p of projects) {
    const row = ws.addRow({
      area: p.area,
      atividade: p.atividade,
      origem: p.origem,
      temaMacro: p.temaMacro,
      status: p.status,
      prioridade: p.prioridade,
      prioridadeNum: p.prioridadeNum ?? null,
      pontuacaoPrioridade: p.pontuacaoPrioridade ?? null,
      impactoFinanceiro: simNao(p.impactoFinanceiro),
      notaImpacto: p.notaImpacto ?? null,
      dependenciaSquads: simNao(p.dependenciaSquads),
      emergencial: simNao(p.emergencial),
      dataInicio: toDate(p.dataInicio),
      dataLimite: toDate(p.dataLimite),
      progresso: p.progresso ?? 0,
      focal: p.focal,
      descricao: p.descricao,
      resumoStatus: p.resumoStatus,
      dependencias: p.dependencias,
      linkUX: p.linkUX,
      linkRoadMap: p.linkRoadMap,
      jiraKey: p.jiraKey ?? "",
      jiraStatus: p.jiraStatus ?? "",
      jiraSyncAt: p.jiraSyncAt ? new Date(p.jiraSyncAt) : null,
    });
    row.getCell("dataInicio").numFmt = "dd/mm/yyyy";
    row.getCell("dataLimite").numFmt = "dd/mm/yyyy";
    row.getCell("jiraSyncAt").numFmt = "dd/mm/yyyy hh:mm";
    row.getCell("prioridadeNum").numFmt = "0";
    row.getCell("pontuacaoPrioridade").numFmt = "0";
    row.getCell("notaImpacto").numFmt = "0";
    row.getCell("progresso").numFmt = "0";
  }

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = HEADER_FILL;
  header.height = 20;
  ws.autoFilter = { from: "A1", to: { row: 1, column: ws.columns.length } };

  const hoje = new Date().toISOString().slice(0, 10);
  await download(wb, `dash_projetos_${hoje}.xlsx`);
}

// ── Template de importação ──────────────────────────────────────────────────

export const TEMPLATE_COLS = [
  "Atividade*", "Frente*", "Origem", "Tema Macro", "Status", "Prioridade",
  "Impacto Financeiro (Sim/Não)", "Nota do Impacto (0-10)",
  "Dependência de Squads (Sim/Não)", "Emergencial (Sim/Não)",
  "Data Início", "Data Limite", "Progresso (%)", "Focal",
  "Descrição", "Resumo de Status", "Dependências", "Link UX", "Link RoadMap / Épico",
] as const;

export async function baixarTemplateXlsx() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Projetos");
  ws.addRow([...TEMPLATE_COLS]);
  const exemplo = ws.addRow([
    "Atualização Cadastral com Fluxo de Consequência", "Cadastro", "Projetos", "Atualização Cadastral",
    "Backlog", "Alto", "Sim", 8, "Não", "Não",
    "01/08/2026", "30/09/2026", 0, "Guilherme",
    "Descrição do projeto (opcional)", "", "API dos Correios", "https://figma.com/...", "Roadmap: 2058",
  ]);
  exemplo.font = { italic: true, color: { argb: "FF64748B" } };

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = HEADER_FILL;
  ws.columns.forEach(c => { c.width = 24; });

  const notas = wb.addWorksheet("Instruções");
  notas.addRows([
    ["Template de importação do Dash Unificado"],
    [""],
    ["• Colunas com * são obrigatórias (Atividade e Frente)."],
    ["• Frente: APP | Cadastro | Conta Corrente"],
    ["• Status: Backlog | Discovery | Handover | Refin. Técnico | Desenv. UX | Desenv. Técnico | Teste | Pausado | Bloqueado | Concluído | Cancelado (vazio = Backlog)"],
    ["• Prioridade: Baixo | Médio | Alto | Crítico (vazio = Médio)"],
    ["• Datas: dd/mm/aaaa ou aaaa-mm-dd"],
    ["• A linha de exemplo (em itálico) pode ser apagada ou sobrescrita — ela não é importada se mantida igual."],
    [`• Critérios de priorização: ${CRITERIOS_PRIORIDADE.map(c => c.rotulo).join(" · ")}`],
  ]);
  notas.getRow(1).font = { bold: true };

  await download(wb, "template_importacao_dash.xlsx");
}
