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
} from "./finance.js";

/* =========================
   Boot
========================= */
await initHeader("cartao", { syncCloud: true });
await renderUserName();

let ym = getSelectedMonth();
const state = loadState();

const monthAlreadyExists = !!state.months?.[ym];
let month = ensureMonth(state, ym);

const beforeNormalize = JSON.stringify({
  card: month.card,
  cardRecurring: month.cardRecurring,
});

normalizeCardMonth(month);

const afterNormalize = JSON.stringify({
  card: month.card,
  cardRecurring: month.cardRecurring,
});

if (!monthAlreadyExists || beforeNormalize !== afterNormalize) {
  saveState(state);
}

/* =========================
   Elementos
========================= */
const importPrevBtn = document.getElementById("importPrevBtn");

// Parcelas
const nameInput = document.getElementById("name");
const categorySelect = document.getElementById("category");
const monthValueInput = document.getElementById("monthValue");
const totalPartsInput = document.getElementById("totalParts");
const startYmInput = document.getElementById("startYm");
const addBtn = document.getElementById("add");
const cancelEditPartBtn = document.getElementById("cancelEditPart");

const nameErr = document.getElementById("nameError");
const categoryErr = document.getElementById("categoryError");
const monthValueErr = document.getElementById("monthValueError");
const totalPartsErr = document.getElementById("totalPartsError");
const startYmErr = document.getElementById("startYmError");

const tbody = document.querySelector("#table tbody");
const totalEl = document.getElementById("total");

// Assinaturas
const recNameInput = document.getElementById("recName");
const recCategorySelect = document.getElementById("recCategory");
const recValueInput = document.getElementById("recValue");
const addRecurringBtn = document.getElementById("addRecurring");
const cancelEditRecBtn = document.getElementById("cancelEditRec");

const recNameErr = document.getElementById("recNameError");
const recCategoryErr = document.getElementById("recCategoryError");
const recValueErr = document.getElementById("recValueError");

const recTbody = document.querySelector("#recurringTable tbody");
const recTotalEl = document.getElementById("recurringTotal");

// Categorias
const cardCategoriesEl = document.getElementById("cardCategories");
const cardCategoriesHintEl = document.getElementById("cardCategoriesHint");

const v = createValidator({ showOn: "submit" });

/* =========================
   Normalização
========================= */
function isValidYm(value) {
  return /^\d{4}-\d{2}$/.test(String(value || ""));
}

function normalizeOptionalNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }

  return number;
}

function normalizeCardMonth(m) {
  m.card = Array.isArray(m.card) ? m.card : [];
  m.cardRecurring = Array.isArray(m.cardRecurring) ? m.cardRecurring : [];

  m.card = m.card.map((item) => ({
    id: item.id || uid(),
    name: String(item.name || "").trim(),
    category: normalizeCategoryKey(item.category || "outros"),
    monthValue: Number(item.monthValue ?? item.value ?? 0) || 0,
    totalParts: normalizeOptionalNumber(item.totalParts),
    startYm: isValidYm(item.startYm) ? item.startYm : null,
  }));

  m.cardRecurring = m.cardRecurring.map((item) => ({
    id: item.id || uid(),
    name: String(item.name || "").trim(),
    category: normalizeCategoryKey(item.category || "outros"),
    value: Number(item.value || 0) || 0,
    active: item.active !== false,
  }));

  return m;
}

/* =========================
   Helpers gerais
========================= */
function clearErr(input, errEl) {
  input?.classList.remove("invalid");
  if (errEl) errEl.textContent = "";
}

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
  return addMonths(startYm, Number(totalParts) - 1);
}

function calcRemaining(selectedYm, startYm, totalParts) {
  if (!isValidYm(startYm) || !totalParts) return "—";

  const endYm = calcEndYm(startYm, totalParts);
  const selectedIndex = ymToIndex(selectedYm);
  const endIndex = ymToIndex(endYm);

  if (selectedIndex > endIndex) return "0";

  return String(endIndex - selectedIndex + 1);
}

