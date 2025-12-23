import { initHeader, getSelectedMonth } from "./ui.js";
import { loadState, saveState, ensureMonth, uid, formatBRL, ymToLabel } from "./storage.js";
import { createValidator } from "./validate.js";

initHeader("cartao");

// --- state + month (let pq muda) ---
let ym = getSelectedMonth();
const state = loadState();
let month = ensureMonth(state, ym);

// garante estrutura
month.card = Array.isArray(month.card) ? month.card : [];
saveState(state);

// --- elements ---
const monthSelect = document.getElementById("monthSelect");

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

// --- validator (igual fixas: showMsg só depois do submit) ---
const v = createValidator({ showOn: "submit" });

function clearErr(input, errEl){
  input?.classList.remove("invalid");
  if(errEl) errEl.textContent = "";
}

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
  // valida formato YYYY-MM (input month já faz isso, mas ok)
  const ok = /^\d{4}-\d{2}$/.test(raw);
  if(!ok){
    startYmInput.classList.add("invalid");
    if(startYmErr) startYmErr.textContent = "Informe o mês de início.";
    return false;
  }
  clearErr(startYmInput, startYmErr);
  return true;
}

function validateAll(){
  const ok = v.validateAll(
    [ruleName, ruleMonthValue, ruleTotalPartsOptional, ruleStartYmOptional],
    addBtn
  );
  return ok;
}

// depois que tentou enviar, validar enquanto digita
function afterSubmitLiveValidate(){
  // se já tentou (showMsg=true), vai mostrando mensagens
  validateAll();
}

nameInput?.addEventListener("input", afterSubmitLiveValidate);
monthValueInput?.addEventListener("input", afterSubmitLiveValidate);
totalPartsInput?.addEventListener("input", afterSubmitLiveValidate);
startYmInput?.addEventListener("input", afterSubmitLiveValidate);

// --- helpers de data ---
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

// calcula terminaYm se tiver startYm + totalParts
function calcEndYm(startYm, totalParts){
  // ex: start=2026-01, total=8 => termina em 2026-08
  return addMonths(startYm, totalParts - 1);
}

// faltam meses (considerando mês selecionado ym)
function calcRemaining(ymSelected, startYm, totalParts){
  // se não tem start/total, não calcula
  if(!startYm || !totalParts) return "";
  const endYm = calcEndYm(startYm, totalParts);

  const curIdx = ymToIndex(ymSelected);
  const endIdx = ymToIndex(endYm);

  // se já passou do fim
  if(curIdx > endIdx) return "0";

  // quantos meses incluindo o mês selecionado até o fim
  return String((endIdx - curIdx) + 1);
}

// --- render ---
function render(){
  // total do mês (somente o que entra no mês selecionado)
  const total = (month.card || []).reduce((a,b)=> a + Number(b.monthValue || 0), 0);
  if(totalEl) totalEl.innerHTML = `📅 ${ymToLabel(ym)} • Total cartão (mês): <b>${formatBRL(total)}</b>`;

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
      render();
    });
  });
}

// --- month change ---
monthSelect?.addEventListener("change", ()=>{
  ym = getSelectedMonth();
  month = ensureMonth(state, ym);
  month.card = Array.isArray(month.card) ? month.card : [];
  saveState(state);

  // resetar mensagens visuais ao trocar mês
  v.setShowMsg(false);
  clearErr(nameInput, nameErr);
  clearErr(monthValueInput, monthValueErr);
  clearErr(totalPartsInput, totalPartsErr);
  clearErr(startYmInput, startYmErr);

  validateAll();
  render();
});

// --- add ---
addBtn?.addEventListener("click", ()=>{
  v.setShowMsg(true); // agora começa a mostrar mensagens
  if(!validateAll()) return;

  const name = nameInput.value.trim();
  const monthValue = Number(monthValueInput.value || 0);

  const totalPartsRaw = (totalPartsInput.value || "").trim();
  const totalParts = totalPartsRaw ? Number(totalPartsRaw) : null;

  const startYmRaw = (startYmInput.value || "").trim();
  const startYm = startYmRaw ? startYmRaw : null;

  month.card.push({
    id: uid(),
    name,
    monthValue,
    totalParts,
    startYm,
  });

  saveState(state);

  // limpa
  nameInput.value = "";
  monthValueInput.value = "";
  totalPartsInput.value = "";
  startYmInput.value = "";

  // volta a "não mostrar" até o próximo submit (igual fixas)
  v.setShowMsg(false);
  clearErr(nameInput, nameErr);
  clearErr(monthValueInput, monthValueErr);
  clearErr(totalPartsInput, totalPartsErr);
  clearErr(startYmInput, startYmErr);

  validateAll();
  render();
});

// init (começa SEM mostrar erros)
v.setShowMsg(false);
validateAll(); // só desabilita botão, sem vermelho
render();