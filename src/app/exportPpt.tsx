// ============================================================================
// Exportação PowerPoint (padrão Agibank) — mesmo comportamento do Dash
// (Controle de Demandas): seletor de período, somente projetos EM ANDAMENTO
// com prazo dentro do período, ordenados por prioridade (Crítico → Baixo).
// ============================================================================

import { useState } from "react";
import PptxGenJS from "pptxgenjs";
import { Area, FupItem, Prioridade, emAndamento } from "./dicionario";

const AGI_PPT_BLUE = "0033B0";
const AGI_PPT_GREEN = "2FC750";

const AGI_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 167 104">
  <path d="M148.603 8.226c.038 4.744-3.971 8.181-8.122 8.151-3.773-.027-8.007-3.027-8.013-8.178-.004-4.756 3.661-8.203 8.088-8.196 4.734.009 8.142 3.94 8.047 8.226z" fill="#2FC750"/>
  <path fill="#FFFFFF" d="M134.516 50.663V23.301c0-1.212-.075-1.062 1.028-1.064 3.465-.004 6.928 0 10.393.004 1.14.002 1.045-.125 1.045 1.052v41.239c0 4.43 0 8.857.001 13.287 0 .262-.004.524-.004.787 0 .24-.122.357-.353.363-.195.006-.39.006-.584.006-3.53 0-7.058-.002-10.588-.004-.936 0-.841.092-.841-1.028v-28.12z"/>
  <path fill="#FFFFFF" d="M125.591 24.082c0-.394.006-.787-.002-1.181-.012-.704-.016-.722-.684-.722-3.692-.007-7.383-.007-11.075-.001-.72 0-.726.014-.735.766-.018 2.034-.028 4.068-.048 6.102-.002.242.05.502-.071.723-.093-.018-.134-.014-.148-.03-.249-.301-.496-.606-.745-.907-2.511-3.043-5.622-5.194-9.334-6.463-3.357-1.148-6.816-1.472-10.336-1.388-2.807.068-5.545.513-8.16 1.553-6.75 2.685-11.686 7.474-15.005 13.899-3.645 7.055-4.072 14.569-2.175 22.2 1.765 7.101 5.974 12.571 11.686 16.904 2.678 2.032 5.688 3.361 8.977 4.034 3.566.73 7.142.742 10.715.127 5.503-.946 10.551-2.876 14.601-7.287.022.369.05.558.042.747-.058 1.278-.095 2.555-.293 3.822-.955 6.081-4.076 10.461-9.788 12.797-4.349 1.78-8.814 1.965-13.337 0.85-4.222-1.041-7.911-3.028-10.716-6.496-.346-.429-.372-.423-.88.09-2.613 2.641-5.222 5.289-7.833 7.934-.091.092-.18.188-.273.28-.168.166-.176.334-.02.512.194.222.382.445.58.663 2.609 2.846 5.659 5.092 9.106 6.774 8.094 3.95 16.53 4.508 25.183 2.435 4.723-1.132 8.889-3.366 12.325-6.902 3.162-3.253 5.198-7.162 6.515-11.485 1.447-4.745 1.917-9.632 1.923-14.57.022-15.26.01-30.52.01-45.779zm-12.267 26.707c-.073 6.027-2.404 11.053-7.365 14.732-2.435 1.807-5.197 2.787-8.183 3.076-3.675.355-7.259-.031-10.556-1.85-5.414-2.988-8.503-7.608-9.223-13.83-.397-3.418-.114-6.784 1.285-9.93 2.777-6.24 7.533-9.851 14.313-10.573 3.902-.417 7.648.165 11.038 2.224 5.147 3.128 8.021 7.767 8.582 13.846.042.458.081.915.107 1.374.014.265.002.528.002.932z"/>
  <path fill-rule="evenodd" fill="#FFFFFF" d="M32.518 80.044c5.803-.808 11.106-2.785 15.247-7.356.151.263.135.484.12.687-.004.052-.008.104-.009.155.006.905.006 1.81.006 2.716-.001.604 0 1.207.001 1.811.001.573-.023.831.093.946.118.116.383.084.969.085 3.4.004 6.798.008 10.198-.002.679-.001.979.052 1.11-.073.129-.122.095-.416.095-1.102v-41.872c0-4.534-.001-9.067 0-13.6 0-.052-.002-.104-.004-.156-.003-.112-.006-.224.007-.334.049-.443-.077-.64-.575-.638-3.757.02-7.513.02-11.268 0-.532-.004-.64.203-.636.689.02 2.164.012 4.33.002 6.495 0 .045.008.093.016.142.025.165.053.345-.188.446-.136-.164-.271-.329-.405-.493-.258-.315-.516-.63-.782-.937C44.073 25.883 41.134 23.785 37.628 22.569c-5.519-1.916-11.137-2.117-16.705-.419C12.315 24.778 6.454 30.614 3.001 38.908.542 44.816.2 51.032 1.479 57.26c1.911 9.313 7.206 16.138 15.528 20.469 4.875 2.537 10.141 3.065 15.511 2.317zm-12.818-44.139c-4.829 3.712-7.072 8.72-7.064 14.953.011.213.019.433.027.658.03.803.062 1.672.22 2.536 1.321 7.205 5.417 11.948 12.302 14.171 1.892.611 3.873.736 5.856.664 6.62-.244 11.599-3.289 14.896-9.088 1.813-3.193 2.321-6.712 2.131-10.346-.279-5.324-2.402-9.727-6.488-13.121-2.906-2.414-6.28-3.597-10-3.802-4.331-.24-8.372.677-11.884 3.378z"/>
