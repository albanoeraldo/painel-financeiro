import { initHeader, getSelectedMonth } from "./ui.js";
await initHeader("cartao");
import { loadState, saveState, ensureMonth, uid, formatBRL, ymToLabel } from "./storage.js";
import { createValidator } from "./validate.js";

import { requireAuth } from "./ui.js";
await requireAuth();

import { pullStateFromCloud } from "./cloudState.js";
import { saveState } from "./storage.js";

await requireAuth();

const cloud = await pullStateFromCloud();
if(cloud){
  // joga no localStorage usando o seu saveState
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
const monthValueInput = document.getElementById("monthValue");
const totalPartsInput = document.getElementById("totalParts");
const startYmInput = document.getElementById("startYm");
const addBtn = document.getElementById("add");

const nameErr = document.getElementById("nameError");
const monthValueErr = document.getElementById("monthValueError");
const totalPartsErr = document.getElementById("totalPartsError");
const startYmErr = document.getElementById("startYmError");

const tbody = document.querySelector("#table tbody");
const totalEl = document.getElementById("total");

// assinaturas
const recNameInput = document.getElementById("recName");
const recValueInput = document.getElementById("recValue");
const addRecurringBtn = document.getElementById("addRecurring");
const recNameErr = document.getElementById("recNameError");
const recValueErr = document.getElementById("recValueError");
const recTbody = document.querySelector("#recurringTable tbody");
const recTotalEl = document.getElementById("recurringTotal");
const copyPrevRecurringBtn = document.getElementById("copyPrevRecurring");

// --- validator (igual fixas: showMsg só depois do submit) ---
const v = createValidator({ showOn: "submit" });

function clearErr(input, errEl){
  input?.classList.remove("invalid");
  if(errEl) errEl.textContent = "";
}

/* =========================
   PARCELAS - regras
========================= */
function ruleName(){
  return v.required(nameInput, nameErr, "Informe a compra/descrição.");
}
function ruleMonthValue(){
  return v.numberMin(monthValueInput, monthValueErr, 0.01, "Informe um valor maior que 0.");
}
// opcionais: só valida se preencher
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
    [ruleName, ruleMonthValue, ruleTotalPartsOptional, ruleStartYmOptional],
    addBtn
  );
}

// depois que tentou enviar, validar enquanto digita (se showMsg estiver ativo)
function liveValidateParts(){
  validateAllParts();
}

nameInput?.addEventListener("input", liveValidateParts);
monthValueInput?.addEventListener("input", liveValidateParts);
totalPartsInput?.addEventListener("input", liveValidateParts);
startYmInput?.addEventListener("input", liveValidateParts);

/* =========================
   ASSINATURAS - regras
========================= */
function ruleRecName(){
  return v.required(recNameInput, recNameErr, "Informe a descrição da assinatura.");
}
function ruleRecValue(){
  return v.numberMin(recValueInput, recValueErr, 0.01, "Informe um valor maior que 0.");
}
function validateAllRecurring(){
  return v.validateAll([ruleRecName, ruleRecValue], addRecurringBtn);
}
function liveValidateRecurring(){
  validateAllRecurring();
}

recNameInput?.addEventListener("input", liveValidateRecurring);
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
// calcula terminaYm se tiver startYm + totalParts
function calcEndYm(startYm, totalParts){
  return addMonths(startYm, totalParts - 1);
}
// faltam meses (considerando mês selecionado ym)
function calcRemaining(ymSelected, startYm, totalParts){
  if(!startYm || !totalParts) return "—";
  const endYm = calcEndYm(startYm, totalParts);

  const curIdx = ymToIndex(ymSelected);
  const endIdx = ymToIndex(endYm);

  if(curIdx > endIdx) return "0";
  return String((endIdx - curIdx) + 1);
}

/* =========================
   Render
========================= */
function totalParcelasMes(){
  return (month.card || []).reduce((a,b)=> a + Number(b.monthValue || 0), 0);
}
function totalAssinaturasMes(){
  return (month.cardRecurring || [])
    .filter(x => x.active !== false) // default true
    .reduce((a,b)=> a + Number(b.value || 0), 0);
}

