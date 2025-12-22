import { initHeader, getSelectedMonth } from "./ui.js";
import { loadState, saveState, ensureMonth, uid, formatBRL, ymToLabel } from "./storage.js";

initHeader("dashboard");

// Estado e mês (LET pq muda quando troca o mês)
let ym = getSelectedMonth();
const state = loadState();
let month = ensureMonth(state, ym);

// UI
const monthLabelEl = document.querySelector("#monthLabel");

// Elementos
const incomeBaseInput = document.getElementById("incomeBase");
const saveIncomeBaseBtn = document.getElementById("saveIncomeBase");
const clearSalaryBtn = document.getElementById("clearSalary");

const extraNameInput = document.getElementById("incomeExtraName");
const extraValueInput = document.getElementById("incomeExtraValue");
const addExtraBtn = document.getElementById("addIncomeExtra");
const extraTbody = document.querySelector("#incomeExtraTable tbody");

// Helpers
function sum(arr) {
  return (arr || []).reduce((a, b) => a + Number(b || 0), 0);
}

function ensureMonthShape(m) {
  m.incomeBase = Number(m.incomeBase || 0);
  m.incomeExtra = Array.isArray(m.incomeExtra) ? m.incomeExtra : [];
  m.fixed = Array.isArray(m.fixed) ? m.fixed : [];
  m.card = Array.isArray(m.card) ? m.card : [];
  m.goals = Array.isArray(m.goals) ? m.goals : [];
  return m;
}

function calcMonthTotals(m) {
  const fixed = sum((m.fixed || []).map(x => x.value));
  const card = sum((m.card || []).map(x => x.monthValue));
  const goals = sum((m.goals || []).map(x => x.saved));
  const incomeBase = Number(m.incomeBase || 0);
  const incomeExtra = (m.incomeExtra || []).reduce((a, b) => a + Number(b.value || 0), 0);
  const income = incomeBase + incomeExtra;
  const saldo = income - fixed - card - goals;
  return { fixed, card, goals, incomeBase, incomeExtra, income, saldo };
}

// --- Renders ---
function renderKpis() {
  const { fixed, card, goals, income, saldo } = calcMonthTotals(month);

  const kpis = [
    { label: "Renda do mês", value: formatBRL(income) },
    { label: "Fixas", value: formatBRL(fixed) },
    { label: "Cartão (parcelas do mês)", value: formatBRL(card) },
    { label: "Metas (guardado no mês)", value: formatBRL(goals) },
    { label: "Saldo (sobra/falta)", value: formatBRL(saldo), badge: saldo >= 0 ? "ok" : "bad" },
  ];

  const kpiEl = document.querySelector("#kpis");
  if (!kpiEl) return;

  kpiEl.innerHTML = kpis.map((k) => {
    const cls = k.badge ? `badge ${k.badge}` : "badge";
    return `
      <div class="card kpi">
        <div class="label">${k.label}</div>
        <div class="value">${k.value}</div>
        ${k.badge ? `<div style="margin-top:10px;"><span class="${cls}">${k.badge === "ok" ? "✅ Positivo" : "❌ Negativo"}</span></div>` : ""}
      </div>
    `;
  }).join("");
}

function renderBreakdown() {
  const totalFixas = (month.fixed || []).reduce((a,b)=> a + Number(b.value || 0), 0);
  const totalCartao = (month.card || []).reduce((a,b)=> a + Number(b.monthValue || 0), 0);
  const totalMetas  = (month.goals || []).reduce((a,b)=> a + Number(b.saved || 0), 0);

  const totalDespesas = totalFixas + totalCartao + totalMetas;

  const tbody = document.querySelector("#monthBreakdown tbody");
  if (!tbody) return;

  const rows = [
    { name: "Fixas", value: totalFixas },
    { name: "Cartão", value: totalCartao },
    { name: "Metas", value: totalMetas },
  ];

  tbody.innerHTML = rows.map(r => {
    const pct = totalDespesas > 0 ? (r.value / totalDespesas) * 100 : 0;
    return `
      <tr>
        <td>${r.name}</td>
        <td class="right">${formatBRL(r.value)}</td>
        <td class="right">${totalDespesas > 0 ? pct.toFixed(1) + "%" : "-"}</td>
      </tr>
    `;
  }).join("");
}

function renderExtras() {
  if (!extraTbody) return;

  // estado vazio
  const hasExtras = (month.incomeExtra || []).length > 0;
  if (incomeEmpty) incomeEmpty.style.display = hasExtras ? "none" : "flex";
  document.getElementById("incomeExtraTable").style.display = hasExtras ? "table" : "none";

  extraTbody.innerHTML = (month.incomeExtra || []).map(item => `
    <tr>
      <td>${item.name}</td>
      <td class="right">${formatBRL(item.value)}</td>
      <td class="right"><button class="del-extra" data-id="${item.id}">Excluir</button></td>
    </tr>
  `).join("");

  extraTbody.querySelectorAll(".del-extra").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      month.incomeExtra = (month.incomeExtra || []).filter(x => x.id !== id);
      saveState(state);
      renderDashboard(); // ✅ atualiza na hora
    });
  });
}

const incomeEmpty = document.getElementById("incomeEmpty");
const focusExtraBtn = document.getElementById("focusExtra");

focusExtraBtn?.addEventListener("click", () => {
  document.getElementById("incomeExtraName")?.focus();
});


function renderDashboard() {
  ym = getSelectedMonth();
  month = ensureMonth(state, ym);
  ensureMonthShape(month);
  saveState(state);

  if (monthLabelEl) monthLabelEl.textContent = ymToLabel(ym);

  // Input salário
  if (incomeBaseInput) incomeBaseInput.value = month.incomeBase ? Number(month.incomeBase) : "";

  renderKpis();
  renderExtras();
  renderBreakdown();
}

// --- Eventos ---
document.getElementById("monthSelect")?.addEventListener("change", () => {
  renderDashboard();
});

saveIncomeBaseBtn?.addEventListener("click", () => {
  month.incomeBase = Number(incomeBaseInput?.value || 0);
  saveState(state);
  renderDashboard();
});

clearSalaryBtn?.addEventListener("click", () => {
  month.incomeBase = 0;
  saveState(state);
  renderDashboard();
});

addExtraBtn?.addEventListener("click", () => {
  const name = extraNameInput?.value.trim();
  const value = Number(extraValueInput?.value);

  if (!name){
    extraNameInput?.classList.add("invalid");
    return;
  } else {
    extraNameInput?.classList.remove("invalid");
  }

  if (!value || value <= 0){
    extraValueInput?.classList.add("invalid");
    return;
  } else {
    extraValueInput?.classList.remove("invalid");
  }

  month.incomeExtra.push({ id: uid(), name, value });
  saveState(state);

  extraNameInput.value = "";
  extraValueInput.value = "";

  renderDashboard(); // atualiza sem F5
});

// Inicial
renderDashboard();
