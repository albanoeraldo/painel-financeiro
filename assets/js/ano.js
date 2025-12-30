import { initHeader, getSelectedMonth } from "./ui.js";
import { loadState, formatBRL, ymToLabel } from "./storage.js";
import { pullStateFromCloud } from "./cloudState.js";

await initHeader("ano");

// puxa nuvem e joga no local antes de renderizar
const cloud = await pullStateFromCloud();
if (cloud) localStorage.setItem("albano_financas_v1", JSON.stringify(cloud));

const state = loadState();
const allMonthKeys = Object.keys(state.months || {}).sort();

// Chart instances (pra não duplicar)
let chartSaldo = null;
let chartBars = null;
let chartPie = null;

function sum(arr){ return (arr || []).reduce((a,b)=> a + Number(b || 0), 0); }

function normalizeMonth(m){
  m = m || {};
  m.fixed = Array.isArray(m.fixed) ? m.fixed : [];
  m.card  = Array.isArray(m.card) ? m.card : [];
  m.cardRecurring = Array.isArray(m.cardRecurring) ? m.cardRecurring : []; // ✅ NEW
  m.goals = Array.isArray(m.goals) ? m.goals : [];
  m.incomeExtra = Array.isArray(m.incomeExtra) ? m.incomeExtra : [];
  return m;
}

function rendaMes(m){
  m = normalizeMonth(m);
  const base = Number(m.incomeBase ?? m.income ?? 0);
  const extras = m.incomeExtra.reduce((a,b)=> a + Number(b.value || 0), 0);
  return base + extras;
}

function fixasMes(m){
  m = normalizeMonth(m);
  return sum(m.fixed.map(x => x.value));
}

// ✅ cartão = parcelas + assinaturas ativas
function cartaoMes(m){
  m = normalizeMonth(m);
  const parts = sum(m.card.map(x => x.monthValue));
  const rec = sum(m.cardRecurring
    .filter(x => x && x.active !== false)
    .map(x => x.value));
  return parts + rec;
}

function metasMes(m){
  m = normalizeMonth(m);
  return sum(m.goals.map(x => x.saved));
}

function getSelectedYear(){
  const ym = getSelectedMonth(); // "YYYY-MM"
  return Number(String(ym || "").split("-")[0]) || new Date().getFullYear();
}

function getYearKeys(year){
  return allMonthKeys.filter(ym => String(ym).startsWith(`${year}-`));
}

function buildYearData(year){
  const keys = getYearKeys(year);

  const labels = [];
  const rendaArr = [];
  const fixasArr = [];
  const cartaoArr = [];
  const metasArr = [];
  const saldoArr = [];

  keys.forEach(ym => {
    const m = normalizeMonth(state.months[ym]);

    const renda = rendaMes(m);
    const fixas = fixasMes(m);
    const cartao = cartaoMes(m);
    const metas  = metasMes(m);
    const saldo  = renda - fixas - cartao - metas;

    labels.push(ymToLabel(ym));
    rendaArr.push(renda);
    fixasArr.push(fixas);
    cartaoArr.push(cartao);
    metasArr.push(metas);
    saldoArr.push(saldo);
  });

  return { year, keys, labels, rendaArr, fixasArr, cartaoArr, metasArr, saldoArr };
}

function renderEmptyYear(year){
  const tbody = document.querySelector("#yearTable tbody");
  tbody.innerHTML = `
    <tr>
      <td colspan="6">
        Nenhum mês cadastrado em <b>${year}</b>.
        Cadastre fixas/cartão/metas em algum mês desse ano.
      </td>
    </tr>
  `;

  const kpiEl = document.getElementById("yearKpis");
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
      <div class="label">Despesas (total)</div>
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

  destroyCharts();
}

function destroyCharts(){
  if (chartSaldo) { chartSaldo.destroy(); chartSaldo = null; }
  if (chartBars)  { chartBars.destroy();  chartBars = null; }
  if (chartPie)   { chartPie.destroy();   chartPie = null; }
}

function renderTable(data){
  const tbody = document.querySelector("#yearTable tbody");

  tbody.innerHTML = data.keys.map((ym, i) => {
    const renda = data.rendaArr[i];
    const fixas = data.fixasArr[i];
    const cartao = data.cartaoArr[i];
    const metas = data.metasArr[i];
    const saldo = data.saldoArr[i];

    return `
      <tr>
        <td>${ymToLabel(ym)}</td>
        <td class="right">${formatBRL(renda)}</td>
        <td class="right">${formatBRL(fixas)}</td>
        <td class="right">${formatBRL(cartao)}</td>
        <td class="right">${formatBRL(metas)}</td>
        <td class="right">
          <span class="badge ${saldo >= 0 ? "ok" : "bad"}">${formatBRL(saldo)}</span>
        </td>
      </tr>
    `;
  }).join("");
}

