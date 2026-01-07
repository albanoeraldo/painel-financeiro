import { initHeader, getSelectedMonth } from "./ui.js";
import { loadState, saveState, ensureMonth, uid, formatBRL, ymToLabel } from "./storage.js";
import { createValidator } from "./validate.js";
import { pullStateFromCloud } from "./cloudState.js";

await initHeader("cartao");

const cloud = await pullStateFromCloud();
if(cloud){
  saveState(cloud);
}

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

// copiar cartão inteiro
const copyPrevCardBtn = document.getElementById("copyPrevCard");

// categorias do cartão
const cardCategoriesEl = document.getElementById("cardCategories");
const cardCategoriesHintEl = document.getElementById("cardCategoriesHint");

// --- validator ---
const v = createValidator({ showOn: "submit" });

function clearErr(input, errEl){
  input?.classList.remove("invalid");
  if(errEl) errEl.textContent = "";
}

/* =========================
   CATEGORIAS (estilo Fixas)
========================= */
const CATEGORY_LIST = [
  { key: "Moradia",          icon: "🏠", label: "Moradia" },
  { key: "Alimentação",      icon: "🍽️", label: "Alimentação" },
  { key: "Transporte",       icon: "🚗", label: "Transporte" },
  { key: "Saúde",            icon: "🩺", label: "Saúde" },
  { key: "Internet/Telefone",icon: "📶", label: "Internet/Telefone" },
  { key: "Lazer",            icon: "🎉", label: "Lazer" },
  { key: "Empréstimo",       icon: "💳", label: "Empréstimo" },
  { key: "Outros",           icon: "📌", label: "Outros" },
];

const ICON_BY_CATEGORY = CATEGORY_LIST.reduce((acc, c) => {
  acc[c.key] = c.icon;
  return acc;
}, {});

function ensureCategoryExistsInList(cat){
  const t = (cat || "").trim();
  if(!t) return;
  const exists = CATEGORY_LIST.some(x => x.key === t);
  if(exists) return;
  CATEGORY_LIST.splice(CATEGORY_LIST.length - 1, 0, { key: t, icon: "🏷️", label: t });
  ICON_BY_CATEGORY[t] = "🏷️";
}

function fillCategorySelect(selectEl, defaultValue = "Outros"){
  if(!selectEl) return;

  (month.card || []).forEach(it => ensureCategoryExistsInList(it.category));
  (month.cardRecurring || []).forEach(it => ensureCategoryExistsInList(it.category));

  const current = (selectEl.value || defaultValue || "Outros");

  selectEl.innerHTML = CATEGORY_LIST.map(c => {
    const text = `${c.icon} ${c.label}`;
    return `<option value="${c.key}">${text}</option>`;
  }).join("");

  selectEl.value = current || defaultValue || "Outros";
}

function catLabel(cat){
  const c = (cat || "Outros").trim() || "Outros";
  const icon = ICON_BY_CATEGORY[c] || "🏷️";
  return `${icon} ${c}`;
}

/* =========================
   Reordenar helper
========================= */
function moveItem(list, id, dir){
  const i = list.findIndex(x => x.id === id);
  if(i < 0) return;

  const j = i + dir;
  if(j < 0 || j >= list.length) return;

  const tmp = list[i];
  list[i] = list[j];
  list[j] = tmp;
}

/* =========================
   Edit mode
========================= */
let editingPartId = null;
let editingRecId = null;

function resetPartForm(){
  editingPartId = null;
  if(addBtn) addBtn.textContent = "Adicionar";
  if(cancelEditPartBtn) cancelEditPartBtn.style.display = "none";

  if(nameInput) nameInput.value = "";
  if(monthValueInput) monthValueInput.value = "";
  if(totalPartsInput) totalPartsInput.value = "";
  if(startYmInput) startYmInput.value = "";

  v.setShowMsg(false);
  clearErr(nameInput, nameErr);
  clearErr(categorySelect, categoryErr);
  clearErr(monthValueInput, monthValueErr);
  clearErr(totalPartsInput, totalPartsErr);
  clearErr(startYmInput, startYmErr);

  validateAllParts();
}

