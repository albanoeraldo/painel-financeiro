import { initHeader, getSelectedMonth } from "./ui.js";
import { loadState, saveState, ensureMonth, uid, formatBRL, ymToLabel } from "./storage.js";

initHeader("dashboard");

// Estado e mês (precisa ser LET pq muda quando troca o mês)
let ym = getSelectedMonth();
const state = loadState();
let month = ensureMonth(state, ym);

// Garante estrutura
month.incomeBase = Number(month.incomeBase || 0);
month.incomeExtra = Array.isArray(month.incomeExtra) ? month.incomeExtra : [];
month.fixed = Array.isArray(month.fixed) ? month.fixed : [];
month.card = Array.isArray(month.card) ? month.card : [];
month.goals = Array.isArray(month.goals) ? month.goals : [];
saveState(state);

// UI
const monthLabelEl = document.querySelector("#monthLabel");
if (monthLabelEl) monthLabelEl.textContent = ymToLabel(ym);

// Helpers
function sum(arr) {
  return (arr || []).reduce((a, b) => a + Number(b || 0), 0);
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

// --- Elementos do Dashboard (Entradas) ---
const incomeBaseInput = document.getElementById("incomeBase");
const saveIncomeBaseBtn = document.getElementById("saveIncomeBase");
const clearSalaryBtn = document.getElementById("clearSalary");

const extraNameInput = document.getElementById("incomeExtraName");
const extraValueInput = document.getElementById("incomeExtraValue");
const addExtraBtn = document.getElementById("addIncomeExtra");
const extraTbody = document.querySelector("#incomeExtraTable tbody");

// --- Renderizações ---
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

  kpiEl.innerHTML = kpis
    .map((k) => {
      const cls = k.badge ? `badge ${k.badge}` : "badge";
      return `
        <div class="card kpi">
          <div class="label">${k.label}</div>
          <div class="value">${k.value}</div>
          ${
            k.badge
              ? `<div style="margin-top:10px;">
                   <span class="${cls}">${k.badge === "ok" ? "✅ Positivo" : "❌ Negativo"}</span>
                 </div>`
              : ""
          }
        </div>
      `;
    })
    .join("");
}

function renderYearTable() {
  const tbody = document.querySelector("#yearTable tbody");
  if (!tbody) return;

  const monthsKeys = Object.keys(state.months || {}).sort();

  tbody.innerHTML = monthsKeys
    .map((ymKey) => {
      const m = state.months[ymKey] || {};
      const { fixed, card, goals, income, saldo } = calcMonthTotals(m);

      return `
        <tr>
          <td>${ymToLabel(ymKey)}</td>
          <td class="right">${formatBRL(income)}</td>
          <td class="right">${formatBRL(fixed)}</td>
          <td class="right">${formatBRL(card)}</td>
          <td class="right">${formatBRL(goals)}</td>
          <td class="right">
            <span class="badge ${saldo >= 0 ? "ok" : "bad"}">${formatBRL(saldo)}</span>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderExtras() {
  if (!extraTbody) return;

  extraTbody.innerHTML = (month.incomeExtra || [])
    .map(
      (item) => `
      <tr>
        <td>${item.name}</td>
        <td class="right">${formatBRL(item.value)}</td>
        <td class="right">
          <button class="del-extra" data-id="${item.id}">Excluir</button>
        </td>
      </tr>
    `
    )
    .join("");

  extraTbody.querySelectorAll(".del-extra").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      month.incomeExtra = (month.incomeExtra || []).filter((x) => x.id !== id);
      saveState(state);
      renderDashboard(); // ✅ atualiza na hora
    });
  });
}

function renderDashboard() {
  // Atualiza o label do mês
  ym = getSelectedMonth();
  month = ensureMonth(state, ym);

  // Garante estrutura sempre
  month.incomeBase = Number(month.incomeBase || 0);
  month.incomeExtra = Array.isArray(month.incomeExtra) ? month.incomeExtra : [];
  month.fixed = Array.isArray(month.fixed) ? month.fixed : [];
  month.card = Array.isArray(month.card) ? month.card : [];
  month.goals = Array.isArray(month.goals) ? month.goals : [];

  saveState(state);

  if (monthLabelEl) monthLabelEl.textContent = ymToLabel(ym);

  // Preenche input do salário
  if (incomeBaseInput) incomeBaseInput.value = month.incomeBase ? Number(month.incomeBase) : "";

  renderKpis();
  renderExtras();
  renderYearTable();
}

// --- Eventos ---

// Quando troca o mês no select (criado pelo initHeader)
const monthSelect = document.getElementById("monthSelect");
monthSelect?.addEventListener("change", () => {
  renderDashboard();
});

// Salvar salário
saveIncomeBaseBtn?.addEventListener("click", () => {
  month.incomeBase = Number(incomeBaseInput?.value || 0);
  saveState(state);
  renderDashboard();
});

// Remover/zerar salário
clearSalaryBtn?.addEventListener("click", () => {
  month.incomeBase = 0;
  saveState(state);
  renderDashboard();
});

// Adicionar renda extra
addExtraBtn?.addEventListener("click", () => {
  const name = extraNameInput?.value.trim();
  const value = Number(extraValueInput?.value);

  if (!name || !value) return;

  month.incomeExtra.push({ id: uid(), name, value });
  saveState(state);

  extraNameInput.value = "";
  extraValueInput.value = "";

  renderDashboard(); // ✅ sem F5
});

// Primeira renderização
renderDashboard();
