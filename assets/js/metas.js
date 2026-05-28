import { initHeader, renderUserName, getSelectedMonth } from "./ui.js";

import {
  loadState,
  saveState,
  ensureMonth,
  uid,
  formatBRL,
  ymToLabel,
  escapeHTML,
  parseMoneyInput,
} from "./storage.js";

import { createValidator } from "./validate.js";
import { goalsTotal } from "./finance.js";

/* =========================
   Boot
========================= */
await initHeader("metas", { syncCloud: true });
await renderUserName();

let ym = getSelectedMonth();
const state = loadState();

const monthAlreadyExists = !!state.months?.[ym];
let month = ensureMonth(state, ym);

const beforeNormalize = JSON.stringify(month.goals);
normalizeGoalsMonth(month);
const afterNormalize = JSON.stringify(month.goals);

if (!monthAlreadyExists || beforeNormalize !== afterNormalize) {
  saveState(state);
}

/* =========================
   Elementos
========================= */
const nameInput = document.getElementById("name");
const targetInput = document.getElementById("target");
const savedInput = document.getElementById("saved");
const addBtn = document.getElementById("add");

const nameErr = document.getElementById("nameError");
const targetErr = document.getElementById("targetError");
const savedErr = document.getElementById("savedError");

const tbody = document.querySelector("#table tbody");
const totalEl = document.getElementById("total");

const v = createValidator({ showOn: "submit" });

let pendingDeleteId = null;
let pendingDeleteTimer = null;

/* =========================
   Normalização
========================= */
function normalizeGoalsMonth(m) {
  m.goals = Array.isArray(m.goals) ? m.goals : [];

  m.goals = m.goals.map((goal) => ({
    id: goal.id || uid(),
    name: String(goal.name || "").trim(),
    target: Number(goal.target || 0) || 0,
    saved: Number(goal.saved || 0) || 0,
  }));

  return m;
}

/* =========================
   Helpers
========================= */
function clearErr(input, errEl) {
  input?.classList.remove("invalid");
  if (errEl) errEl.textContent = "";
}

function resetForm() {
  if (nameInput) nameInput.value = "";
  if (targetInput) targetInput.value = "";
  if (savedInput) savedInput.value = "";

  v.setShowMsg(false);

  clearErr(nameInput, nameErr);
  clearErr(targetInput, targetErr);
  clearErr(savedInput, savedErr);

  validateAllGoals();
}

function goalPercent(goal) {
  const target = Number(goal.target || 0);
  const saved = Number(goal.saved || 0);

  if (target <= 0) return 0;

  return Math.min((saved / target) * 100, 100);
}

function remainingValue(goal) {
  return Math.max(Number(goal.target || 0) - Number(goal.saved || 0), 0);
}

/* =========================
   Validações
========================= */
function ruleName() {
  return v.required(nameInput, nameErr, "Informe a meta.");
}

function ruleTarget() {
  return v.numberMin(
    targetInput,
    targetErr,
    0.01,
    "Informe um custo total maior que 0."
  );
}

function ruleSavedOptional() {
  const raw = (savedInput?.value || "").trim();

  if (!raw) {
    clearErr(savedInput, savedErr);
    return true;
  }

  return v.numberMin(
    savedInput,
    savedErr,
    0,
    "Guardado não pode ser negativo."
  );
}

function validateAllGoals() {
  return v.validateAll(
    [ruleName, ruleTarget, ruleSavedOptional],
    addBtn
  );
}

function liveValidateGoals() {
  validateAllGoals();
}

/* =========================
   Exclusão em 2 cliques
========================= */
function markDeletePending(id) {
  pendingDeleteId = id;

  clearTimeout(pendingDeleteTimer);

  pendingDeleteTimer = setTimeout(() => {
    pendingDeleteId = null;
    render();
  }, 2500);
}