function resetRecForm(){
  editingRecId = null;
  if(addRecurringBtn) addRecurringBtn.textContent = "Adicionar";
  if(cancelEditRecBtn) cancelEditRecBtn.style.display = "none";

  if(recNameInput) recNameInput.value = "";
  if(recValueInput) recValueInput.value = "";

  v.setShowMsg(false);
  clearErr(recNameInput, recNameErr);
  clearErr(recCategorySelect, recCategoryErr);
  clearErr(recValueInput, recValueErr);

  validateAllRecurring();
}

/* =========================
   PARCELAS - regras
========================= */
function ruleName(){
  return v.required(nameInput, nameErr, "Informe a compra/descrição.");
}
function ruleCategory(){
  return v.required(categorySelect, categoryErr, "Selecione a categoria.");
}
function ruleMonthValue(){
  return v.numberMin(monthValueInput, monthValueErr, 0.01, "Informe um valor maior que 0.");
}
function ruleTotalPartsOptional(){
  const raw = (totalPartsInput?.value || "").trim();
  if(!raw){ clearErr(totalPartsInput, totalPartsErr); return true; }
  return v.numberRange(totalPartsInput, totalPartsErr, 1, 999, "Qtd parcelas inválida.");
}
function ruleStartYmOptional(){
  const raw = (startYmInput?.value || "").trim();
  if(!raw){ clearErr(startYmInput, startYmErr); return true; }
  const ok = /^\d{4}-\d{2}$/.test(raw);
  if(!ok){
    startYmInput.classList.add("invalid");
    if(startYmErr) startYmErr.textContent = "Informe o mês de início.";
    return false;
  }
  clearErr(startYmInput, startYmErr);
  return true;
}
function validateAllParts(){
  return v.validateAll(
    [ruleName, ruleCategory, ruleMonthValue, ruleTotalPartsOptional, ruleStartYmOptional],
    addBtn
  );
}
function liveValidateParts(){ validateAllParts(); }

nameInput?.addEventListener("input", liveValidateParts);
categorySelect?.addEventListener("change", liveValidateParts);
monthValueInput?.addEventListener("input", liveValidateParts);
totalPartsInput?.addEventListener("input", liveValidateParts);
startYmInput?.addEventListener("input", liveValidateParts);

/* =========================
   ASSINATURAS - regras
========================= */
function ruleRecName(){
  return v.required(recNameInput, recNameErr, "Informe a descrição da assinatura.");
}
function ruleRecCategory(){
  return v.required(recCategorySelect, recCategoryErr, "Selecione a categoria.");
}
function ruleRecValue(){
  return v.numberMin(recValueInput, recValueErr, 0.01, "Informe um valor maior que 0.");
}
function validateAllRecurring(){
  return v.validateAll([ruleRecName, ruleRecCategory, ruleRecValue], addRecurringBtn);
}
function liveValidateRecurring(){ validateAllRecurring(); }

recNameInput?.addEventListener("input", liveValidateRecurring);
recCategorySelect?.addEventListener("change", liveValidateRecurring);
recValueInput?.addEventListener("input", liveValidateRecurring);

