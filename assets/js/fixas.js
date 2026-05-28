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

import {
  CATEGORIES,
  catLabel,
  normalizeCategoryKey,
  fixedTotals,
} from "./finance.js";

/* =========================
   Boot
========================= */
await initHeader("fixas", { syncCloud: true });
await renderUserName();

let ym = getSelectedMonth();
const state = loadState();

const monthAlreadyExists = !!state.months?.[ym];
let month = ensureMonth(state, ym);

const beforeNormalize = JSON.stringify(month.fixed);
normalizeFixedMonth(month);
const afterNormalize = JSON.stringify(month.fixed);

if (!monthAlreadyExists || beforeNormalize !== afterNormalize) {
  saveState(state);
}

/* =========================
   Elementos
========================= */
const descInput = document.getElementById("descFixa");
const valorInput = document.getElementById("valorFixa");
const dueDayInput = document.getElementById("dueDay");

const categorySelect = document.getElementById("categorySelect");
const loanPartsInput = document.getElementById("loanParts");
const loanStartYmInput = document.getElementById("loanStartYm");

const descErr = document.getElementById("descFixaError");
const valorErr = document.getElementById("valorFixaError");
const dueErr = document.getElementById("dueDayError");
const categoryErr = document.getElementById("categoryError");
const loanPartsErr = document.getElementById("loanPartsError");
const loanStartYmErr = document.getElementById("loanStartYmError");

const addBtn = document.getElementById("addFixedBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const importPrevBtn = document.getElementById("importPrevBtn");
const importPrevHint = document.getElementById("importPrevHint");

const tbody = document.querySelector("#table tbody");
const summary = document.getElementById("summary");
const summaryCats = document.getElementById("summaryCats");
const emptyBox = document.getElementById("fixedEmpty");
const tableEl = document.getElementById("table");

const v = createValidator({ showOn: "submit" });

let editingId = null;
let pendingDeleteId = null;
let pendingDeleteTimer = null;

/* =========================
   Normalização
========================= */
function isValidYm(value) {
  return /^\d{4}-\d{2}$/.test(String(value || ""));
}

function normalizeOptionalPositiveInteger(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }

  return Math.floor(number);
}

function normalizeDueDay(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 1 || number > 31) {
    return 1;
  }

  return Math.floor(number);
}

function normalizeFixedMonth(m) {
  m.fixed = Array.isArray(m.fixed) ? m.fixed : [];

  m.fixed = m.fixed.map((item) => ({
    id: item.id || uid(),
    name: String(item.name || "").trim(),
    value: Number(item.value || 0) || 0,
    dueDay: normalizeDueDay(item.dueDay),
    paid: !!item.paid,
    category: normalizeCategoryKey(item.category || "outros"),
    loanParts: normalizeOptionalPositiveInteger(item.loanParts),
    loanStartYm: isValidYm(item.loanStartYm) ? item.loanStartYm : null,
  }));

  return m;
}

/* =========================
   Helpers de mês
========================= */
function ymToIndex(ymStr) {
  const [year, monthNumber] = String(ymStr).split("-").map(Number);
  return year * 12 + (monthNumber - 1);
}

function indexToYm(index) {
  const year = Math.floor(index / 12);
  const monthNumber = String((index % 12) + 1).padStart(2, "0");

  return `${year}-${monthNumber}`;
}

function addMonths(ymStr, amount) {
  return indexToYm(ymToIndex(ymStr) + amount);
}

function getPrevYm(currentYm) {
  return addMonths(currentYm, -1);
}

function calcEndYm(startYm, totalParts) {
  if (!isValidYm(startYm) || !totalParts) return "";

  return addMonths(startYm, Number(totalParts) - 1);
}

function calcRemaining(selectedYm, startYm, totalParts) {
  if (!isValidYm(startYm) || !totalParts) return "";

  const endYm = calcEndYm(startYm, totalParts);
  const selectedIndex = ymToIndex(selectedYm);
  const endIndex = ymToIndex(endYm);

  if (selectedIndex > endIndex) return "0";

  return String(endIndex - selectedIndex + 1);
}

/* =========================
   Categorias
========================= */
function fillCategorySelect(defaultValue = "outros") {
  if (!categorySelect) return;

  const current = normalizeCategoryKey(categorySelect.value || defaultValue);

  categorySelect.innerHTML = CATEGORIES.map((category) => {
    return `<option value="${category.key}">${category.label}</option>`;
  }).join("");

  categorySelect.value = current || defaultValue;
}

/* =========================
   Validações
========================= */
function clearErr(input, errEl) {
  input?.classList.remove("invalid");
  if (errEl) errEl.textContent = "";
}

