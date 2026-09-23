import type { ReportFilters, ReportMetrics, WealthPoint } from "./reports";
import { formatBRL } from "./format";

export function exportReportCsv(metrics: ReportMetrics, filters: ReportFilters) {
  const lines = [
    ["Axionn Finance", "DRE Pessoal"], ["Período", `${filters.start} a ${filters.end}`], [],
    ["Resumo", "Valor"], ["Receitas", metrics.income], ["Despesas", metrics.expenses], ["Resultado", metrics.result], ["Taxa de poupança", metrics.savingsRate === null ? "Indisponível" : `${metrics.savingsRate.toFixed(2)}%`], [],
    ["Mês", "Receitas", "Despesas", "Resultado"], ...metrics.monthly.map((row) => [row.month, row.income, row.expenses, row.result]), [],
    ["Categoria", "Valor", "% das despesas"], ...metrics.categories.map((row) => [row.category, row.value, `${row.percent.toFixed(2)}%`]),
  ];
  const csv = "\uFEFF" + lines.map((line) => line.map((cell) => typeof cell === "number" ? cell.toFixed(2).replace(".", ",") : `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";")).join("\r\n");
  download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `axionn-dre-${filters.start}-${filters.end}.csv`);
}

export async function exportReportPdf(metrics: ReportMetrics, filters: ReportFilters, insights: string[], wealth: WealthPoint[]) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setProperties({ title: "DRE Pessoal — Axionn Finance", subject: `Relatório de ${filters.start} a ${filters.end}`, author: "Axionn Finance" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(21); doc.text("AXIONN FINANCE", 16, 20);
  doc.setFontSize(14); doc.text("Central de Inteligência Financeira", 16, 30);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`Período: ${filters.start} a ${filters.end}`, 16, 38);
  autoTable(doc, { startY: 46, head: [["Indicador", "Valor"]], body: [["Receitas", formatBRL(metrics.income)], ["Despesas", formatBRL(metrics.expenses)], ["Resultado", formatBRL(metrics.result)], ["Taxa de poupança", metrics.savingsRate === null ? "Indisponível" : `${metrics.savingsRate.toFixed(1).replace(".", ",")}%`]], theme: "grid", headStyles: { fillColor: [101, 53, 206] } });
  let y = (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 90;
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text("Resumo executivo", 16, y + 12);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); insights.forEach((insight, index) => { const rows = doc.splitTextToSize(`${index + 1}. ${insight}`, 174) as string[]; doc.text(rows, 16, y + 21 + index * 14); });
  y += 66;
  autoTable(doc, { startY: y, head: [["Mês", "Receitas", "Despesas", "Resultado"]], body: metrics.monthly.map((row) => [row.month, formatBRL(row.income), formatBRL(row.expenses), formatBRL(row.result)]), theme: "striped", headStyles: { fillColor: [44, 46, 57] } });
  doc.addPage(); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("Despesas por categoria", 16, 20);
  autoTable(doc, { startY: 27, head: [["Categoria", "Valor", "Participação"]], body: metrics.categories.map((row) => [row.category, formatBRL(row.value), `${row.percent.toFixed(1).replace(".", ",")}%`]), theme: "grid", headStyles: { fillColor: [101, 53, 206] } });
  if (wealth.length) { doc.addPage(); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("Patrimônio líquido", 16, 20); autoTable(doc, { startY: 27, head: [["Mês", "Patrimônio", "Liquidez"]], body: wealth.map((row) => [row.month, formatBRL(row.netWorth), formatBRL(row.liquidity)]), theme: "striped", headStyles: { fillColor: [44, 46, 57] } }); }
  const pages = doc.getNumberOfPages(); for (let page = 1; page <= pages; page += 1) { doc.setPage(page); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(110); doc.text(`Gerado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date())} · Documento informativo`, 16, 287); doc.text(`${page}/${pages}`, 190, 287, { align: "right" }); }
  doc.save(`axionn-dre-${filters.start}-${filters.end}.pdf`);
}

function download(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); }
