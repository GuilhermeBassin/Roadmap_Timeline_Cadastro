// ============================================================================
// Importação de projetos via .xlsx — template para download, cada linha vira
// um projeto novo; linhas inválidas não interrompem as demais e são listadas
// ao final com o motivo, para correção e reimportação.
// ============================================================================
import { useRef, useState } from "react";
import ExcelJS from "exceljs";
import { Upload, Download, X, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  Area, FupStatus, Prioridade, FupItem,
  AREAS, FUP_STATUSES, PRIORIDADES, calcularPontuacao,
} from "./dicionario";
import { baixarTemplateXlsx } from "./exportXlsx";

export interface LinhaErro { linha: number; motivo: string; }
export interface ResultadoImport { criados: number; erros: LinhaErro[]; }

// ── Parsing/validação ───────────────────────────────────────────────────────

function cellStr(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as any;
    if (o.text) return String(o.text);                    // rich text / hyperlink
    if (o.richText) return o.richText.map((r: any) => r.text).join("");
    if (o.result !== undefined) return String(o.result);  // fórmula
    return "";
  }
  return String(v).trim();
}

/** Data real no calendário? (rejeita 32/13/2026, 2026-02-30 etc.) */
function isoValida(iso: string): boolean {
  const d = new Date(iso + "T12:00:00");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

function parseData(v: ExcelJS.CellValue): { ok: boolean; iso: string } {
  if (v === null || v === undefined || v === "") return { ok: true, iso: "" };
  if (v instanceof Date) return { ok: true, iso: v.toISOString().slice(0, 10) };
  const s = cellStr(v).trim();
  if (!s) return { ok: true, iso: "" };
  let iso = "";
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) iso = `${m[1]}-${m[2]}-${m[3]}`;
  else {
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
      iso = `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
  }
  return iso && isoValida(iso) ? { ok: true, iso } : { ok: false, iso: "" };
}

function parseSimNao(v: ExcelJS.CellValue): boolean | null | "erro" {
  const s = cellStr(v).toLowerCase();
  if (!s) return null;
  if (["sim", "s", "yes", "true", "1"].includes(s)) return true;
  if (["não", "nao", "n", "no", "false", "0"].includes(s)) return false;
  return "erro";
}

export interface LinhaValida { linha: number; item: Partial<FupItem>; }

/** Converte as linhas da planilha em projetos válidos + erros por linha. */
export async function parseXlsx(file: File): Promise<{ validos: LinhaValida[]; erros: LinhaErro[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return { validos: [], erros: [{ linha: 0, motivo: "Planilha vazia ou ilegível" }] };

  const validos: LinhaValida[] = [];
  const erros: LinhaErro[] = [];

  ws.eachRow((row, n) => {
    if (n === 1) return; // cabeçalho
    const c = (i: number) => row.getCell(i).value;
    const atividade = cellStr(c(1));
    const areaS = cellStr(c(2));
    // linha totalmente vazia → ignora
    if (!atividade && !areaS && !cellStr(c(3)) && !cellStr(c(4))) return;
    // linha de exemplo intocada do template → ignora
    if (atividade === "Atualização Cadastral com Fluxo de Consequência" && cellStr(c(19)) === "Roadmap: 2058") return;

    const motivos: string[] = [];
    if (!atividade) motivos.push("Atividade vazia (obrigatória)");

    const area = AREAS.find(a => a.toLowerCase() === areaS.toLowerCase());
    if (!area) motivos.push(`Frente inválida: "${areaS}" (use APP, Cadastro ou Conta Corrente)`);

    const statusS = cellStr(c(5));
    const status = statusS === "" ? "Backlog" : FUP_STATUSES.find(s => s.toLowerCase() === statusS.toLowerCase());
    if (!status) motivos.push(`Status inválido: "${statusS}"`);

    const prioS = cellStr(c(6));
    const prioridade = prioS === "" ? "Médio" : PRIORIDADES.find(p => p.toLowerCase() === prioS.toLowerCase());
    if (!prioridade) motivos.push(`Prioridade inválida: "${prioS}"`);

    const impFin = parseSimNao(c(7));
    if (impFin === "erro") motivos.push(`Impacto Financeiro deve ser Sim/Não: "${cellStr(c(7))}"`);
    const notaS = cellStr(c(8));
    let nota: number | null = null;
    if (notaS !== "") {
      nota = Number(notaS.replace(",", "."));
      if (isNaN(nota) || nota < 0 || nota > 10) { motivos.push(`Nota do Impacto deve ser 0–10: "${notaS}"`); nota = null; }
      else nota = Math.round(nota);
    }
    const depSq = parseSimNao(c(9));
    if (depSq === "erro") motivos.push(`Dependência de Squads deve ser Sim/Não: "${cellStr(c(9))}"`);
    const emerg = parseSimNao(c(10));
    if (emerg === "erro") motivos.push(`Emergencial deve ser Sim/Não: "${cellStr(c(10))}"`);

    const dIni = parseData(c(11));
    if (!dIni.ok) motivos.push(`Data Início inválida: "${cellStr(c(11))}"`);
    const dLim = parseData(c(12));
    if (!dLim.ok) motivos.push(`Data Limite inválida: "${cellStr(c(12))}"`);

    const progS = cellStr(c(13));
    let progresso = 0;
    if (progS !== "") {
      progresso = Number(progS.replace(",", "."));
      if (isNaN(progresso) || progresso < 0 || progresso > 100) { motivos.push(`Progresso deve ser 0–100: "${progS}"`); progresso = 0; }
      else progresso = Math.round(progresso);
    }

    if (motivos.length) {
      erros.push({ linha: n, motivo: motivos.join("; ") });
      return;
    }

    const item: Partial<FupItem> = {
      atividade,
      area: area as Area,
      origem: cellStr(c(3)),
      temaMacro: cellStr(c(4)),
      status: status as FupStatus,
      prioridade: prioridade as Prioridade,
      impactoFinanceiro: impFin as boolean | null,
      notaImpacto: nota,
      dependenciaSquads: depSq as boolean | null,
      emergencial: emerg as boolean | null,
      dataInicio: dIni.iso,
      dataLimite: dLim.iso,
      progresso,
      focal: cellStr(c(14)),
      descricao: cellStr(c(15)),
      resumoStatus: cellStr(c(16)),
      dependencias: cellStr(c(17)),
      linkUX: cellStr(c(18)),
      linkRoadMap: cellStr(c(19)),
    };
    item.pontuacaoPrioridade = calcularPontuacao(item);
    validos.push({ linha: n, item });
  });

  return { validos, erros };
}

// ── Modal ───────────────────────────────────────────────────────────────────

export function ImportXlsxModal({ onClose, onImport }: {
  onClose: () => void;
  onImport: (itens: LinhaValida[]) => Promise<{ criados: number; errosDb: LinhaErro[] }>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);

  async function handleFile(f: File) {
    setBusy(true);
    setResultado(null);
    try {
      const { validos, erros } = await parseXlsx(f);
      const { criados, errosDb } = validos.length
        ? await onImport(validos)
        : { criados: 0, errosDb: [] as LinhaErro[] };
      setResultado({ criados, erros: [...erros, ...errosDb].sort((a, b) => a.linha - b.linha) });
    } catch (e: any) {
      setResultado({ criados: 0, erros: [{ linha: 0, motivo: e?.message ?? "Erro ao ler o arquivo" }] });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,23,42,0.35)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl p-6 flex flex-col gap-5" style={{ background: "#FFFFFF", border: "1px solid rgba(15,23,42,0.1)", boxShadow: "0 24px 64px rgba(15,23,42,0.15)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: "#1E293B" }}>Importar Projetos (.xlsx)</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: "#64748B" }}><X size={16} /></button>
        </div>

        <p className="text-xs leading-relaxed" style={{ color: "#64748B" }}>
          Cada linha válida vira um projeto novo e aparece automaticamente no Controle de Vertical,
          no Roadmap e na Timeline. Linhas com erro não interrompem a importação — elas são listadas
          ao final com o motivo, para você corrigir e reimportar apenas essas.
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => baixarTemplateXlsx()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold"
            style={{ background: "rgba(15,23,42,0.05)", color: "#475569", border: "1px solid rgba(15,23,42,0.1)" }}
          >
            <Download size={14} /> Baixar template
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff" }}
          >
            <Upload size={14} /> {busy ? "Importando…" : "Selecionar arquivo"}
          </button>
          <input
            ref={fileRef} type="file" accept=".xlsx" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>

        {resultado && (
          <div className="flex flex-col gap-3">
            {resultado.criados > 0 && (
              <div className="flex items-center gap-2 rounded-xl p-3" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}>
                <CheckCircle2 size={16} style={{ color: "#10B981" }} />
                <span className="text-sm font-bold" style={{ color: "#059669" }}>
                  {resultado.criados} projeto{resultado.criados > 1 ? "s" : ""} criado{resultado.criados > 1 ? "s" : ""} com sucesso
                </span>
              </div>
            )}
            {resultado.criados === 0 && resultado.erros.length === 0 && (
              <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(15,23,42,0.04)", color: "#64748B" }}>
                Nenhuma linha para importar foi encontrada no arquivo.
              </div>
            )}
            {resultado.erros.length > 0 && (
              <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} style={{ color: "#EF4444" }} />
                  <span className="text-xs font-bold" style={{ color: "#DC2626" }}>
                    {resultado.erros.length} linha{resultado.erros.length > 1 ? "s" : ""} com erro (corrija e reimporte só essas)
                  </span>
                </div>
                <div className="max-h-44 overflow-y-auto flex flex-col gap-1">
                  {resultado.erros.map((e, i) => (
                    <div key={i} className="text-xs rounded-lg px-2 py-1.5" style={{ background: "#FFFFFF", color: "#64748B", border: "1px solid rgba(239,68,68,0.15)" }}>
                      <span className="font-bold" style={{ color: "#DC2626" }}>Linha {e.linha}:</span> {e.motivo}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