function renderParts(){
  const total = totalParcelasMes();

  if(totalEl) {
    const totalAll = total + totalAssinaturasMes();
    totalEl.innerHTML = `📅 ${ymToLabel(ym)} • Total cartão (mês): <b>${formatBRL(totalAll)}</b> <span class="helper">(parcelas + assinaturas)</span>`;
  }

  tbody.innerHTML = (month.card || []).map(item=>{
    const start = item.startYm || "—";
    const end = (item.startYm && item.totalParts) ? calcEndYm(item.startYm, item.totalParts) : "—";
    const faltam = (item.startYm && item.totalParts) ? calcRemaining(ym, item.startYm, item.totalParts) : "—";

    return `
      <tr>
        <td>${item.name}</td>
        <td class="right">${formatBRL(item.monthValue)}</td>
        <td>${start === "—" ? "—" : ymToLabel(start)}</td>
        <td>${end === "—" ? "—" : ymToLabel(end)}</td>
        <td>${faltam}</td>
        <td class="right">
          <button class="del" data-id="${item.id}">Excluir</button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".del").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.id;
      month.card = (month.card || []).filter(x => x.id !== id);
      saveState(state);
      renderAll();
    });
  });
}

function renderRecurring(){
  const list = (month.cardRecurring || []);

  recTbody.innerHTML = list.map(item => `
    <tr>
      <td>${item.name}</td>
      <td class="right">${formatBRL(item.value)}</td>
      <td>
        <input type="checkbox" class="rec-active" data-id="${item.id}" ${item.active === false ? "" : "checked"} />
      </td>
      <td class="right">
        <button class="rec-del" data-id="${item.id}">Excluir</button>
      </td>
    </tr>
  `).join("");

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

  recTbody.querySelectorAll(".rec-del").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.id;
      month.cardRecurring = month.cardRecurring.filter(x => x.id !== id);
      saveState(state);
      renderAll();
    });
  });
}

function renderAll(){
  renderParts();
  renderRecurring();
}

/* =========================
   Eventos
========================= */
monthSelect?.addEventListener("change", ()=>{
  ym = getSelectedMonth();
  month = ensureMonth(state, ym);

  month.card = Array.isArray(month.card) ? month.card : [];
  month.cardRecurring = Array.isArray(month.cardRecurring) ? month.cardRecurring : [];
  saveState(state);

  // reset visual de validação
  v.setShowMsg(false);

  clearErr(nameInput, nameErr);
  clearErr(monthValueInput, monthValueErr);
  clearErr(totalPartsInput, totalPartsErr);
  clearErr(startYmInput, startYmErr);

  clearErr(recNameInput, recNameErr);
  clearErr(recValueInput, recValueErr);

  validateAllParts();
  validateAllRecurring();
  renderAll();
});

// adicionar parcela
addBtn?.addEventListener("click", ()=>{
  v.setShowMsg(true);
  if(!validateAllParts()) return;

  const name = nameInput.value.trim();
  const monthValue = Number(monthValueInput.value || 0);

  const totalPartsRaw = (totalPartsInput.value || "").trim();
  const totalParts = totalPartsRaw ? Number(totalPartsRaw) : null;

  const startYmRaw = (startYmInput.value || "").trim();
  const startYmVal = startYmRaw ? startYmRaw : null;

  month.card.push({
    id: uid(),
    name,
    monthValue,
    totalParts,
    startYm: startYmVal,
  });

  saveState(state);

  nameInput.value = "";
  monthValueInput.value = "";
  totalPartsInput.value = "";
  startYmInput.value = "";

  v.setShowMsg(false);
  clearErr(nameInput, nameErr);
  clearErr(monthValueInput, monthValueErr);
  clearErr(totalPartsInput, totalPartsErr);
  clearErr(startYmInput, startYmErr);

  validateAllParts();
  renderAll();
});

// adicionar assinatura
addRecurringBtn?.addEventListener("click", ()=>{
  v.setShowMsg(true);
  if(!validateAllRecurring()) return;

  const name = recNameInput.value.trim();
  const value = Number(recValueInput.value || 0);

  month.cardRecurring.push({
    id: uid(),
    name,
    value,
    active: true
  });

  saveState(state);

  recNameInput.value = "";
  recValueInput.value = "";

  v.setShowMsg(false);
  clearErr(recNameInput, recNameErr);
  clearErr(recValueInput, recValueErr);

  validateAllRecurring();
  renderAll();
});

// copiar assinaturas do mês anterior
copyPrevRecurringBtn?.addEventListener("click", ()=>{
  const prev = prevYm(ym);
  const prevMonth = state.months?.[prev];

  const prevList = Array.isArray(prevMonth?.cardRecurring) ? prevMonth.cardRecurring : [];
  if(prevList.length === 0){
    alert("Não encontrei assinaturas no mês anterior.");
    return;
  }

  // copia criando novos IDs (evita conflito)
  month.cardRecurring = prevList.map(x => ({
    id: uid(),
    name: x.name,
    value: Number(x.value || 0),
    active: x.active !== false
  }));

  saveState(state);
  renderAll();
});

/* =========================
   Init
========================= */
v.setShowMsg(false);
validateAllParts();
validateAllRecurring();
renderAll();