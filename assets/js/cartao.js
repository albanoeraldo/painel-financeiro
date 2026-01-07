import { initHeader, renderUserName, getSelectedMonth } from "./ui.js";
import { loadState, saveState, ensureMonth, uid, formatBRL, ymToLabel } from "./storage.js";
import { createValidator } from "./validate.js";
import { pullStateFromCloud } from "./cloudState.js";

await initHeader("cartao");
await renderUserName();

// ✅ Puxa do Supabase e grava no localStorage antes de usar state/month
const cloud = await pullStateFromCloud();
if (cloud) saveState(cloud);

// --- state + month (let pq muda) ---
let ym = getSelectedMonth();
const state = loadState();
let month = ensureMonth(state, ym);

// garante estrutura
month.card = Array.isArray(month.card) ? month.card : [];
month.cardRecurring = Array.isArray(month.cardRecurring) ? month.cardRecurring : [];
saveState(state);

// --- elements ---
const monthSelect = document.getElementById("monthSelect");

// parcelas
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

// assinaturas
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

// categorias do cartão
const cardCategoriesEl = document.getElementById("cardCategories");
const cardCategoriesHintEl = document.getElementById("cardCategoriesHint");

// --- validator (igual fixas: showMsg só depois do submit) ---
const v = createValidator({ showOn: "submit" });

function clearErr(input, errEl) {
  input?.classList.remove("invalid");
  if (errEl) errEl.textContent = "";
}

/* =========================
   CATEGORIAS (estilo Fixas)
========================= */
const CATEGORY_LIST = [
  { key: "Moradia", icon: "🏠", label: "Moradia" },
  { key: "Alimentação", icon: "🍽️", label: "Alimentação" },
  { key: "Transporte", icon: "🚗", label: "Transporte" },
  { key: "Saúde", icon: "🩺", label: "Saúde" },
  { key: "Internet/Telefone", icon: "📶", label: "Internet/Telefone" },
  { key: "Lazer", icon: "🎉", label: "Lazer" },
  { key: "Empréstimo", icon: "💳", label: "Empréstimo" },
  { key: "Outros", icon: "📌", label: "Outros" },
];

const ICON_BY_CATEGORY = CATEGORY_LIST.reduce((acc, c) => {
  acc[c.key] = c.icon;
  return acc;
}, {});

function ensureCategoryExistsInList(cat) {
  const t = (cat || "").trim();
  if (!t) return;
  const exists = CATEGORY_LIST.some((x) => x.key === t);
  if (exists) return;

  // adiciona antes do "Outros"
  CATEGORY_LIST.splice(CATEGORY_LIST.length - 1, 0, { key: t, icon: "🏷️", label: t });
  ICON_BY_CATEGORY[t] = "🏷️";
}

function fillCategorySelect(selectEl, defaultValue = "Outros") {
  if (!selectEl) return;

  // garante categorias de itens existentes (caso tenha dados antigos/custom)
  (month.card || []).forEach((it) => ensureCategoryExistsInList(it.category));
  (month.cardRecurring || []).forEach((it) => ensureCategoryExistsInList(it.category));

  const current = (selectEl.value || defaultValue || "Outros");

  selectEl.innerHTML = CATEGORY_LIST.map((c) => {
    const text = `${c.icon} ${c.label}`;
    return `<option value="${c.key}">${text}</option>`;
  }).join("");

  selectEl.value = current || defaultValue || "Outros";
}

function catLabel(cat) {
  const c = (cat || "Outros").trim() || "Outros";
  const icon = ICON_BY_CATEGORY[c] || "🏷️";
  return `${icon} ${c}`;
}