/* =========================
   Helpers de data
========================= */
function ymToIndex(ymStr){
  const [y, m] = ymStr.split("-").map(Number);
  return y * 12 + (m - 1);
}
function indexToYm(idx){
  const y = Math.floor(idx / 12);
  const m = String((idx % 12) + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function addMonths(ymStr, plus){
  return indexToYm(ymToIndex(ymStr) + plus);
}
function prevYm(ymStr){
  return addMonths(ymStr, -1);
}
function calcEndYm(startYm, totalParts){
  return addMonths(startYm, totalParts - 1);
}
function calcRemaining(ymSelected, startYm, totalParts){
  if(!startYm || !totalParts) return "—";
  const endYm = calcEndYm(startYm, totalParts);

  const curIdx = ymToIndex(ymSelected);
  const endIdx = ymToIndex(endYm);

  if(curIdx > endIdx) return "0";
  return String((endIdx - curIdx) + 1);
}

/* =========================
   Copiar cartão (parcelas + assinaturas)
========================= */
function copyCardFromMonth(sourceYm, targetMonth){
  const sourceMonth = state.months?.[sourceYm];

  const srcParts = Array.isArray(sourceMonth?.card) ? sourceMonth.card : [];
  const srcRec   = Array.isArray(sourceMonth?.cardRecurring) ? sourceMonth.cardRecurring : [];

  if(srcParts.length === 0 && srcRec.length === 0){
    alert("Não encontrei cartão (parcelas/assinaturas) no mês anterior.");
    return false;
  }

  srcParts.forEach(x => ensureCategoryExistsInList(x.category));
  srcRec.forEach(x => ensureCategoryExistsInList(x.category));

  targetMonth.card = srcParts.map(x => ({
    id: uid(),
    name: x.name,
    category: (x.category || "Outros").trim() || "Outros",
    monthValue: Number(x.monthValue || 0),
    totalParts: x.totalParts ? Number(x.totalParts) : null,
    startYm: x.startYm || null
  }));

  targetMonth.cardRecurring = srcRec.map(x => ({
    id: uid(),
    name: x.name,
    category: (x.category || "Outros").trim() || "Outros",
    value: Number(x.value || 0),
    active: x.active !== false
  }));

  return true;
}

/* =========================
   Totais
========================= */
function totalParcelasMes(){
  return (month.card || []).reduce((a,b)=> a + Number(b.monthValue || 0), 0);
}
function totalAssinaturasMes(){
  return (month.cardRecurring || [])
    .filter(x => x.active !== false)
    .reduce((a,b)=> a + Number(b.value || 0), 0);
}
function totalsByCategory(){
  const map = new Map();

  (month.card || []).forEach(it => {
    const cat = (it.category || "Outros").trim() || "Outros";
    map.set(cat, (map.get(cat) || 0) + Number(it.monthValue || 0));
  });

  (month.cardRecurring || [])
    .filter(x => x.active !== false)
    .forEach(it => {
      const cat = (it.category || "Outros").trim() || "Outros";
      map.set(cat, (map.get(cat) || 0) + Number(it.value || 0));
    });

  return Array.from(map.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a,b) => b.total - a.total);
}

function arrayMoveById(list, draggedId, targetId){
  const from = list.findIndex(x => x.id === draggedId);
  const to   = list.findIndex(x => x.id === targetId);
  if(from < 0 || to < 0 || from === to) return;

  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
}

function wireDragDrop(tbodyEl, list, onChange){
  if(!tbodyEl) return;

  let draggedId = null;

  tbodyEl.querySelectorAll("tr[data-id]").forEach(tr => {
    tr.setAttribute("draggable", "true");

    tr.addEventListener("dragstart", (e) => {
      draggedId = tr.dataset.id;
      tr.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    tr.addEventListener("dragend", () => {
      tr.classList.remove("dragging");
      draggedId = null;
      tbodyEl.querySelectorAll("tr.over").forEach(x => x.classList.remove("over"));
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

      if(!draggedId || !targetId || draggedId === targetId) return;

      arrayMoveById(list, draggedId, targetId);
      onChange?.();
    });
  });
}

/* =========================
   Render
========================= */
function renderCardCategories(){
  if(!cardCategoriesEl) return;

  const list = totalsByCategory();
  const totalAll = list.reduce((a,b)=> a + Number(b.total || 0), 0);
  const max = Math.max(...list.map(x => x.total), 0);

  if(list.length === 0){
    cardCategoriesEl.innerHTML = `<div class="helper">Sem dados de cartão neste mês.</div>`;
    if(cardCategoriesHintEl) cardCategoriesHintEl.textContent = "";
    return;
  }

  cardCategoriesEl.innerHTML = list.map(item => {
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
  }).join("");

  if(cardCategoriesHintEl){
    cardCategoriesHintEl.innerHTML = `Total do cartão no mês: <b>${formatBRL(totalAll)}</b> <span class="helper">(parcelas + assinaturas ativas)</span>`;
  }
}

function renderParts(){
  const total = totalParcelasMes();

  if(totalEl) {
    const totalAll = total + totalAssinaturasMes();
    totalEl.innerHTML = `📅 ${ymToLabel(ym)} • Total cartão (mês): <b>${formatBRL(totalAll)}</b> <span class="helper">(parcelas + assinaturas)</span>`;
  }

  const list = (month.card || []);

  tbody.innerHTML = (month.card || []).map((item) => {
    const start = item.startYm || "—";
    const end = (item.startYm && item.totalParts) ? calcEndYm(item.startYm, item.totalParts) : "—";
    const faltam = (item.startYm && item.totalParts) ? calcRemaining(ym, item.startYm, item.totalParts) : "—";
    const cat = (item.category || "Outros").trim() || "Outros";

  return `
    <tr data-id="${item.id}">
      <td>${item.name}</td>
      <td>${catLabel(cat)}</td>
      <td class="right">${formatBRL(item.monthValue)}</td>
      <td>${start === "—" ? "—" : ymToLabel(start)}</td>
      <td>${end === "—" ? "—" : ymToLabel(end)}</td>
      <td>${faltam}</td>
      <td class="right">
        <button class="icon-btn edit" data-tip="Editar" data-id="${item.id}" aria-label="Editar">
          <img src="assets/img/icons/edit.png" alt="Editar">
        </button>
        <button class="icon-btn del ${pendingDeleteId === item.id ? "danger" : ""}"
                data-tip="${pendingDeleteId === item.id ? "Clique novamente para excluir" : "Excluir"}"
                data-id="${item.id}" aria-label="Excluir">
          <img src="assets/img/icons/delete.png" alt="Excluir">
        </button>
      </td>
    </tr>
  `;
}).join("");

  tbody.querySelectorAll(".edit").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.id;
      const it = month.card.find(x => x.id === id);
      if(!it) return;

      editingPartId = id;

      nameInput.value = it.name || "";
      categorySelect.value = it.category || "Outros";
      monthValueInput.value = it.monthValue ?? "";
      totalPartsInput.value = it.totalParts ?? "";
      startYmInput.value = it.startYm ?? "";

      if(addBtn) addBtn.textContent = "Salvar edição";
      if(cancelEditPartBtn) cancelEditPartBtn.style.display = "inline-block";

      clearErr(nameInput, nameErr);
      clearErr(categorySelect, categoryErr);
      clearErr(monthValueInput, monthValueErr);
      clearErr(totalPartsInput, totalPartsErr);
      clearErr(startYmInput, startYmErr);

      validateAllParts();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  tbody.querySelectorAll(".del").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.id;
      if(editingPartId === id) resetPartForm();

      month.card = (month.card || []).filter(x => x.id !== id);
      saveState(state);
      renderAll();
    });
  });

  wireDragDrop(tbody, month.card, () => {
    saveState(state);
    renderAll();
  });
}