</svg>`;

const PPT_PRIORIDADE_ORDEM: Record<Prioridade, number> = {
  "Crítico": 0, "Alto": 1, "Médio": 2, "Baixo": 3,
};

const PPT_PRIORIDADE_CORES: Record<string, { fill: string; text: string }> = {
  "Crítico": { fill: "FDE8E8", text: "C81E1E" },
  "Alto": { fill: "FEECDC", text: "B45309" },
  "Médio": { fill: "FDF6B2", text: "8E4B10" },
  "Baixo": { fill: "E1EFFE", text: "1E429F" },
};

const PPT_STATUS_CORES: Record<string, { fill: string; text: string }> = {
  "Discovery": { fill: "EDE9FE", text: "6D28D9" },
  "Handover": { fill: "E0F2FE", text: "0369A1" },
  "Refin. Técnico": { fill: "DBEAFE", text: "1D4ED8" },
  "Desenv. UX": { fill: "FCE7F3", text: "BE185D" },
  "Desenv. Técnico": { fill: "FFEDD5", text: "C2410C" },
  "Teste": { fill: "FEF3C7", text: "B45309" },
};

function pptParseData(valor: string): Date | null {
  if (!valor) return null;
  const t = String(valor).trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

function pptFormatData(valor: string): string {
  const d = pptParseData(valor);
  if (!d) return valor || "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

async function pptLogoPng(): Promise<string | null> {
  try {
    const img = new Image();
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(AGI_LOGO_SVG);
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("logo"));
      img.src = url;
    });
    const scale = 4;
    const canvas = document.createElement("canvas");
    canvas.width = 167 * scale;
    canvas.height = 104 * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

// ── Timeline no padrão oficial (painéis mensais, semanas, "Estamos aqui") ────

const PPT_TL_AZUL = "1D63F2";      // Desenvolvimento
const PPT_TL_LARANJA = "F5A623";   // Homologação (Teste)
const PPT_TL_CINZA = "9AA0A6";     // Arquitetura/Refinamento
const PPT_TL_VERDE = "7CCB86";     // "Estamos aqui"
const PPT_TL_PAINEL = "F1F3F6";

function tlBarColor(status: string): string {
  if (status === "Teste") return PPT_TL_LARANJA;
  if (status === "Desenv. UX" || status === "Desenv. Técnico") return PPT_TL_AZUL;
  return PPT_TL_CINZA; // Discovery, Handover, Refin. Técnico
}

function tlIcon(item: FupItem): string {
  if (item.status === "Concluído") return "✅";
  if (item.status === "Bloqueado") return "⚠";
  if ((item.origem || "").toLowerCase().includes("negóc")) return "💼";
  return "⚙";
}

function tlQuarterLabel(inicio: Date, fim: Date): string {
  const q1 = Math.floor(inicio.getMonth() / 3) + 1;
  const q2 = Math.floor(fim.getMonth() / 3) + 1;
  if (inicio.getFullYear() === fim.getFullYear() && q1 === q2) return `Q${q1}`;
  const f = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${f(inicio)} a ${f(fim)}`;
}