/* =========================
   PARCELAS - regras
========================= */
function ruleName() {
  return v.required(nameInput, nameErr, "Informe a compra/descrição.");
}
function ruleCategory() {
  return v.required(categorySelect, categoryErr, "Selecione a categoria.");
}
function ruleMonthValue() {
  return v.numberMin(monthValueInput, monthValueErr, 0.01, "Informe um valor maior que 0.");
}
// opcionais: só valida se preencher
function ruleTotalPartsOptional() {
  const raw = (totalPartsInput?.value || "").trim();
  if (!raw) {
    clearErr(totalPartsInput, totalPartsErr);
    return true;
  }
  return v.numberRange(totalPartsInput, totalPartsErr, 1, 999, "Qtd parcelas inválida.");
}
function ruleStartYmOptional() {
  const raw = (startYmInput?.value || "").trim();
  if (!raw) {
    clearErr(startYmInput, startYmErr);
    return true;
  }
  const ok = /^\d{4}-\d{2}$/.test(raw);
  if (!ok) {
    startYmInput.classList.add("invalid");
    if (startYmErr) startYmErr.textContent = "Informe o mês de início.";
    return false;
  }
  clearErr(startYmInput, startYmErr);
  return true;
}
function validateAllParts() {
  return v.validateAll([ruleName, ruleCategory, ruleMonthValue, ruleTotalPartsOptional, ruleStartYmOptional], addBtn);
}
function liveValidateParts() {
  validateAllParts();
}

nameInput?.addEventListener("input", liveValidateParts);
categorySelect?.addEventListener("change", liveValidateParts);
monthValueInput?.addEventListener("input", liveValidateParts);
totalPartsInput?.addEventListener("input", liveValidateParts);
startYmInput?.addEventListener("input", liveValidateParts);

/* =========================
   ASSINATURAS - regras
========================= */
function ruleRecName() {
  return v.required(recNameInput, recNameErr, "Informe a descrição da assinatura.");
}
function ruleRecCategory() {
  return v.required(recCategorySelect, recCategoryErr, "Selecione a categoria.");
}
function ruleRecValue() {
  return v.numberMin(recValueInput, recValueErr, 0.01, "Informe um valor maior que 0.");
}
function validateAllRecurring() {
  return v.validateAll([ruleRecName, ruleRecCategory, ruleRecValue], addRecurringBtn);
}
function liveValidateRecurring() {
  validateAllRecurring();
}

recNameInput?.addEventListener("input", liveValidateRecurring);
recCategorySelect?.addEventListener("change", liveValidateRecurring);
recValueInput?.addEventListener("input", liveValidateRecurring);

/* =========================
   Helpers de data
========================= */
function ymToIndex(ymStr) {
  const [y, m] = ymStr.split("-").map(Number);
  return y * 12 + (m - 1);
}
function indexToYm(idx) {
  const y = Math.floor(idx / 12);
  const m = String((idx % 12) + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function addMonths(ymStr, plus) {
  return indexToYm(ymToIndex(ymStr) + plus);
}
function calcEndYm(startYm, totalParts) {
  return addMonths(startYm, totalParts - 1);
}
function calcRemaining(ymSelected, startYm, totalParts) {
  if (!startYm || !totalParts) return "—";
  const endYm = calcEndYm(startYm, totalParts);

  const curIdx = ymToIndex(ymSelected);
  const endIdx = ymToIndex(endYm);

  if (curIdx > endIdx) return "0";
  return String((endIdx - curIdx) + 1);
}

/* =========================
   Drag & Drop helpers
========================= */
function arrayMoveById(list, draggedId, targetId) {
  const from = list.findIndex((x) => x.id === draggedId);
  const to = list.findIndex((x) => x.id === targetId);
  if (from < 0 || to < 0 || from === to) return;

  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
}

function wireDragDrop(tbodyEl, list, onChange) {
  if (!tbodyEl) return;

  let draggedId = null;

  tbodyEl.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.setAttribute("draggable", "true");

    tr.addEventListener("dragstart", (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "button" || tag === "input" || tag === "select" || tag === "a" || tag === "img") {
        e.preventDefault();
        return;
      }
      draggedId = tr.dataset.id;
      tr.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    tr.addEventListener("dragend", () => {
      tr.classList.remove("dragging");
      draggedId = null;
      tbodyEl.querySelectorAll("tr.over").forEach((x) => x.classList.remove("over"));
    });

    tr.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      tr.classList.add("over");
    });

    tr.addEventListener("dragleave", () => {
      tr.classList.remove("over");
    });

    tr.addEventListener("drop", (e) => {
      e.preventDefault();
      tr.classList.remove("over");
      const targetId = tr.dataset.id;

      if (!draggedId || !targetId || draggedId === targetId) return;

      arrayMoveById(list, draggedId, targetId);
      onChange?.();
    });
  });
}