/* =========================
   Categorias
========================= */
function fillCategorySelect(selectEl, defaultValue = "outros") {
  if (!selectEl) return;

  const current = normalizeCategoryKey(selectEl.value || defaultValue);

  selectEl.innerHTML = CATEGORIES.map((category) => {
    return `<option value="${category.key}">${category.label}</option>`;
  }).join("");

  selectEl.value = current || defaultValue;
}

/* =========================
   Validações - Parcelas
========================= */
function ruleName() {
  return v.required(nameInput, nameErr, "Informe a compra/descrição.");
}

function ruleCategory() {
  return v.required(categorySelect, categoryErr, "Selecione a categoria.");
}

function ruleMonthValue() {
  return v.numberMin(
    monthValueInput,
    monthValueErr,
    0.01,
    "Informe um valor maior que 0."
  );
}

function ruleTotalPartsOptional() {
  const raw = (totalPartsInput?.value || "").trim();

  if (!raw) {
    clearErr(totalPartsInput, totalPartsErr);
    return true;
  }

  return v.numberRange(
    totalPartsInput,
    totalPartsErr,
    1,
    999,
    "Qtd parcelas inválida."
  );
}

function ruleStartYmOptional() {
  const raw = (startYmInput?.value || "").trim();

  if (!raw) {
    clearErr(startYmInput, startYmErr);
    return true;
  }

  const ok = isValidYm(raw);

  if (!ok) {
    startYmInput.classList.add("invalid");
    if (startYmErr) startYmErr.textContent = "Informe o mês de início.";
    return false;
  }

  clearErr(startYmInput, startYmErr);
  return true;
}

function validateAllParts() {
  return v.validateAll(
    [ruleName, ruleCategory, ruleMonthValue, ruleTotalPartsOptional, ruleStartYmOptional],
    addBtn
  );
}

function liveValidateParts() {
  validateAllParts();
}

/* =========================
   Validações - Assinaturas
========================= */
function ruleRecName() {
  return v.required(recNameInput, recNameErr, "Informe a descrição da assinatura.");
}

function ruleRecCategory() {
  return v.required(recCategorySelect, recCategoryErr, "Selecione a categoria.");
}

function ruleRecValue() {
  return v.numberMin(
    recValueInput,
    recValueErr,
    0.01,
    "Informe um valor maior que 0."
  );
}

function validateAllRecurring() {
  return v.validateAll(
    [ruleRecName, ruleRecCategory, ruleRecValue],
    addRecurringBtn
  );
}

