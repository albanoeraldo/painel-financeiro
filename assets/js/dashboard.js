import { initHeader, getSelectedMonth } from "./ui.js";
import { loadState, saveState, ensureMonth, formatBRL, ymToLabel } from "./storage.js";

initHeader("dashboard");

const ym = getSelectedMonth();
const state = loadState();
const month = ensureMonth(state, ym);
saveState(state);

document.querySelector("#monthLabel").textContent = ymToLabel(ym);

function sum(arr){ return arr.reduce((a,b)=> a + Number(b||0), 0); }

const totalFixas = sum(month.fixed.map(x=> x.value));
const totalCartao = sum(month.card.map(x=> x.monthValue));
const totalMetas = sum(month.goals.map(x=> x.saved));
const renda = Number(month.income || 0);
const saldo = renda - totalFixas - totalCartao - totalMetas;

const kpis = [
  { label:"Renda do mês", value: formatBRL(renda) },
  { label:"Fixas", value: formatBRL(totalFixas) },
  { label:"Cartão (parcelas do mês)", value: formatBRL(totalCartao) },
  { label:"Metas (guardado no mês)", value: formatBRL(totalMetas) },
  { label:"Saldo (sobra/falta)", value: formatBRL(saldo), badge: saldo >= 0 ? "ok" : "bad" },
];

const kpiEl = document.querySelector("#kpis");
kpiEl.innerHTML = kpis.map(k=>{
  const cls = k.badge ? `badge ${k.badge}` : "badge";
  return `
    <div class="card kpi">
      <div class="label">${k.label}</div>
      <div class="value">${k.value}</div>
      ${k.badge ? `<div style="margin-top:10px;"><span class="${cls}">${k.badge === "ok" ? "✅ Positivo" : "❌ Negativo"}</span></div>` : ""}
    </div>
  `;
}).join("");

// Tabela anual
const tbody = document.querySelector("#yearTable tbody");
const months = Object.keys(state.months).sort();
tbody.innerHTML = months.map(ymKey=>{
  const m = state.months[ymKey];
  const fixas = sum(m.fixed.map(x=> x.value));
  const cartao = sum(m.card.map(x=> x.monthValue));
  const metas  = sum(m.goals.map(x=> x.saved));
  const renda  = Number(m.income||0);
  const saldo  = renda - fixas - cartao - metas;

  return `
    <tr>
      <td>${ymToLabel(ymKey)}</td>
      <td class="right">${formatBRL(renda)}</td>
      <td class="right">${formatBRL(fixas)}</td>
      <td class="right">${formatBRL(cartao)}</td>
      <td class="right">${formatBRL(metas)}</td>
      <td class="right"><span class="badge ${saldo>=0?"ok":"bad"}">${formatBRL(saldo)}</span></td>
    </tr>
  `;
}).join("");