function renderKpis(data){
  const totalRenda = sum(data.rendaArr);
  const totalFixas = sum(data.fixasArr);
  const totalCartao = sum(data.cartaoArr);
  const totalMetas = sum(data.metasArr);
  const totalDespesas = totalFixas + totalCartao + totalMetas;
  const saldoAno = totalRenda - totalDespesas;

  const bestIdx = data.saldoArr.length ? data.saldoArr.indexOf(Math.max(...data.saldoArr)) : -1;
  const worstIdx = data.saldoArr.length ? data.saldoArr.indexOf(Math.min(...data.saldoArr)) : -1;

  const bestLabel = bestIdx >= 0 ? data.labels[bestIdx] : "-";
  const worstLabel = worstIdx >= 0 ? data.labels[worstIdx] : "-";
  const bestVal = bestIdx >= 0 ? data.saldoArr[bestIdx] : 0;
  const worstVal = worstIdx >= 0 ? data.saldoArr[worstIdx] : 0;

  const avgSaldo = data.saldoArr.length ? (sum(data.saldoArr) / data.saldoArr.length) : 0;

  const gastos = [
    { label: "Fixas", value: totalFixas },
    { label: "Cartão", value: totalCartao },
    { label: "Metas", value: totalMetas },
  ].sort((a,b)=> b.value - a.value);

  const el = document.getElementById("yearKpis");
  el.innerHTML = `
    <div class="card kpi">
      <div class="label">Renda total (${data.year})</div>
      <div class="value">${formatBRL(totalRenda)}</div>
    </div>

    <div class="card kpi">
      <div class="label">Despesas (total)</div>
      <div class="value">${formatBRL(totalDespesas)}</div>
      <div class="helper">Fixas + Cartão + Metas</div>
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
      <div class="label">Maior peso no gasto</div>
      <div class="value">${gastos[0] ? gastos[0].label : "-"}</div>
      <div class="helper">${gastos[0] ? formatBRL(gastos[0].value) : ""}</div>
    </div>

    <div class="card kpi">
      <div class="label">Melhor mês (saldo)</div>
      <div class="value">${bestLabel}</div>
      <div class="helper">${formatBRL(bestVal)}</div>
    </div>

    <div class="card kpi">
      <div class="label">Pior mês (saldo)</div>
      <div class="value">${worstLabel}</div>
      <div class="helper">${formatBRL(worstVal)}</div>
    </div>

    <div class="card kpi">
      <div class="label">Média do saldo</div>
      <div class="value">${formatBRL(avgSaldo)}</div>
      <div class="helper">Média mensal</div>
    </div>
  `;
}

function renderCharts(data){
  destroyCharts();

  const ctxSaldo = document.getElementById("chartSaldo");
  const ctxBars = document.getElementById("chartBars");
  const ctxPie = document.getElementById("chartPie");

  if (!ctxSaldo || !ctxBars || !ctxPie) return;

  chartSaldo = new Chart(ctxSaldo, {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [{
        label: "Saldo",
        data: data.saldoArr,
        tension: 0.25
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } }
    }
  });

  const despesasArr = data.fixasArr.map((_, i) => data.fixasArr[i] + data.cartaoArr[i] + data.metasArr[i]);

  chartBars = new Chart(ctxBars, {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [
        { label: "Renda", data: data.rendaArr },
        { label: "Despesas", data: despesasArr }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } }
    }
  });

  const totalFixas = sum(data.fixasArr);
  const totalCartao = sum(data.cartaoArr);
  const totalMetas = sum(data.metasArr);

  chartPie = new Chart(ctxPie, {
    type: "pie",
    data: {
      labels: ["Fixas", "Cartão", "Metas"],
      datasets: [{
        data: [totalFixas, totalCartao, totalMetas]
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } }
    }
  });
}

function render(){
  const year = getSelectedYear();
  const data = buildYearData(year);

  if (!data.keys.length){
    renderEmptyYear(year);
    return;
  }

  renderTable(data);
  renderKpis(data);
  renderCharts(data);
}

document.getElementById("monthSelect")?.addEventListener("change", () => {
  render();
});

window.addEventListener("monthChanged", () => render());

// init
render();