function liveValidateRecurring() {
  validateAllRecurring();
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
let pendingDeleteCardId = null;
let pendingDeleteRecId = null;
let pendingDeleteTimer = null;

function markDeletePending(type, id) {
  if (type === "card") pendingDeleteCardId = id;
  if (type === "rec") pendingDeleteRecId = id;

  clearTimeout(pendingDeleteTimer);

  pendingDeleteTimer = setTimeout(() => {
    pendingDeleteCardId = null;
    pendingDeleteRecId = null;
    renderAll();
  }, 2500);
}

/* =========================
   Reset de edição
========================= */
function resetEditPart() {
  if (nameInput) nameInput.value = "";
  if (monthValueInput) monthValueInput.value = "";
  if (totalPartsInput) totalPartsInput.value = "";
  if (startYmInput) startYmInput.value = "";

  if (categorySelect) categorySelect.value = "outros";

  delete addBtn.dataset.editingId;
  addBtn.textContent = "Adicionar";

  if (cancelEditPartBtn) {
    cancelEditPartBtn.style.display = "none";
  }

  v.setShowMsg(false);

  clearErr(nameInput, nameErr);
  clearErr(categorySelect, categoryErr);
  clearErr(monthValueInput, monthValueErr);
  clearErr(totalPartsInput, totalPartsErr);
  clearErr(startYmInput, startYmErr);

  validateAllParts();
}

function resetEditRec() {
  if (recNameInput) recNameInput.value = "";
  if (recValueInput) recValueInput.value = "";

  if (recCategorySelect) recCategorySelect.value = "outros";

  delete addRecurringBtn.dataset.editingId;
  addRecurringBtn.textContent = "Adicionar";

  if (cancelEditRecBtn) {
    cancelEditRecBtn.style.display = "none";
  }

  v.setShowMsg(false);

  clearErr(recNameInput, recNameErr);
  clearErr(recCategorySelect, recCategoryErr);
  clearErr(recValueInput, recValueErr);

  validateAllRecurring();
}

/* =========================
   Totais
========================= */
function totalParcelasMes() {
  return (month.card || []).reduce((total, item) => {
    return total + Number(item.monthValue || 0);
  }, 0);
}

function totalAssinaturasMes() {
  return (month.cardRecurring || [])
    .filter((item) => item.active !== false)
    .reduce((total, item) => {
      return total + Number(item.value || 0);
    }, 0);
}

function totalCartaoMes() {
  return totalParcelasMes() + totalAssinaturasMes();
}

function totalsByCategory() {
  const map = new Map();

  (month.card || []).forEach((item) => {
    const category = normalizeCategoryKey(item.category || "outros");
    const value = Number(item.monthValue || 0);

    if (!value) return;

    map.set(category, (map.get(category) || 0) + value);
  });

  (month.cardRecurring || [])
    .filter((item) => item.active !== false)
    .forEach((item) => {
      const category = normalizeCategoryKey(item.category || "outros");
      const value = Number(item.value || 0);

      if (!value) return;

      map.set(category, (map.get(category) || 0) + value);
    });

  return Array.from(map.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

/* =========================
   Render
========================= */
function renderCardCategories() {
  if (!cardCategoriesEl) return;

  const list = totalsByCategory();
  const totalAll = list.reduce((total, item) => total + Number(item.total || 0), 0);
  const max = Math.max(...list.map((item) => item.total), 0);

  if (!list.length) {
    cardCategoriesEl.innerHTML = `
      <div class="empty">
        <div>
          <div class="title">Sem dados de cartão neste mês</div>
          <div class="desc">Adicione uma parcela ou assinatura para visualizar as categorias.</div>
        </div>
      </div>
    `;

    if (cardCategoriesHintEl) {
      cardCategoriesHintEl.textContent = "";
    }

    return;
  }

  cardCategoriesEl.innerHTML = list
    .map((item) => {
      const percent = max > 0 ? Math.round((item.total / max) * 100) : 0;

      return `
        <div style="display:flex; align-items:center; gap:12px; margin:10px 0;">
          <div style="min-width:180px; font-weight:600;">${catLabel(item.category)}</div>

          <div style="flex:1;">
            <div style="height:10px; border-radius:999px; background:rgba(0,0,0,.08); overflow:hidden;">
              <div style="height:10px; width:${percent}%; border-radius:999px; background:rgba(46, 204, 113, .9);"></div>
            </div>
          </div>

          <div style="min-width:120px; text-align:right; font-weight:600;">
            ${formatBRL(item.total)}
          </div>
        </div>
      `;
    })
    .join("");

  if (cardCategoriesHintEl) {
    cardCategoriesHintEl.innerHTML = `
      Total do cartão no mês: <b>${formatBRL(totalAll)}</b>
      <span class="helper">(parcelas + assinaturas ativas)</span>
    `;
  }
}

function renderParts() {
  if (!tbody) return;

  const list = month.card || [];

  if (totalEl) {
    totalEl.innerHTML = `
      📅 ${ymToLabel(ym)} • Total cartão no mês:
      <b>${formatBRL(totalCartaoMes())}</b>
      <span class="helper">(parcelas + assinaturas)</span>
    `;
  }

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty">
            <div>
              <div class="title">Nenhuma parcela cadastrada</div>
              <div class="desc">Adicione compras parceladas para acompanhar o cartão deste mês.</div>
            </div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list
    .map((item) => {
      const start = item.startYm || "—";
      const end = item.startYm && item.totalParts ? calcEndYm(item.startYm, item.totalParts) : "—";
      const remaining =
        item.startYm && item.totalParts ? calcRemaining(ym, item.startYm, item.totalParts) : "—";

      const isPending = pendingDeleteCardId === item.id;

      return `
        <tr data-id="${escapeHTML(item.id)}">
          <td>${escapeHTML(item.name)}</td>
          <td>${catLabel(item.category)}</td>
          <td class="right">${formatBRL(item.monthValue)}</td>
          <td>${start === "—" ? "—" : ymToLabel(start)}</td>
          <td>${end === "—" ? "—" : ymToLabel(end)}</td>
          <td>${remaining}</td>
          <td class="right">
            <button class="icon-btn edit" data-id="${escapeHTML(item.id)}" data-tip="Editar" aria-label="Editar">
              <img src="assets/img/icons/edit.png" alt="Editar">
            </button>

            <button class="icon-btn del ${isPending ? "danger" : ""}" data-id="${escapeHTML(item.id)}" data-tip="${isPending ? "Clique novamente para excluir" : "Excluir"}" aria-label="Excluir">
              <img src="assets/img/icons/delete.png" alt="Excluir">
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  wireDragDrop(tbody, month.card, () => {
    saveState(state);
    renderAll();
  });
}

function renderRecurring() {
  if (!recTbody) return;

  const list = month.cardRecurring || [];

  if (!list.length) {
    recTbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty">
            <div>
              <div class="title">Nenhuma assinatura cadastrada</div>
              <div class="desc">Adicione serviços mensais, como streaming, apps ou ferramentas.</div>
            </div>
          </div>
        </td>
      </tr>
    `;

    if (recTotalEl) {
      recTotalEl.innerHTML = `Assinaturas ativas no mês: <b>${formatBRL(0)}</b>`;
    }

    return;
  }

  recTbody.innerHTML = list
    .map((item) => {
      const isPending = pendingDeleteRecId === item.id;

      return `
        <tr data-id="${escapeHTML(item.id)}">
          <td>${escapeHTML(item.name)}</td>
          <td>${catLabel(item.category)}</td>
          <td class="right">${formatBRL(item.value)}</td>
          <td>
            <input type="checkbox" class="rec-active" data-id="${escapeHTML(item.id)}" ${item.active === false ? "" : "checked"} />
          </td>
          <td class="right">
            <button class="icon-btn rec-edit" data-id="${escapeHTML(item.id)}" data-tip="Editar" aria-label="Editar">
              <img src="assets/img/icons/edit.png" alt="Editar">
            </button>

            <button class="icon-btn rec-del ${isPending ? "danger" : ""}" data-id="${escapeHTML(item.id)}" data-tip="${isPending ? "Clique novamente para excluir" : "Excluir"}" aria-label="Excluir">
              <img src="assets/img/icons/delete.png" alt="Excluir">
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  if (recTotalEl) {
    recTotalEl.innerHTML = `
      Assinaturas ativas no mês:
      <b>${formatBRL(totalAssinaturasMes())}</b>
    `;
  }

  wireDragDrop(recTbody, month.cardRecurring, () => {
    saveState(state);
    renderAll();
  });
}

function renderAll() {
  renderParts();
  renderRecurring();
  renderCardCategories();
}

/* =========================
   Eventos - validação ao digitar
========================= */
nameInput?.addEventListener("input", liveValidateParts);
categorySelect?.addEventListener("change", liveValidateParts);
monthValueInput?.addEventListener("input", liveValidateParts);
totalPartsInput?.addEventListener("input", liveValidateParts);
startYmInput?.addEventListener("input", liveValidateParts);

recNameInput?.addEventListener("input", liveValidateRecurring);
recCategorySelect?.addEventListener("change", liveValidateRecurring);
recValueInput?.addEventListener("input", liveValidateRecurring);

/* =========================
   Eventos - Parcelas
========================= */
tbody?.addEventListener("click", (event) => {
  const btn = event.target.closest("button");

  if (!btn) return;

  const id = btn.dataset.id;

  if (!id) return;

  if (btn.classList.contains("edit")) {
    const item = month.card.find((cardItem) => cardItem.id === id);

    if (!item) return;

    nameInput.value = item.name || "";
    categorySelect.value = normalizeCategoryKey(item.category || "outros");
    monthValueInput.value = item.monthValue ?? "";
    totalPartsInput.value = item.totalParts ?? "";
    startYmInput.value = item.startYm ?? "";

    addBtn.textContent = "Salvar edição";
    addBtn.dataset.editingId = id;

    if (cancelEditPartBtn) {
      cancelEditPartBtn.style.display = "inline-block";
    }

    v.setShowMsg(false);

    clearErr(nameInput, nameErr);
    clearErr(categorySelect, categoryErr);
    clearErr(monthValueInput, monthValueErr);
    clearErr(totalPartsInput, totalPartsErr);
    clearErr(startYmInput, startYmErr);

    validateAllParts();

    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (btn.classList.contains("del")) {
    if (pendingDeleteCardId !== id) {
      markDeletePending("card", id);
      renderAll();
      return;
    }

    pendingDeleteCardId = null;
    clearTimeout(pendingDeleteTimer);

    month.card = month.card.filter((item) => item.id !== id);

    saveState(state);

    if (addBtn.dataset.editingId === id) {
      resetEditPart();
    }

    renderAll();
  }
});

/* =========================
   Eventos - Assinaturas
========================= */
recTbody?.addEventListener("click", (event) => {
  const btn = event.target.closest("button");

  if (!btn) return;

  const id = btn.dataset.id;

  if (!id) return;

  if (btn.classList.contains("rec-edit")) {
    const item = month.cardRecurring.find((recItem) => recItem.id === id);

    if (!item) return;

    recNameInput.value = item.name || "";
    recCategorySelect.value = normalizeCategoryKey(item.category || "outros");
    recValueInput.value = item.value ?? "";

    addRecurringBtn.textContent = "Salvar edição";
    addRecurringBtn.dataset.editingId = id;

    if (cancelEditRecBtn) {
      cancelEditRecBtn.style.display = "inline-block";
    }

    v.setShowMsg(false);

    clearErr(recNameInput, recNameErr);
    clearErr(recCategorySelect, recCategoryErr);
    clearErr(recValueInput, recValueErr);

    validateAllRecurring();

    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (btn.classList.contains("rec-del")) {
    if (pendingDeleteRecId !== id) {
      markDeletePending("rec", id);
      renderAll();
      return;
    }

    pendingDeleteRecId = null;
    clearTimeout(pendingDeleteTimer);

    month.cardRecurring = month.cardRecurring.filter((item) => item.id !== id);

    saveState(state);

    if (addRecurringBtn.dataset.editingId === id) {
      resetEditRec();
    }

    renderAll();
  }
});

recTbody?.addEventListener("change", (event) => {
  const checkbox = event.target.closest("input.rec-active");

  if (!checkbox) return;

  const id = checkbox.dataset.id;
  const item = month.cardRecurring.find((recItem) => recItem.id === id);

  if (!item) return;

  item.active = checkbox.checked;

  saveState(state);
  renderAll();
});

/* =========================
   Eventos - ações principais
========================= */
cancelEditPartBtn?.addEventListener("click", () => {
  resetEditPart();
});

cancelEditRecBtn?.addEventListener("click", () => {
  resetEditRec();
});

importPrevBtn?.addEventListener("click", () => {
  const prevYm = getPrevYm(ym);
  const prevMonth = state.months?.[prevYm];

  if (!prevMonth) {
    alert(`Não encontrei cartão em ${ymToLabel(prevYm)}.`);
    return;
  }

  normalizeCardMonth(prevMonth);

  const hasPreviousData =
    Array.isArray(prevMonth.card) &&
    Array.isArray(prevMonth.cardRecurring) &&
    (prevMonth.card.length > 0 || prevMonth.cardRecurring.length > 0);

  if (!hasPreviousData) {
    alert(`Não encontrei cartão em ${ymToLabel(prevYm)}.`);
    return;
  }

  let added = 0;

  const existingParts = new Set(
    (month.card || []).map((item) => String(item.name || "").trim().toLowerCase())
  );

  prevMonth.card.forEach((item) => {
    const key = String(item.name || "").trim().toLowerCase();

    if (!key || existingParts.has(key)) return;

    month.card.push({
      id: uid(),
      name: item.name,
      category: normalizeCategoryKey(item.category || "outros"),
      monthValue: Number(item.monthValue || 0),
      totalParts: item.totalParts ?? null,
      startYm: item.startYm ?? null,
    });

    existingParts.add(key);
    added++;
  });

  const existingRecurring = new Set(
    (month.cardRecurring || []).map((item) => String(item.name || "").trim().toLowerCase())
  );

  prevMonth.cardRecurring.forEach((item) => {
    const key = String(item.name || "").trim().toLowerCase();

    if (!key || existingRecurring.has(key)) return;

    month.cardRecurring.push({
      id: uid(),
      name: item.name,
      category: normalizeCategoryKey(item.category || "outros"),
      value: Number(item.value || 0),
      active: item.active !== false,
    });

    existingRecurring.add(key);
    added++;
  });

  saveState(state);

  resetEditPart();
  resetEditRec();
  renderAll();

  alert(`✅ Copiado de ${ymToLabel(prevYm)}: ${added} item(ns).`);
});

addBtn?.addEventListener("click", () => {
  v.setShowMsg(true);

  if (!validateAllParts()) return;

  const name = nameInput.value.trim();
  const category = normalizeCategoryKey(categorySelect.value || "outros");
  const monthValue = parseMoneyInput(monthValueInput.value);

  const totalPartsRaw = (totalPartsInput.value || "").trim();
  const totalParts = totalPartsRaw ? Number(totalPartsRaw) : null;

  const startYmRaw = (startYmInput.value || "").trim();
  const startYm = startYmRaw ? startYmRaw : null;

  const editingId = addBtn.dataset.editingId;

  if (editingId) {
    const item = month.card.find((cardItem) => cardItem.id === editingId);

    if (item) {
      item.name = name;
      item.category = category;
      item.monthValue = monthValue;
      item.totalParts = totalParts;
      item.startYm = startYm;
    }
  } else {
    month.card.push({
      id: uid(),
      name,
      category,
      monthValue,
      totalParts,
      startYm,
    });
  }

  saveState(state);

  resetEditPart();
  renderAll();
});

addRecurringBtn?.addEventListener("click", () => {
  v.setShowMsg(true);

  if (!validateAllRecurring()) return;

  const name = recNameInput.value.trim();
  const category = normalizeCategoryKey(recCategorySelect.value || "outros");
  const value = parseMoneyInput(recValueInput.value);

  const editingId = addRecurringBtn.dataset.editingId;

  if (editingId) {
    const item = month.cardRecurring.find((recItem) => recItem.id === editingId);

    if (item) {
      item.name = name;
      item.category = category;
      item.value = value;
    }
  } else {
    month.cardRecurring.push({
      id: uid(),
      name,
      category,
      value,
      active: true,
    });
  }

  saveState(state);

  resetEditRec();
  renderAll();
});

/* =========================
   Init
========================= */
fillCategorySelect(categorySelect, "outros");
fillCategorySelect(recCategorySelect, "outros");

if (cancelEditPartBtn) {
  cancelEditPartBtn.style.display = "none";
}

if (cancelEditRecBtn) {
  cancelEditRecBtn.style.display = "none";
}

v.setShowMsg(false);

validateAllParts();
validateAllRecurring();
renderAll();