function addTimelineSlides(
  pptx: PptxGenJS,
  itens: FupItem[],
  logo: string | null,
  _periodo: string,
  area: Area,
  inicio: Date,
  fim: Date,
) {
  // Escala semanal: da segunda-feira da semana da data inicial até o fim do período
  const scaleStart = new Date(inicio);
  scaleStart.setDate(scaleStart.getDate() - ((scaleStart.getDay() + 6) % 7)); // segunda
  const weeks: Date[] = [];
  for (let d = new Date(scaleStart); d.getTime() <= fim.getTime(); d.setDate(d.getDate() + 7)) {
    weeks.push(new Date(d));
  }
  if (weeks.length === 0) weeks.push(new Date(scaleStart));
  const scaleEnd = new Date(weeks[weeks.length - 1]);
  scaleEnd.setDate(scaleEnd.getDate() + 7);
  const totalMs = scaleEnd.getTime() - scaleStart.getTime();
  const frac = (d: Date) => Math.max(0, Math.min(1, (d.getTime() - scaleStart.getTime()) / totalMs));

  const areaX = 0.35, areaW = 12.63;
  const panelY = 0.95, panelH = 5.0;
  const colW = areaW / weeks.length;
  const rowH = 0.58, rowsY = 1.75, porPagina = 7;

  // Painéis por mês (semanas contíguas do mesmo mês)
  const panels: { start: number; end: number }[] = [];
  weeks.forEach((w, i) => {
    const last = panels[panels.length - 1];
    if (last && weeks[last.end].getMonth() === w.getMonth() && weeks[last.end].getFullYear() === w.getFullYear()) {
      last.end = i;
    } else {
      panels.push({ start: i, end: i });
    }
  });

  const hoje = new Date();
  const titulo = `${area} – Projetos ${tlQuarterLabel(inicio, fim)}`;

  const totalPaginas = Math.ceil(itens.length / porPagina);
  for (let pg = 0; pg < totalPaginas; pg++) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };

    // Título + logo
    slide.addText(titulo, { x: areaX, y: 0.18, w: 9.5, h: 0.55, color: PPT_TL_AZUL, fontSize: 26, bold: true, fontFace: "Arial" });
    if (logo) {
      slide.addShape("roundRect", { x: 12.06, y: 0.18, w: 0.95, h: 0.6, rectRadius: 0.12, fill: { color: AGI_PPT_BLUE } });
      slide.addImage({ data: logo, x: 12.2, y: 0.28, w: 0.66, h: 0.41 });
    }
    if (totalPaginas > 1) {
      slide.addText(`${pg + 1} / ${totalPaginas}`, { x: 11.0, y: 0.3, w: 0.9, h: 0.35, color: "94A3B8", fontSize: 11, align: "right", fontFace: "Arial" });
    }

    // Painéis mensais
    for (const p of panels) {
      const px = areaX + p.start * colW + 0.03;
      const pw = (p.end - p.start + 1) * colW - 0.06;
      slide.addShape("roundRect", { x: px, y: panelY, w: pw, h: panelH, rectRadius: 0.12, fill: { color: PPT_TL_PAINEL } });
    }

    // Semanas: círculo + data dd/mm
    weeks.forEach((w, i) => {
      const cx = areaX + i * colW + colW / 2;
      slide.addShape("ellipse", { x: cx - 0.1, y: 1.08, w: 0.2, h: 0.2, fill: { color: "FFFFFF" }, line: { color: "D8DEE8", width: 0.75 } });
      slide.addText(`${String(w.getDate()).padStart(2, "0")}/${String(w.getMonth() + 1).padStart(2, "0")}`, {
        x: cx - colW / 2, y: 1.3, w: colW, h: 0.25, align: "center", color: "334155", fontSize: 9, bold: true, fontFace: "Arial",
      });
    });

    // Linhas de projetos: nome com ícone + barra
    const pagina = itens.slice(pg * porPagina, (pg + 1) * porPagina);
    pagina.forEach((item, i) => {
      const y = rowsY + i * rowH;
      slide.addText(`${tlIcon(item)} ${item.atividade || "—"}`, {
        x: areaX + 0.15, y, w: 8.5, h: 0.28, color: PPT_TL_AZUL, fontSize: 11.5, bold: true, fontFace: "Arial",
      });
      const ini = pptParseData(item.dataInicio || "") ?? pptParseData(item.dataLimite);
      const fimItem = pptParseData(item.dataLimite) ?? ini;
      if (!ini || !fimItem) return;
      const f0 = frac(ini.getTime() <= fimItem.getTime() ? ini : fimItem);
      const f1 = frac(fimItem.getTime() >= ini.getTime() ? fimItem : ini);
      const bx = areaX + areaW * f0;
      const bw = Math.max(0.15, areaW * (f1 - f0));
      slide.addShape("roundRect", {
        x: bx, y: y + 0.31, w: bw, h: 0.13, rectRadius: 0.06, fill: { color: tlBarColor(item.status) },
      });
    });

    // "Estamos aqui" (linha tracejada verde na data de hoje)
    if (hoje.getTime() >= scaleStart.getTime() && hoje.getTime() <= scaleEnd.getTime()) {
      const hx = areaX + areaW * frac(hoje);
      slide.addShape("line", { x: hx, y: panelY, w: 0, h: panelH + 0.15, line: { color: PPT_TL_VERDE, width: 1.5, dashType: "dash" } });
      slide.addText("Estamos aqui", { x: hx - 0.8, y: panelY + panelH + 0.12, w: 1.6, h: 0.25, align: "center", color: PPT_TL_VERDE, fontSize: 10, bold: true, fontFace: "Arial" });
    }

    // Caixa "Deploys programados" (para preenchimento manual)
    slide.addShape("roundRect", { x: areaX, y: 6.35, w: 6.6, h: 0.95, rectRadius: 0.06, fill: { color: "FFFFFF" }, line: { color: "D8DEE8", width: 1 } });
    slide.addText("Deploys programados:", { x: areaX + 0.15, y: 6.42, w: 4, h: 0.25, color: "1F2937", fontSize: 11, bold: true, fontFace: "Arial" });
    slide.addText("•", { x: areaX + 0.2, y: 6.68, w: 3, h: 0.22, color: "475569", fontSize: 10, fontFace: "Arial" });

    // Legenda
    const lx = 8.2, ly = 6.35;
    slide.addShape("roundRect", { x: lx, y: ly, w: 4.78, h: 0.95, rectRadius: 0.06, fill: { color: "FFFFFF" }, line: { color: "D8DEE8", width: 1 } });
    const legCores: [string, string][] = [
      [PPT_TL_AZUL, "Desenvolvimento"],
      [PPT_TL_LARANJA, "Homologação"],
      [PPT_TL_CINZA, "Arquitetura/Refinamento"],
    ];
    legCores.forEach(([cor, label], i) => {
      const yL = ly + 0.1 + i * 0.27;
      slide.addShape("roundRect", { x: lx + 0.15, y: yL + 0.03, w: 0.28, h: 0.12, rectRadius: 0.03, fill: { color: cor } });
      slide.addText(label, { x: lx + 0.5, y: yL, w: 2.2, h: 0.2, color: "334155", fontSize: 8.5, fontFace: "Arial" });
    });
    const legIcones: [string, string][] = [
      ["✅", "Concluído"], ["⚠", "Impedimento"], ["💼", "Negócios"], ["⚙", "Tech"],
    ];
    legIcones.forEach(([ic, label], i) => {
      const yL = ly + 0.1 + (i % 3) * 0.27;
      const xL = lx + 2.75 + Math.floor(i / 3) * 1.1;
      slide.addText(`${ic} ${label}`, { x: xL, y: yL, w: 1.3, h: 0.2, color: "334155", fontSize: 8.5, fontFace: "Arial" });
    });
  }
}