function clearAllErrors() {
  clearErr(descInput, descErr);
  clearErr(valorInput, valorErr);
  clearErr(dueDayInput, dueErr);
  clearErr(categorySelect, categoryErr);
  clearErr(loanPartsInput, loanPartsErr);
  clearErr(loanStartYmInput, loanStartYmErr);
}

function ruleDescription() {
  return v.required(descInput, descErr, "Informe a descrição.");
}

function ruleValue() {
  return v.numberMin(valorInput, valorErr, 0.01, "Informe um valor maior que 0.");
}

function ruleDueDay() {
  return v.numberRange(dueDayInput, dueErr, 1, 31, "Vencimento inválido. Use de 1 a 31.");
}

function ruleCategory() {
  return v.required(categorySelect, categoryErr, "Selecione uma categoria.");
}

function ruleLoanPartsOptional() {
  const raw = (loanPartsInput?.value || "").trim();

  if (!raw) {
    clearErr(loanPartsInput, loanPartsErr);
    return true;
  }

  return v.numberRange(
    loanPartsInput,
    loanPartsErr,
    1,
    999,
    "Quantidade de parcelas inválida."
  );
}

function ruleLoanStartYmOptional() {
  const raw = (loanStartYmInput?.value || "").trim();

  if (!raw) {
    clearErr(loanStartYmInput, loanStartYmErr);
    return true;
  }

  const ok = isValidYm(raw);

  if (!ok) {
    loanStartYmInput?.classList.add("invalid");
    if (loanStartYmErr) loanStartYmErr.textContent = "Informe o mês de início.";
    return false;
  }

  clearErr(loanStartYmInput, loanStartYmErr);
  return true;
}

function validateAllFixed() {
  return v.validateAll(
    [
      ruleDescription,
      ruleValue,
      ruleDueDay,
      ruleCategory,
      ruleLoanPartsOptional,
      ruleLoanStartYmOptional,
    ],
    addBtn
  );
}

function liveValidateFixed() {
  validateAllFixed();
}

/* =========================
   Reset formulário
========================= */
function resetForm() {
  if (descInput) descInput.value = "";
  if (valorInput) valorInput.value = "";
  if (dueDayInput) dueDayInput.value = "";
  if (categorySelect) categorySelect.value = "outros";
  if (loanPartsInput) loanPartsInput.value = "";
  if (loanStartYmInput) loanStartYmInput.value = "";

  editingId = null;

  if (addBtn) {
    addBtn.textContent = "Adicionar";
    delete addBtn.dataset.editingId;
  }

  if (cancelEditBtn) {
    cancelEditBtn.style.display = "none";
  }

  v.setShowMsg(false);
  clearAllErrors();
  validateAllFixed();
}

/* =========================
   Drag & Drop
========================= */
function arrayMoveById(list, draggedId, targetId) {
  const from = list.findIndex((item) => item.id === draggedId);
  const to = list.findIndex((item) => item.id === targetId);

  if (from < 0 || to < 0 || from === to) return;

  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
}

function wireDragDrop(tbodyEl, list, onChange) {
  if (!tbodyEl) return;

  let draggedId = null;

  tbodyEl.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.setAttribute("draggable", "true");

    tr.addEventListener("dragstart", (event) => {
      const tag = (event.target?.tagName || "").toLowerCase();

      if (["button", "input", "select", "a", "img"].includes(tag)) {
        event.preventDefault();
        return;
      }

      draggedId = tr.dataset.id;
      tr.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
    });

    tr.addEventListener("dragend", () => {
      tr.classList.remove("dragging");
      draggedId = null;

      tbodyEl.querySelectorAll("tr.over").forEach((row) => {
        row.classList.remove("over");
      });
    });

    tr.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      tr.classList.add("over");
    });

    tr.addEventListener("dragleave", () => {
      tr.classList.remove("over");
    });

    tr.addEventListener("drop", (event) => {
      event.preventDefault();

      tr.classList.remove("over");

      const targetId = tr.dataset.id;

      if (!draggedId || !targetId || draggedId === targetId) return;

      arrayMoveById(list, draggedId, targetId);
      onChange?.();
    });
  });
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
   Resumos
