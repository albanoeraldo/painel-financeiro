import { initHeader } from "./ui.js";
import { loadState, formatBRL, ymToLabel } from "./storage.js";

initHeader("ano");

const state = loadState();
const monthsKeys = Object.keys(state.months || {}).sort();

// Se não tiver mês criado ainda
if (monthsKeys.length === 0) {
  const tbody = document.querySelector("#yearTable tbody");
  tbody.innerHTML = `<tr><td colspan="6">Nenhum mês cadastrado ainda. Cadastre fixas/cartão/metas em algum mês.</td></tr>`;
}

function sum(arr){ return (arr || []).reduce((a,b)=> a + Number(b || 0), 0); }

function rendaMes(m){
  const base = Number(m.incomeBase || m.income || 0);
  const extras = Array.isArray(m.incomeExtra)
    ? m.incomeExtra.reduce((a,b)=> a + Number(b.value || 0), 0)
    : 0;
  return base + extras;
}

function fixasMes(m){
  return sum((m.fixed || []).map(x => x.value));
}

function cartaoMes(m){
  return sum((m.card || []).map(x => x.monthValue));
}

function metasMes(m){
  return sum((m.goals || []).map(x => x.saved));
}

function buildYearData(){
  const labels = [];
  const rendaArr = [];
  const fixasArr = [];
  const cartaoArr = [];
  const metasArr = [];
  const saldoArr = [];

  monthsKeys.forEach(ym => {
    const m = state.months[ym];

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

  return { labels, rendaArr, fixasArr, cartaoArr, metasArr, saldoArr };
}

function renderTable(data){
  const tbody = document.querySelector("#yearTable tbody");

  tbody.innerHTML = monthsKeys.map((ym, i) => {
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
  const saldoAno = totalRenda - totalFixas - totalCartao - totalMetas;

  // maior gasto do ano (categoria)
  const gastos = [
    { label: "Fixas", value: totalFixas },
    { label: "Cartão", value: totalCartao },
    { label: "Metas", value: totalMetas },
  ].sort((a,b)=> b.value - a.value);

  const el = document.getElementById("yearKpis");
  el.innerHTML = `
    <div class="card kpi">
      <div class="label">Renda total</div>
      <div class="value">${formatBRL(totalRenda)}</div>
    </div>
    <div class="card kpi">
      <div class="label">Despesas (total)</div>
      <div class="value">${formatBRL(totalFixas + totalCartao + totalMetas)}</div>
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
  `;
}

function renderCharts(data){
  const ctxSaldo = document.getElementById("chartSaldo");
  const ctxBars = document.getElementById("chartBars");
  const ctxPie = document.getElementById("chartPie");

  // Linha: saldo
  new Chart(ctxSaldo, {
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

  // Barras: renda x despesas
  const despesasArr = data.fixasArr.map((_, i) => data.fixasArr[i] + data.cartaoArr[i] + data.metasArr[i]);

  new Chart(ctxBars, {
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

  // Pizza: total por categoria no ano
  const totalFixas = sum(data.fixasArr);
  const totalCartao = sum(data.cartaoArr);
  const totalMetas = sum(data.metasArr);

  new Chart(ctxPie, {
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

// roda tudo
const data = buildYearData();
renderTable(data);
renderKpis(data);
renderCharts(data);