export async function gerarPowerPoint(projects: FupItem[], area: Area, dataInicio: string, dataFim: string): Promise<number> {
  const inicio = pptParseData(dataInicio);
  const fim = pptParseData(dataFim);
  if (!inicio || !fim || inicio.getTime() > fim.getTime()) {
    throw new Error("Período inválido: a data inicial deve ser anterior à data final.");
  }

  const itens = projects
    .filter(p => emAndamento(p.status))
    .filter(p => {
      const d = pptParseData(p.dataLimite);
      return d !== null && d.getTime() >= inicio.getTime() && d.getTime() <= fim.getTime();
    })
    .sort((a, b) => {
      const pa = PPT_PRIORIDADE_ORDEM[a.prioridade] ?? 9;
      const pb = PPT_PRIORIDADE_ORDEM[b.prioridade] ?? 9;
      if (pa !== pb) return pa - pb;
      const da = pptParseData(a.dataLimite)?.getTime() ?? 0;
      const db = pptParseData(b.dataLimite)?.getTime() ?? 0;
      return da - db;
    });

  if (itens.length === 0) return 0;

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "AGI_WIDE", width: 13.33, height: 7.5 });
  pptx.layout = "AGI_WIDE";
  const logo = await pptLogoPng();
  const periodo = `${pptFormatData(dataInicio)} a ${pptFormatData(dataFim)}`;

  // Capa
  const capa = pptx.addSlide();
  capa.background = { color: AGI_PPT_BLUE };
  if (logo) capa.addImage({ data: logo, x: 5.72, y: 1.35, w: 1.9, h: 1.18 });
  capa.addShape("rect", { x: 5.12, y: 3.05, w: 3.1, h: 0.045, fill: { color: AGI_PPT_GREEN } });
  capa.addText("Projetos em Andamento", { x: 0, y: 3.35, w: 13.33, h: 0.8, align: "center", color: "FFFFFF", fontSize: 40, bold: true, fontFace: "Arial" });
  capa.addText(`Vertical ${area} · Dash Unificado`, { x: 0, y: 4.15, w: 13.33, h: 0.5, align: "center", color: "D6E4FF", fontSize: 18, fontFace: "Arial" });
  capa.addText(`Período: ${periodo}`, { x: 0, y: 4.75, w: 13.33, h: 0.45, align: "center", color: AGI_PPT_GREEN, fontSize: 16, bold: true, fontFace: "Arial" });
  capa.addText(`Gerado em ${pptFormatData(new Date().toISOString().slice(0, 10))}`, { x: 0, y: 6.9, w: 13.33, h: 0.35, align: "center", color: "9DB8E8", fontSize: 11, fontFace: "Arial" });

  // Slides de conteúdo (tabela paginada, 9 por slide)
  const porPagina = 9;
  const totalPaginas = Math.ceil(itens.length / porPagina);
  for (let p = 0; p < totalPaginas; p++) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.85, fill: { color: AGI_PPT_BLUE } });
    slide.addShape("rect", { x: 0, y: 0.85, w: 13.33, h: 0.05, fill: { color: AGI_PPT_GREEN } });
    if (logo) slide.addImage({ data: logo, x: 0.35, y: 0.14, w: 0.92, h: 0.57 });
    slide.addText(`Projetos em Andamento — Vertical ${area}`, { x: 1.5, y: 0.12, w: 9.5, h: 0.4, color: "FFFFFF", fontSize: 20, bold: true, fontFace: "Arial" });
    slide.addText(`Período: ${periodo} · ordenado por prioridade`, { x: 1.5, y: 0.5, w: 8, h: 0.3, color: "C7D8F5", fontSize: 11, fontFace: "Arial" });
    slide.addText(`${p + 1} / ${totalPaginas}`, { x: 12.2, y: 0.25, w: 0.9, h: 0.35, color: "FFFFFF", fontSize: 12, align: "right", fontFace: "Arial" });

    const pagina = itens.slice(p * porPagina, (p + 1) * porPagina);
    const header = ["Projeto", "Frente", "Tema Macro", "Status", "Prazo", "Prioridade", "Focal"].map(t => ({
      text: t,
      options: { bold: true, color: "FFFFFF", fill: { color: AGI_PPT_BLUE }, fontSize: 11, align: "left" as const, valign: "middle" as const },
    }));
    const rows = pagina.map((item, i) => {
      const zebra = i % 2 === 0 ? "FFFFFF" : "F3F6FC";
      const pc = PPT_PRIORIDADE_CORES[item.prioridade] || { fill: zebra, text: "374151" };
      const sc = PPT_STATUS_CORES[item.status] || { fill: zebra, text: "374151" };
      const base = { fontSize: 10, color: "1F2937", fill: { color: zebra }, valign: "middle" as const };
      return [
        { text: item.atividade || "—", options: { ...base, bold: true } },
        { text: item.area || "—", options: base },
        { text: item.temaMacro || "—", options: base },
        { text: item.status || "—", options: { ...base, color: sc.text, fill: { color: sc.fill }, bold: true, align: "center" as const } },
        { text: pptFormatData(item.dataLimite), options: { ...base, align: "center" as const } },
        { text: item.prioridade || "—", options: { ...base, color: pc.text, fill: { color: pc.fill }, bold: true, align: "center" as const } },
        { text: item.focal || "—", options: base },
      ];
    });
    slide.addTable([header, ...rows], {
      x: 0.35,
      y: 1.15,
      w: 12.63,
      colW: [3.9, 1.35, 2.0, 1.45, 1.05, 1.15, 1.73],
      border: { type: "solid", color: "D8E0F0", pt: 0.5 },
      rowH: 0.52,
      fontFace: "Arial",
    });
  }

  // Slides de Timeline (Gantt) — mesmos projetos, mesma ordenação
  addTimelineSlides(pptx, itens, logo, periodo, area, inicio, fim);

  const nomeArquivo = `Projetos_Em_Andamento_${area.replace(/\s+/g, "_")}_${dataInicio}_a_${dataFim}.pptx`;
  await pptx.writeFile({ fileName: nomeArquivo });
  return itens.length;
}

