import { initHeader, renderUserName, getSelectedMonth } from "./ui.js";

import {
  loadState,
  formatBRL,
  ymToLabel,
} from "./storage.js";

import {
  calcMonthTotals,
} from "./finance.js";

/* =========================
   Boot
========================= */
await initHeader("ano", { syncCloud: true });
await renderUserName();

let state = loadState();

let chartSaldo = null;
let chartBars = null;
let chartPie = null;

/* =========================
   Helpers
========================= */
function sum(values) {
  return (values || []).reduce((total, value) => {
    return total + Number(value || 0);
  }, 0);
}

function isYm(value) {
  return /^\d{4}-\d{2}$/.test(String(value || ""));
}

function getSelectedYear() {
  const ym = getSelectedMonth();
  return Number(String(ym || "").split("-")[0]) || new Date().getFullYear();
}

function getAllMonthKeys() {
  state = loadState();

  return Object.keys(state.months || {})
    .filter(isYm)
    .sort();
}

function getYearKeys(year) {
  return getAllMonthKeys().filter((ym) => {
    return String(ym).startsWith(`${year}-`);
  });
}

function normalizeMonthForYear(month) {
  const m = month && typeof month === "object" ? month : {};

  m.incomeBase = Number(m.incomeBase || 0);
  m.incomeExtra = Array.isArray(m.incomeExtra) ? m.incomeExtra : [];
  m.fixed = Array.isArray(m.fixed) ? m.fixed : [];
  m.card = Array.isArray(m.card) ? m.card : [];
  m.cardRecurring = Array.isArray(m.cardRecurring) ? m.cardRecurring : [];
  m.goals = Array.isArray(m.goals) ? m.goals : [];

  return m;
}

function buildYearData(year) {
  const keys = getYearKeys(year);

  const labels = [];
  const rendaArr = [];
  const fixasArr = [];
  const fixasPagasArr = [];
  const fixasPendentesArr = [];
  const cartaoArr = [];
  const metasArr = [];
  const despesasArr = [];
  const saldoPlanejadoArr = [];
  const saldoRealizadoArr = [];

  keys.forEach((ym) => {
    const month = normalizeMonthForYear(state.months?.[ym]);
    const totals = calcMonthTotals(month);

    const despesas = totals.plannedExpenses;
    const saldoPlanejado = totals.plannedBalance;
    const saldoRealizado = totals.realizedBalance;

    labels.push(ymToLabel(ym));

    rendaArr.push(totals.income);
    fixasArr.push(totals.fixedTotal);
    fixasPagasArr.push(totals.fixedPaid);
    fixasPendentesArr.push(totals.fixedPending);
    cartaoArr.push(totals.card);
    metasArr.push(totals.goals);
    despesasArr.push(despesas);
    saldoPlanejadoArr.push(saldoPlanejado);
    saldoRealizadoArr.push(saldoRealizado);
  });

  return {
    year,
    keys,
    labels,
    rendaArr,
    fixasArr,
    fixasPagasArr,
    fixasPendentesArr,
    cartaoArr,
    metasArr,
    despesasArr,
    saldoPlanejadoArr,
    saldoRealizadoArr,
  };
}

function destroyCharts() {
  if (chartSaldo) {
    chartSaldo.destroy();
    chartSaldo = null;
  }

  if (chartBars) {
    chartBars.destroy();
    chartBars = null;
  }

  if (chartPie) {
    chartPie.destroy();
    chartPie = null;
  }
}

function getChartGlobal() {
  if (typeof Chart === "undefined") {
    console.warn("Chart.js não foi carregado.");
    return null;
  }

  return Chart;
}