/* =========================
   Render
========================= */
function renderSummary() {
  if (!totalEl) return;

  const totalSaved = goalsTotal(month);
  const totalTarget = (month.goals || []).reduce((total, goal) => {
    return total + Number(goal.target || 0);
  }, 0);

  const totalRemaining = Math.max(totalTarget - totalSaved, 0);
  const percent = totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0;

  totalEl.innerHTML = `
    📅 ${ymToLabel(ym)} •
    Guardado no mês: <b>${formatBRL(totalSaved)}</b> •
    Objetivo total: <b>${formatBRL(totalTarget)}</b> •
    Falta: <b>${formatBRL(totalRemaining)}</b>
    <div class="helper" style="margin-top:6px;">
      Progresso geral das metas: <b>${percent.toFixed(1)}%</b>
    </div>
  `;
}

function render() {
  normalizeGoalsMonth(month);

  if (!tbody) {
    renderSummary();
    return;
  }

  const goals = month.goals || [];

  if (!goals.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty">
            <div>
              <div class="title">Nenhuma meta cadastrada neste mês</div>
              <div class="desc">Adicione uma meta para acompanhar quanto já guardou e quanto ainda falta.</div>
            </div>
          </div>
        </td>
      </tr>
    `;

    renderSummary();
    return;
  }

  tbody.innerHTML = goals
    .map((goal) => {
      const percent = goalPercent(goal);
      const remaining = remainingValue(goal);
      const isPendingDelete = pendingDeleteId === goal.id;

      return `
        <tr>
          <td>${escapeHTML(goal.name)}</td>

          <td class="right">${formatBRL(goal.target)}</td>

          <td class="right">${formatBRL(goal.saved || 0)}</td>

          <td class="right">
            <div style="min-width:120px;">
              <b>${percent.toFixed(1)}%</b>
              <div style="height:8px; background:rgba(2,6,23,.08); border-radius:999px; overflow:hidden; margin-top:6px;">
                <div style="width:${percent}%; height:100%; background:rgba(46, 204, 113, .9);"></div>
              </div>
              <div class="helper" style="margin-top:4px;">Falta ${formatBRL(remaining)}</div>
            </div>
          </td>

          <td class="right">
            <button
              class="del ${isPendingDelete ? "btn-danger" : ""}"
              data-id="${escapeHTML(goal.id)}"
            >
              ${isPendingDelete ? "Confirmar exclusão" : "Excluir"}
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  renderSummary();
}

/* =========================
   Eventos
========================= */
[nameInput, targetInput, savedInput].forEach((input) => {
  input?.addEventListener("input", liveValidateGoals);
});

nameInput?.addEventListener("blur", () => {
  v.setShowMsg(true);
  ruleName();
});

targetInput?.addEventListener("blur", () => {
  v.setShowMsg(true);
  ruleTarget();
});

savedInput?.addEventListener("blur", () => {
  v.setShowMsg(true);
  ruleSavedOptional();
});

tbody?.addEventListener("click", (event) => {
  const btn = event.target.closest("button.del");

  if (!btn) return;

  const id = btn.dataset.id;

  if (!id) return;

  if (pendingDeleteId !== id) {
    markDeletePending(id);
    render();
    return;
  }

  pendingDeleteId = null;
  clearTimeout(pendingDeleteTimer);

  month.goals = (month.goals || []).filter((goal) => goal.id !== id);

  saveState(state);
  render();
});

addBtn?.addEventListener("click", () => {
  v.setShowMsg(true);

  if (!validateAllGoals()) return;

  const name = nameInput.value.trim();
  const target = parseMoneyInput(targetInput.value);
  const saved = parseMoneyInput(savedInput.value);

  month.goals.push({
    id: uid(),
    name,
    target,
    saved: saved || 0,
  });

  saveState(state);

  resetForm();
  render();
});

/* =========================
   Troca de mês
========================= */
document.getElementById("monthSelect")?.addEventListener("change", () => {
  ym = getSelectedMonth();

  month = ensureMonth(state, ym);
  normalizeGoalsMonth(month);

  pendingDeleteId = null;
  clearTimeout(pendingDeleteTimer);

  saveState(state);

  resetForm();
  render();
});

/* =========================
   Init
========================= */
v.setShowMsg(false);
validateAllGoals();
render();