/* =========================
   Confirmação de exclusão (2 cliques)
========================= */
let pendingDeleteCardId = null; // parcelas
let pendingDeleteRecId = null;  // assinaturas
let pendingDeleteTimer = null;

function markDeletePending(which, id) {
  if (which === "card") pendingDeleteCardId = id;
  if (which === "rec") pendingDeleteRecId = id;

  clearTimeout(pendingDeleteTimer);
  pendingDeleteTimer = setTimeout(() => {
    pendingDeleteCardId = null;
    pendingDeleteRecId = null;
    renderAll();
  }, 2500);
}

/* =========================
   Reset edição (separado)
========================= */
function resetEditPart() {
  nameInput.value = "";
  monthValueInput.value = "";
  totalPartsInput.value = "";
  startYmInput.value = "";

  delete addBtn.dataset.editingId;
  addBtn.textContent = "Adicionar";

  if (cancelEditPartBtn) cancelEditPartBtn.style.display = "none";

  v.setShowMsg(false);
  clearErr(nameInput, nameErr);
  clearErr(categorySelect, categoryErr);
  clearErr(monthValueInput, monthValueErr);
  clearErr(totalPartsInput, totalPartsErr);
  clearErr(startYmInput, startYmErr);

  validateAllParts();
}

function resetEditRec() {
  recNameInput.value = "";
  recValueInput.value = "";

  delete addRecurringBtn.dataset.editingId;
  addRecurringBtn.textContent = "Adicionar";

  if (cancelEditRecBtn) cancelEditRecBtn.style.display = "none";

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
  return (month.card || []).reduce((a, b) => a + Number(b.monthValue || 0), 0);
}
function totalAssinaturasMes() {
  return (month.cardRecurring || [])
    .filter((x) => x.active !== false)
    .reduce((a, b) => a + Number(b.value || 0), 0);
}