/* =========================
   Empty State
========================= */
function renderEmptyYear(year) {
  const tbody = document.querySelector("#yearTable tbody");
  const kpiEl = document.getElementById("yearKpis");

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty">
            <div>
              <div class="title">Nenhum mês cadastrado em ${year}</div>
              <div class="desc">
                Cadastre fixas, cartão, metas ou entradas em algum mês desse ano para gerar o resumo.
              </div>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  if (kpiEl) {
    kpiEl.innerHTML = `
      <div class="card kpi">
        <div class="label">Ano</div>
        <div class="value">${year}</div>
        <div class="helper">Sem dados ainda</div>
      </div>

      <div class="card kpi">
        <div class="label">Renda total</div>
        <div class="value">${formatBRL(0)}</div>
      </div>

      <div class="card kpi">
        <div class="label">Despesas totais</div>
        <div class="value">${formatBRL(0)}</div>
      </div>

      <div class="card kpi">
        <div class="label">Saldo do ano</div>
        <div class="value">${formatBRL(0)}</div>
        <div style="margin-top:10px;">
          <span class="badge">—</span>
        </div>
      </div>
    `;
  }

  destroyCharts();
}

/* =========================
   Tabela
========================= */
function renderTable(data) {
  const tbody = document.querySelector("#yearTable tbody");

  if (!tbody) return;

  tbody.innerHTML = data.keys
    .map((ym, index) => {
      const renda = data.rendaArr[index];
      const fixas = data.fixasArr[index];
      const cartao = data.cartaoArr[index];
      const metas = data.metasArr[index];
      const saldo = data.saldoPlanejadoArr[index];

      return `
        <tr>
          <td>${ymToLabel(ym)}</td>
          <td class="right">${formatBRL(renda)}</td>
          <td class="right">${formatBRL(fixas)}</td>
          <td class="right">${formatBRL(cartao)}</td>
          <td class="right">${formatBRL(metas)}</td>
          <td class="right">
            <span class="badge ${saldo >= 0 ? "ok" : "bad"}">
              ${formatBRL(saldo)}
            </span>
          </td>
        </tr>
      `;
    })
    .join("");
}

/* =========================
   KPIs
========================= */
function renderKpis(data) {
  const totalRenda = sum(data.rendaArr);
  const totalFixas = sum(data.fixasArr);
  const totalFixasPagas = sum(data.fixasPagasArr);
  const totalFixasPendentes = sum(data.fixasPendentesArr);
  const totalCartao = sum(data.cartaoArr);
  const totalMetas = sum(data.metasArr);
  const totalDespesas = sum(data.despesasArr);

  const saldoAno = totalRenda - totalDespesas;
  const mediaSaldo = data.saldoPlanejadoArr.length
    ? sum(data.saldoPlanejadoArr) / data.saldoPlanejadoArr.length
    : 0;

  const bestIndex = data.saldoPlanejadoArr.length
    ? data.saldoPlanejadoArr.indexOf(Math.max(...data.saldoPlanejadoArr))
    : -1;

  const worstIndex = data.saldoPlanejadoArr.length
    ? data.saldoPlanejadoArr.indexOf(Math.min(...data.saldoPlanejadoArr))
    : -1;

  const bestLabel = bestIndex >= 0 ? data.labels[bestIndex] : "-";
  const worstLabel = worstIndex >= 0 ? data.labels[worstIndex] : "-";

  const bestValue = bestIndex >= 0 ? data.saldoPlanejadoArr[bestIndex] : 0;
  const worstValue = worstIndex >= 0 ? data.saldoPlanejadoArr[worstIndex] : 0;

  const biggestExpense = [
    {
      label: "Fixas",
      value: totalFixas,
    },
    {
      label: "Cartão",
      value: totalCartao,
    },
    {
      label: "Metas",
      value: totalMetas,
    },
  ].sort((a, b) => b.value - a.value)[0];

  const comprometimento = totalRenda > 0
    ? (totalDespesas / totalRenda) * 100
    : 0;

  const el = document.getElementById("yearKpis");

  if (!el) return;

  el.innerHTML = `
    <div class="card kpi">
      <div class="label">Renda total (${data.year})</div>
      <div class="value">${formatBRL(totalRenda)}</div>
      <div class="helper">Base + entradas extras dos meses criados.</div>
    </div>

    <div class="card kpi">
      <div class="label">Despesas totais</div>
      <div class="value">${formatBRL(totalDespesas)}</div>
      <div class="helper">Fixas + Cartão + Metas.</div>
    </div>

    <div class="card kpi">
      <div class="label">Saldo do ano</div>
      <div class="value">${formatBRL(saldoAno)}</div>
      <div style="margin-top:10px;">
        <span class="badge ${saldoAno >= 0 ? "ok" : "bad"}">
          ${saldoAno >= 0 ? "✅ Positivo" : "❌ Negativo"}
        </span>
      </div>
    </div>

    <div class="card kpi">
      <div class="label">Comprometimento da renda</div>
      <div class="value">${comprometimento.toFixed(1)}%</div>
      <div class="helper">Quanto das entradas foi para despesas planejadas.</div>
    </div>

    <div class="card kpi">
      <div class="label">Maior peso no gasto</div>
      <div class="value">${biggestExpense?.label || "-"}</div>
      <div class="helper">${biggestExpense ? formatBRL(biggestExpense.value) : ""}</div>
    </div>

    <div class="card kpi">
      <div class="label">Fixas no ano</div>
      <div class="value">${formatBRL(totalFixas)}</div>
      <div class="helper">
        Pagas: <b>${formatBRL(totalFixasPagas)}</b> •
        Pendentes: <b>${formatBRL(totalFixasPendentes)}</b>
      </div>
    </div>

    <div class="card kpi">
      <div class="label">Melhor mês</div>
      <div class="value">${bestLabel}</div>
      <div class="helper">${formatBRL(bestValue)}</div>
    </div>

    <div class="card kpi">
      <div class="label">Pior mês</div>
      <div class="value">${worstLabel}</div>
      <div class="helper">${formatBRL(worstValue)}</div>
    </div>

    <div class="card kpi">
      <div class="label">Média do saldo</div>
      <div class="value">${formatBRL(mediaSaldo)}</div>
      <div class="helper">Média mensal dos meses criados.</div>
    </div>
  `;
}