========================= */
function totalsByCategory() {
  const map = new Map();

  (month.fixed || []).forEach((item) => {
    const category = normalizeCategoryKey(item.category || "outros");
    const value = Number(item.value || 0);

    if (!value) return;

    if (!map.has(category)) {
      map.set(category, {
        category,
        total: 0,
        paid: 0,
        pending: 0,
      });
    }

    const entry = map.get(category);

    entry.total += value;

    if (item.paid) {
      entry.paid += value;
    } else {
      entry.pending += value;
    }
  });

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function renderSummary() {
  if (!summary && !summaryCats) return;

  const totals = fixedTotals(month);

  if (summary) {
    summary.innerHTML = `
      📅 ${ymToLabel(ym)} •
      Total fixas: <b>${formatBRL(totals.fixedTotal)}</b> •
      Pagas: <b>${formatBRL(totals.fixedPaid)}</b> •
      Pendentes: <b>${formatBRL(totals.fixedPending)}</b>
    `;
  }

  if (!summaryCats) return;

  const categoryTotals = totalsByCategory();

  if (!categoryTotals.length) {
    summaryCats.innerHTML = "Sem contas fixas cadastradas neste mês.";
    return;
  }

  summaryCats.innerHTML = categoryTotals
    .map((item) => {
      const pendingText =
        item.pending > 0
          ? ` <span style="opacity:.75;">• pendente ${formatBRL(item.pending)}</span>`
          : "";

      return `• ${catLabel(item.category)}: <b>${formatBRL(item.total)}</b>${pendingText}`;
    })
    .join("<br>");
}

/* =========================
   Render principal
========================= */
function render() {
  normalizeFixedMonth(month);

  const list = month.fixed || [];
  const hasItems = list.length > 0;

  if (emptyBox) {
    emptyBox.style.display = hasItems ? "none" : "flex";
  }

  if (tableEl) {
    tableEl.style.display = hasItems ? "table" : "none";
  }

  if (!tbody) {
    renderSummary();
    return;
  }

  if (!hasItems) {
    tbody.innerHTML = "";
    renderSummary();
    return;
  }

  tbody.innerHTML = list
    .map((item) => {
      const end =
        item.loanStartYm && item.loanParts
          ? calcEndYm(item.loanStartYm, item.loanParts)
          : "";

      const remaining =
        item.loanStartYm && item.loanParts
          ? calcRemaining(ym, item.loanStartYm, item.loanParts)
          : "";

      const isPendingDelete = pendingDeleteId === item.id;

      return `
        <tr data-id="${escapeHTML(item.id)}">
          <td>${escapeHTML(item.name)}</td>
          <td>${catLabel(item.category)}</td>
          <td>Dia ${escapeHTML(item.dueDay)}</td>
          <td class="right">${formatBRL(item.value)}</td>
          <td>${end ? ymToLabel(end) : "—"}</td>
          <td>${remaining ? remaining : "—"}</td>
          <td style="text-align:center;">
            <input
              type="checkbox"
              ${item.paid ? "checked" : ""}
              data-id="${escapeHTML(item.id)}"
              class="paid"
              aria-label="Marcar como pago"
            />
          </td>
          <td class="right">
            <button class="icon-btn edit" data-tip="Editar" data-id="${escapeHTML(item.id)}" aria-label="Editar">
              <img src="assets/img/icons/edit.png" alt="Editar">
            </button>

            <button
              class="icon-btn del ${isPendingDelete ? "danger" : ""}"
              data-tip="${isPendingDelete ? "Clique novamente para excluir" : "Excluir"}"
              data-id="${escapeHTML(item.id)}"
              aria-label="Excluir"
            >
              <img src="assets/img/icons/delete.png" alt="Excluir">
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll(".paid").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const item = month.fixed.find((fixedItem) => fixedItem.id === checkbox.dataset.id);

      if (!item) return;

      item.paid = checkbox.checked;

      saveState(state);
      render();
    });
  });

  wireDragDrop(tbody, month.fixed, () => {
    saveState(state);
    render();
  });

  renderSummary();
}

/* =========================
   Importar mês anterior
========================= */
function updateImportHint() {
  if (!importPrevHint) return;

  const prevYm = getPrevYm(ym);
  const prevMonth = state.months?.[prevYm];

  const count = Array.isArray(prevMonth?.fixed) ? prevMonth.fixed.length : 0;

  importPrevHint.textContent = count
    ? `Vai importar ${count} item(ns) de ${ymToLabel(prevYm)} sem duplicar.`
    : `Sem fixas em ${ymToLabel(prevYm)} para importar.`;
}

importPrevBtn?.addEventListener("click", () => {
  const prevYm = getPrevYm(ym);
  const prevMonth = state.months?.[prevYm];

  if (!prevMonth || !Array.isArray(prevMonth.fixed) || !prevMonth.fixed.length) {
    updateImportHint();
    return;
  }

  normalizeFixedMonth(prevMonth);

  const existing = new Set(
    (month.fixed || []).map((item) => String(item.name || "").trim().toLowerCase())
  );

  let added = 0;

  prevMonth.fixed.forEach((item) => {
    const nameKey = String(item.name || "").trim().toLowerCase();

    if (!nameKey || existing.has(nameKey)) return;

    month.fixed.push({
      id: uid(),
      name: item.name,
      value: Number(item.value || 0),
      dueDay: normalizeDueDay(item.dueDay),
      paid: false,
      category: normalizeCategoryKey(item.category || "outros"),
      loanParts: normalizeOptionalPositiveInteger(item.loanParts),
      loanStartYm: isValidYm(item.loanStartYm) ? item.loanStartYm : null,
    });

    existing.add(nameKey);
    added++;
  });

  saveState(state);

  resetForm();
  updateImportHint();
  render();

  if (importPrevHint) {
    importPrevHint.textContent = `✅ Importado: ${added} item(ns) de ${ymToLabel(prevYm)}.`;
  }
});

/* =========================
   Eventos da tabela
========================= */
tbody?.addEventListener("click", (event) => {
  const btn = event.target.closest("button");

  if (!btn) return;

  const id = btn.dataset.id;

  if (!id) return;

  if (btn.classList.contains("edit")) {
    const item = month.fixed.find((fixedItem) => fixedItem.id === id);

    if (!item) return;

    editingId = id;

    if (descInput) descInput.value = item.name || "";
    if (valorInput) valorInput.value = item.value ?? "";
    if (dueDayInput) dueDayInput.value = item.dueDay ?? "";
    if (categorySelect) categorySelect.value = normalizeCategoryKey(item.category || "outros");
    if (loanPartsInput) loanPartsInput.value = item.loanParts ?? "";
    if (loanStartYmInput) loanStartYmInput.value = item.loanStartYm ?? "";

    if (addBtn) {
      addBtn.textContent = "Salvar edição";
      addBtn.dataset.editingId = id;
    }

    if (cancelEditBtn) {
      cancelEditBtn.style.display = "inline-block";
    }

    v.setShowMsg(false);
    clearAllErrors();
    validateAllFixed();

    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (btn.classList.contains("del")) {
    if (pendingDeleteId !== id) {
      markDeletePending(id);
      render();
      return;
    }

    pendingDeleteId = null;
    clearTimeout(pendingDeleteTimer);

    if (editingId === id) {
      resetForm();
    }

    month.fixed = month.fixed.filter((item) => item.id !== id);

    saveState(state);
    render();
    validateAllFixed();
  }
});

/* =========================
   Eventos do formulário
========================= */
descInput?.addEventListener("input", liveValidateFixed);
valorInput?.addEventListener("input", liveValidateFixed);
dueDayInput?.addEventListener("input", liveValidateFixed);
categorySelect?.addEventListener("change", liveValidateFixed);
loanPartsInput?.addEventListener("input", liveValidateFixed);
loanStartYmInput?.addEventListener("change", liveValidateFixed);

descInput?.addEventListener("blur", () => {
  v.setShowMsg(true);
  ruleDescription();
});

valorInput?.addEventListener("blur", () => {
  v.setShowMsg(true);
  ruleValue();
});

dueDayInput?.addEventListener("blur", () => {
  v.setShowMsg(true);
  ruleDueDay();
});

categorySelect?.addEventListener("blur", () => {
  v.setShowMsg(true);
  ruleCategory();
});

loanPartsInput?.addEventListener("blur", () => {
  v.setShowMsg(true);
  ruleLoanPartsOptional();
});

loanStartYmInput?.addEventListener("blur", () => {
  v.setShowMsg(true);
  ruleLoanStartYmOptional();
});

addBtn?.addEventListener("click", () => {
  v.setShowMsg(true);

  if (!validateAllFixed()) return;

  const name = descInput.value.trim();
  const value = parseMoneyInput(valorInput.value);
  const dueDay = normalizeDueDay(dueDayInput.value);
  const category = normalizeCategoryKey(categorySelect.value || "outros");

  const loanPartsRaw = (loanPartsInput?.value || "").trim();
  const loanParts = loanPartsRaw ? normalizeOptionalPositiveInteger(loanPartsRaw) : null;

  const loanStartYmRaw = (loanStartYmInput?.value || "").trim();
  const loanStartYm = loanStartYmRaw ? loanStartYmRaw : null;

  if (editingId) {
    const item = month.fixed.find((fixedItem) => fixedItem.id === editingId);

    if (item) {
      item.name = name;
      item.value = value;
      item.dueDay = dueDay;
      item.category = category;
      item.loanParts = loanParts;
      item.loanStartYm = loanStartYm;
    }
  } else {
    month.fixed.push({
      id: uid(),
      name,
      value,
      dueDay,
      paid: false,
      category,
      loanParts,
      loanStartYm,
    });
  }

  saveState(state);

  resetForm();
  updateImportHint();
  render();
});

cancelEditBtn?.addEventListener("click", () => {
  resetForm();
});

/* =========================
   Init
========================= */
fillCategorySelect("outros");

if (cancelEditBtn) {
  cancelEditBtn.style.display = "none";
}

v.setShowMsg(false);

resetForm();
updateImportHint();
render();