function totalsByCategory() {
  const map = new Map();

  (month.card || []).forEach((it) => {
    const cat = (it.category || "Outros").trim() || "Outros";
    map.set(cat, (map.get(cat) || 0) + Number(it.monthValue || 0));
  });

  (month.cardRecurring || [])
    .filter((x) => x.active !== false)
    .forEach((it) => {
      const cat = (it.category || "Outros").trim() || "Outros";
      map.set(cat, (map.get(cat) || 0) + Number(it.value || 0));
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
  const totalAll = list.reduce((a, b) => a + Number(b.total || 0), 0);
  const max = Math.max(...list.map((x) => x.total), 0);

  if (list.length === 0) {
    cardCategoriesEl.innerHTML = `<div class="helper">Sem dados de cartão neste mês.</div>`;
    if (cardCategoriesHintEl) cardCategoriesHintEl.textContent = "";
    return;
  }

  cardCategoriesEl.innerHTML = list
    .map((item) => {
      const pct = max > 0 ? Math.round((item.total / max) * 100) : 0;

      return `
        <div style="display:flex; align-items:center; gap:12px; margin:10px 0;">
          <div style="min-width:180px; font-weight:600;">${catLabel(item.category)}</div>
          <div style="flex:1;">
            <div style="height:10px; border-radius:999px; background:rgba(0,0,0,.08); overflow:hidden;">
              <div style="height:10px; width:${pct}%; border-radius:999px; background:rgba(46, 204, 113, .9);"></div>
            </div>
          </div>
          <div style="min-width:120px; text-align:right; font-weight:600;">${formatBRL(item.total)}</div>
        </div>
      `;
    })
    .join("");

  if (cardCategoriesHintEl) {
    cardCategoriesHintEl.innerHTML = `Total do cartão no mês: <b>${formatBRL(totalAll)}</b> <span class="helper">(parcelas + assinaturas ativas)</span>`;
  }
}

function renderParts() {
  const total = totalParcelasMes();

  if (totalEl) {
    const totalAll = total + totalAssinaturasMes();
    totalEl.innerHTML = `📅 ${ymToLabel(ym)} • Total cartão (mês): <b>${formatBRL(totalAll)}</b> <span class="helper">(parcelas + assinaturas)</span>`;
  }

  tbody.innerHTML = (month.card || [])
    .map((item) => {
      const start = item.startYm || "—";
      const end = item.startYm && item.totalParts ? calcEndYm(item.startYm, item.totalParts) : "—";
      const faltam = item.startYm && item.totalParts ? calcRemaining(ym, item.startYm, item.totalParts) : "—";
      const cat = (item.category || "Outros").trim() || "Outros";
      const isPending = pendingDeleteCardId === item.id;

      return `
        <tr data-id="${item.id}">
          <td>${item.name}</td>
          <td>${catLabel(cat)}</td>
          <td class="right">${formatBRL(item.monthValue)}</td>
          <td>${start === "—" ? "—" : ymToLabel(start)}</td>
          <td>${end === "—" ? "—" : ymToLabel(end)}</td>
          <td>${faltam}</td>
          <td class="right">
            <button class="icon-btn edit" data-id="${item.id}" data-tip="Editar" aria-label="Editar">
              <img src="assets/img/icons/edit.png" alt="Editar">
            </button>
            <button class="icon-btn del ${isPending ? "danger" : ""}" data-id="${item.id}" data-tip="${isPending ? "Clique novamente para excluir" : "Excluir"}" aria-label="Excluir">
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
  const list = month.cardRecurring || [];

  recTbody.innerHTML = list
    .map((item) => {
      const cat = (item.category || "Outros").trim() || "Outros";
      const isPending = pendingDeleteRecId === item.id;

      return `
        <tr data-id="${item.id}">
          <td>${item.name}</td>
          <td>${catLabel(cat)}</td>
          <td class="right">${formatBRL(item.value)}</td>
          <td>
            <input type="checkbox" class="rec-active" data-id="${item.id}" ${item.active === false ? "" : "checked"} />
          </td>
          <td class="right">
            <button class="icon-btn rec-edit" data-id="${item.id}" data-tip="Editar" aria-label="Editar">
              <img src="assets/img/icons/edit.png" alt="Editar">
            </button>
            <button class="icon-btn rec-del ${isPending ? "danger" : ""}" data-id="${item.id}" data-tip="${isPending ? "Clique novamente para excluir" : "Excluir"}" aria-label="Excluir">
              <img src="assets/img/icons/delete.png" alt="Excluir">
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  const totalRec = totalAssinaturasMes();
  if (recTotalEl) recTotalEl.innerHTML = `Assinaturas ativas no mês: <b>${formatBRL(totalRec)}</b>`;

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
   Delegação de eventos
========================= */
// Parcelas: editar/excluir
tbody?.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const id = btn.dataset.id;
  if (!id) return;

  // EDITAR
  if (btn.classList.contains("edit")) {
    const it = month.card.find((x) => x.id === id);
    if (!it) return;

    nameInput.value = it.name || "";
    if (categorySelect) categorySelect.value = (it.category || "Outros").trim() || "Outros";
    monthValueInput.value = it.monthValue ?? "";
    totalPartsInput.value = it.totalParts ?? "";
    startYmInput.value = it.startYm ?? "";

    addBtn.textContent = "Salvar edição";
    addBtn.dataset.editingId = id;

    if (cancelEditPartBtn) cancelEditPartBtn.style.display = "inline-block";

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

  // EXCLUIR (2 cliques)
  if (btn.classList.contains("del")) {
    if (pendingDeleteCardId !== id) {
      markDeletePending("card", id);
      renderAll();
      return;
    }

    pendingDeleteCardId = null;
    clearTimeout(pendingDeleteTimer);

    month.card = month.card.filter((x) => x.id !== id);
    saveState(state);

    // se deletou o que estava editando, reseta
    if (addBtn.dataset.editingId === id) resetEditPart();

    renderAll();
    return;
  }
});

// Assinaturas: editar/excluir
recTbody?.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const id = btn.dataset.id;
  if (!id) return;

  // EDITAR
  if (btn.classList.contains("rec-edit")) {
    const it = month.cardRecurring.find((x) => x.id === id);
    if (!it) return;

    recNameInput.value = it.name || "";
    if (recCategorySelect) recCategorySelect.value = (it.category || "Outros").trim() || "Outros";
    recValueInput.value = it.value ?? "";

    addRecurringBtn.textContent = "Salvar edição";
    addRecurringBtn.dataset.editingId = id;

    if (cancelEditRecBtn) cancelEditRecBtn.style.display = "inline-block";

    v.setShowMsg(false);
    clearErr(recNameInput, recNameErr);
    clearErr(recCategorySelect, recCategoryErr);
    clearErr(recValueInput, recValueErr);

    validateAllRecurring();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  // EXCLUIR (2 cliques)
  if (btn.classList.contains("rec-del")) {
    if (pendingDeleteRecId !== id) {
      markDeletePending("rec", id);
      renderAll();
      return;
    }

    pendingDeleteRecId = null;
    clearTimeout(pendingDeleteTimer);

    month.cardRecurring = month.cardRecurring.filter((x) => x.id !== id);
    saveState(state);

    if (addRecurringBtn.dataset.editingId === id) resetEditRec();

    renderAll();
    return;
  }
});

// Toggle ativa? (assinaturas)
recTbody?.addEventListener("change", (e) => {
  const chk = e.target.closest("input.rec-active");
  if (!chk) return;

  const id = chk.dataset.id;
  const it = month.cardRecurring.find((x) => x.id === id);
  if (it) {
    it.active = chk.checked;
    saveState(state);
    renderAll();
  }
});

/* =========================
   Eventos
========================= */
monthSelect?.addEventListener("change", () => {
  ym = getSelectedMonth();
  month = ensureMonth(state, ym);

  month.card = Array.isArray(month.card) ? month.card : [];
  month.cardRecurring = Array.isArray(month.cardRecurring) ? month.cardRecurring : [];

  pendingDeleteCardId = null;
  pendingDeleteRecId = null;

  fillCategorySelect(categorySelect, "Outros");
  fillCategorySelect(recCategorySelect, "Outros");

  saveState(state);

  resetEditPart();
  resetEditRec();

  renderAll();
});

// Cancelar edição (separado)
cancelEditPartBtn?.addEventListener("click", () => resetEditPart());
cancelEditRecBtn?.addEventListener("click", () => resetEditRec());

// adicionar / salvar edição (parcela)
addBtn?.addEventListener("click", () => {
  v.setShowMsg(true);
  if (!validateAllParts()) return;

  const name = nameInput.value.trim();
  const category = (categorySelect.value || "Outros").trim() || "Outros";
  const monthValue = Number(monthValueInput.value || 0);

  const totalPartsRaw = (totalPartsInput.value || "").trim();
  const totalParts = totalPartsRaw ? Number(totalPartsRaw) : null;

  const startYmRaw = (startYmInput.value || "").trim();
  const startYmVal = startYmRaw ? startYmRaw : null;

  const editingId = addBtn.dataset.editingId;

  if (editingId) {
    const it = month.card.find((x) => x.id === editingId);
    if (it) {
      it.name = name;
      it.category = category;
      it.monthValue = monthValue;
      it.totalParts = totalParts;
      it.startYm = startYmVal;
    }
  } else {
    month.card.push({
      id: uid(),
      name,
      category,
      monthValue,
      totalParts,
      startYm: startYmVal,
    });
  }

  saveState(state);
  resetEditPart();
  renderAll();
});

// adicionar / salvar edição (assinatura)
addRecurringBtn?.addEventListener("click", () => {
  v.setShowMsg(true);
  if (!validateAllRecurring()) return;

  const name = recNameInput.value.trim();
  const category = (recCategorySelect.value || "Outros").trim() || "Outros";
  const value = Number(recValueInput.value || 0);

  const editingId = addRecurringBtn.dataset.editingId;

  if (editingId) {
    const it = month.cardRecurring.find((x) => x.id === editingId);
    if (it) {
      it.name = name;
      it.category = category;
      it.value = value;
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
fillCategorySelect(categorySelect, "Outros");
fillCategorySelect(recCategorySelect, "Outros");

if (cancelEditPartBtn) cancelEditPartBtn.style.display = "none";
if (cancelEditRecBtn) cancelEditRecBtn.style.display = "none";

v.setShowMsg(false);
validateAllParts();
validateAllRecurring();
renderAll();