function renderRecurring(){
  const list = (month.cardRecurring || []);

  recTbody.innerHTML = list.map((item, idx) => {
    const cat = (item.category || "Outros").trim() || "Outros";

    return `
      <tr data-id="${item.id}">
        <td>${item.name}</td>
        <td>${catLabel(cat)}</td>
        <td class="right">${formatBRL(item.value)}</td>
        <td>
          <input type="checkbox" class="rec-active" data-id="${item.id}" ${item.active === false ? "" : "checked"} />
        </td>
        <td class="right">
          <button class="icon-btn edit" data-tip="Editar" data-id="${item.id}" aria-label="Editar">
            <img src="assets/img/icons/edit.png" alt="Editar">
          </button>
          <button class="icon-btn del ${pendingDeleteId === item.id ? "danger" : ""}"
                data-tip="${pendingDeleteId === item.id ? "Clique novamente para excluir" : "Excluir"}"
                data-id="${item.id}" aria-label="Excluir">
          <img src="assets/img/icons/delete.png" alt="Excluir">
        </button>
        </td>
      </tr>
    `;
  }).join("");

  const totalRec = totalAssinaturasMes();
  if(recTotalEl) recTotalEl.innerHTML = `Assinaturas ativas no mês: <b>${formatBRL(totalRec)}</b>`;

  recTbody.querySelectorAll(".rec-active").forEach(chk=>{
    chk.addEventListener("change", ()=>{
      const id = chk.dataset.id;
      const it = month.cardRecurring.find(x => x.id === id);
      if(it){
        it.active = chk.checked;
        saveState(state);
        renderAll();
      }
    });
  });

  recTbody.querySelectorAll(".rec-edit").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.id;
      const it = month.cardRecurring.find(x => x.id === id);
      if(!it) return;

      editingRecId = id;

      recNameInput.value = it.name || "";
      recCategorySelect.value = it.category || "Outros";
      recValueInput.value = it.value ?? "";

      if(addRecurringBtn) addRecurringBtn.textContent = "Salvar edição";
      if(cancelEditRecBtn) cancelEditRecBtn.style.display = "inline-block";

      clearErr(recNameInput, recNameErr);
      clearErr(recCategorySelect, recCategoryErr);
      clearErr(recValueInput, recValueErr);

      validateAllRecurring();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  recTbody.querySelectorAll(".rec-del").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.id;
      if(editingRecId === id) resetRecForm();

      month.cardRecurring = month.cardRecurring.filter(x => x.id !== id);
      saveState(state);
      renderAll();
    });
  });

  wireDragDrop(recTbody, month.cardRecurring, () => {
    saveState(state);
    renderAll();
  });
}