// ─── Modal de exportação ─────────────────────────────────────────────────────

export function ExportPptModal({ projects, area, onClose }: {
  projects: FupItem[];
  area: Area;
  onClose: () => void;
}) {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleGerar() {
    if (!dataInicio || !dataFim) {
      setErro("Selecione a data inicial e a data final.");
      return;
    }
    setErro(null);
    setGerando(true);
    try {
      const n = await gerarPowerPoint(projects, area, dataInicio, dataFim);
      if (n === 0) {
        setErro("Nenhum projeto em andamento com prazo dentro do período selecionado.");
        return;
      }
      onClose();
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao gerar o PowerPoint. Tente novamente.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(15,23,42,0.45)" }}
      onClick={() => { if (!gerando) onClose(); }}
    >
      <div
        className="w-[400px] rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#FFFFFF", fontFamily: "Inter, sans-serif" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4" style={{ background: "#0033B0" }}>
          <p className="text-white font-bold text-lg leading-tight">Exportar PowerPoint</p>
          <p className="text-xs mt-0.5" style={{ color: "#C7D8F5" }}>
            Vertical {area} · projetos em andamento · ordenados por prioridade
          </p>
          <div className="h-1 w-16 rounded mt-2" style={{ background: "#2FC750" }} />
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: "#475569" }}>Data inicial</label>
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "#EEF2F7", border: "1px solid rgba(15,23,42,0.1)", color: "#1E293B" }}
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: "#475569" }}>Data final</label>
            <input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "#EEF2F7", border: "1px solid rgba(15,23,42,0.1)", color: "#1E293B" }}
            />
          </div>
          <p className="text-[11px]" style={{ color: "#94A3B8" }}>
            Serão incluídos apenas projetos em andamento com prazo dentro do período,
            ordenados por prioridade (Crítico → Baixo).
          </p>
          {erro && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ color: "#EF4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              {erro}
            </p>
          )}
          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={onClose}
              disabled={gerando}
              className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ background: "rgba(15,23,42,0.05)", color: "#64748B" }}
            >
              Cancelar
            </button>
            <button
              onClick={handleGerar}
              disabled={gerando}
              className="px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-60"
              style={{ background: "#0033B0", color: "#FFFFFF" }}
            >
              {gerando ? "Gerando…" : "Gerar PPT"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