/* =========================
   Gráficos
========================= */
function renderCharts(data) {
  destroyCharts();

  const ChartLib = getChartGlobal();

  if (!ChartLib) return;

  const ctxSaldo = document.getElementById("chartSaldo");
  const ctxBars = document.getElementById("chartBars");
  const ctxPie = document.getElementById("chartPie");

  if (!ctxSaldo || !ctxBars || !ctxPie) return;

  chartSaldo = new ChartLib(ctxSaldo, {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Saldo planejado",
          data: data.saldoPlanejadoArr,
          tension: 0.25,
        },
        {
          label: "Saldo realizado",
          data: data.saldoRealizadoArr,
          tension: 0.25,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
        },
      },
    },
  });

  chartBars = new ChartLib(ctxBars, {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Renda",
          data: data.rendaArr,
        },
        {
          label: "Despesas",
          data: data.despesasArr,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
        },
      },
    },
  });

  const totalFixas = sum(data.fixasArr);
  const totalCartao = sum(data.cartaoArr);
  const totalMetas = sum(data.metasArr);

  chartPie = new ChartLib(ctxPie, {
    type: "pie",
    data: {
      labels: ["Fixas", "Cartão", "Metas"],
      datasets: [
        {
          data: [totalFixas, totalCartao, totalMetas],
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
        },
      },
    },
  });
}

/* =========================
   Render principal
========================= */
function render() {
  const year = getSelectedYear();
  const data = buildYearData(year);

  if (!data.keys.length) {
    renderEmptyYear(year);
    return;
  }

  renderTable(data);
  renderKpis(data);
  renderCharts(data);
}

/* =========================
   Eventos
========================= */
document.getElementById("monthSelect")?.addEventListener("change", () => {
  render();
});

window.addEventListener("monthChanged", () => {
  render();
});

/* =========================
   Init
========================= */
render();