function renderAll(){
  renderParts();
  renderRecurring();
  renderCardCategories();
}

/* =========================
   Eventos
========================= */
monthSelect?.addEventListener("change", ()=>{
  ym = getSelectedMonth();
  month = ensureMonth(state, ym);

  month.card = Array.isArray(month.card) ? month.card : [];
  month.cardRecurring = Array.isArray(month.cardRecurring) ? month.cardRecurring : [];

  fillCategorySelect(categorySelect, "Outros");
  fillCategorySelect(recCategorySelect, "Outros");

  saveState(state);

  resetPartForm();
  resetRecForm();
  renderAll();
});

// adicionar parcela / salvar edição
addBtn?.addEventListener("click", ()=>{
  v.setShowMsg(true);
  if(!validateAllParts()) return;

  const name = nameInput.value.trim();
  const category = (categorySelect.value || "Outros").trim() || "Outros";
  const monthValue = Number(monthValueInput.value || 0);

  const totalPartsRaw = (totalPartsInput.value || "").trim();
  const totalParts = totalPartsRaw ? Number(totalPartsRaw) : null;

  const startYmRaw = (startYmInput.value || "").trim();
  const startYmVal = startYmRaw ? startYmRaw : null;

  if(editingPartId){
    const it = month.card.find(x => x.id === editingPartId);
    if(it){
      it.name = name;
      it.category = category;
      it.monthValue = monthValue;
      it.totalParts = totalParts;
      it.startYm = startYmVal;
    }
    saveState(state);
    resetPartForm();
    renderAll();
    return;
  }

  month.card.push({
    id: uid(),
    name,
    category,
    monthValue,
    totalParts,
    startYm: startYmVal,
  });

  saveState(state);
  resetPartForm();
  renderAll();
});

// cancelar edição parcela
cancelEditPartBtn?.addEventListener("click", ()=>{
  resetPartForm();
});

// adicionar assinatura / salvar edição
addRecurringBtn?.addEventListener("click", ()=>{
  v.setShowMsg(true);
  if(!validateAllRecurring()) return;

  const name = recNameInput.value.trim();
  const category = (recCategorySelect.value || "Outros").trim() || "Outros";
  const value = Number(recValueInput.value || 0);

  if(editingRecId){
    const it = month.cardRecurring.find(x => x.id === editingRecId);
    if(it){
      it.name = name;
      it.category = category;
      it.value = value;
      // active mantém
    }
    saveState(state);
    resetRecForm();
    renderAll();
    return;
  }

  month.cardRecurring.push({
    id: uid(),
    name,
    category,
    value,
    active: true
  });

  saveState(state);
  resetRecForm();
  renderAll();
});

// cancelar edição assinatura
cancelEditRecBtn?.addEventListener("click", ()=>{
  resetRecForm();
});

// copiar cartão do mês anterior
copyPrevCardBtn?.addEventListener("click", ()=>{
  const prev = prevYm(ym);
  const ok = copyCardFromMonth(prev, month);
  if(!ok) return;

  saveState(state);

  fillCategorySelect(categorySelect, "Outros");
  fillCategorySelect(recCategorySelect, "Outros");

  resetPartForm();
  resetRecForm();

  renderAll();
});

/* =========================
   Init
========================= */
fillCategorySelect(categorySelect, "Outros");
fillCategorySelect(recCategorySelect, "Outros");

resetPartForm();
resetRecForm();
renderAll();