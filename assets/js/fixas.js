import { initHeader, getSelectedMonth, requireAuth } from "./ui.js";
import { loadState, saveState, ensureMonth, uid, formatBRL, ymToLabel } from "./storage.js";
import { pullStateFromCloud } from "./cloudState.js";

await requireAuth();          // ✅ primeiro autentica
await initHeader("fixas");    // ✅ depois monta header/calendário

// ------------------ helpers mês anterior (sem depender de export do storage) ------------------
function ymToIndex(ymStr){
  const [y, m] = String(ymStr).split("-").map(Number);
  return y * 12 + (m - 1);
}
function indexToYm(idx){
  const y = Math.floor(idx / 12);
  const m = String((idx % 12) + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function addMonthsLocal(ymStr, plus){
  return indexToYm(ymToIndex(ymStr) + plus);
}
function getPrevYm(curYm){
  return addMonthsLocal(curYm, -1);
}

// ------------------ puxa cloud SEM apagar local ------------------
const localBefore = loadState();
const cloud = await pullStateFromCloud();

// ✅ só aplica o cloud se ele tiver meses de verdade
if (cloud && cloud.months && Object.keys(cloud.months).length > 0) {
  saveState(cloud);
} else {
  // mantém o que já estava salvo localmente
  saveState(localBefore);
}

// Estado e mês
let ym = getSelectedMonth();
const state = loadState();
let month = ensureMonth(state, ym);
month.fixed = Array.isArray(month.fixed) ? month.fixed : [];
saveState(state);

// ------------------ Categorias ------------------
const CATEGORIES = [
  { key: "moradia", label: "🏠 Moradia" },
  { key: "alimentacao", label: "🍽️ Alimentação" },
  { key: "transporte", label: "🚗 Transporte" },
  { key: "saude", label: "💊 Saúde" },
  { key: "internet", label: "📶 Internet" },
  { key: "lazer", label: "🎉 Lazer" },
  { key: "emprestimo", label: "💳 Empréstimo" },
  { key: "outros", label: "📌 Outros" },
];

function catLabel(key){
  const c = CATEGORIES.find(x => x.key === key);
  return c ? c.label : "📌 Outros";
}

// ------------------ Elements ------------------
const monthSelect = document.getElementById("monthSelect");

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

const addBtn = document.getElementById("addFixedBtn");
const importPrevBtn = document.getElementById("importPrevBtn");
const importPrevHint = document.getElementById("importPrevHint");

const tbody = document.querySelector("#table tbody");
const summary = document.getElementById("summary");
const summaryCats = document.getElementById("summaryCats");
const emptyBox = document.getElementById("fixedEmpty");
const tableEl = document.getElementById("table");

// monta o select de categoria (se quiser manter as opções do HTML, pode remover esse bloco)
if (categorySelect){
  categorySelect.innerHTML = CATEGORIES.map(c => `<option value="${c.key}">${c.label}</option>`).join("");
  categorySelect.value = "outros";
}

// ------------------ validações simples ------------------
function num(v){ return Number(v || 0); }

function setErr(input, el, msg, show){
  if(!input || !el) return;
  el.textContent = show ? msg : "";
  input.classList.toggle("invalid", show && !!msg);
}

function clearAllErrors(){
  [descErr, valorErr, dueErr, categoryErr].forEach(el => el && (el.textContent = ""));
  [descInput, valorInput, dueDayInput, categorySelect].forEach(inp => inp?.classList.remove("invalid"));
}

function validateAll(show){
  const desc = (descInput?.value || "").trim();
  const val  = num(valorInput?.value);
  const due  = num(dueDayInput?.value);
  const cat  = (categorySelect?.value || "").trim();

  const dueMsg =
    !due ? "Informe o dia do vencimento."
    : (due < 1 || due > 31) ? "Vencimento inválido (1 a 31)."
    : "";

  setErr(descInput, descErr, !desc ? "Informe a descrição." : "", show);
  setErr(valorInput, valorErr, (!val || val <= 0) ? "Informe um valor maior que 0." : "", show);
  setErr(dueDayInput, dueErr, dueMsg, show);
  setErr(categorySelect, categoryErr, !cat ? "Selecione uma categoria." : "", show);

  const ok = !!desc && val > 0 && due > 0 && due <= 31 && !!cat;
  if(addBtn) addBtn.disabled = !ok;
  return ok;
}

// ✅ (AQUI É O QUE FALTAVA NO SEU ARQUIVO)
// revalida enquanto digita/seleciona para liberar o botão
function wireValidation(){
  const recheck = () => validateAll(false);

  descInput?.addEventListener("input", recheck);
  valorInput?.addEventListener("input", recheck);
  dueDayInput?.addEventListener("input", recheck);

  categorySelect?.addEventListener("change", recheck);
  loanPartsInput?.addEventListener("input", recheck);
  loanStartYmInput?.addEventListener("change", recheck);

  // se quiser: ao sair do campo, mostra erro se estiver errado
  descInput?.addEventListener("blur", () => validateAll(true));
  valorInput?.addEventListener("blur", () => validateAll(true));
  dueDayInput?.addEventListener("blur", () => validateAll(true));
  categorySelect?.addEventListener("blur", () => validateAll(true));
}

// ------------------ empréstimo helpers ------------------
function calcEndYm(startYm, totalParts){
  if(!startYm || !totalParts) return "";
  return addMonthsLocal(startYm, totalParts - 1);
}
function calcRemaining(ymSelected, startYm, totalParts){
  if(!startYm || !totalParts) return "";
  const endYm = calcEndYm(startYm, totalParts);
  const curIdx = ymToIndex(ymSelected);
  const endIdx = ymToIndex(endYm);
  if(curIdx > endIdx) return "0";
  return String((endIdx - curIdx) + 1);
}

// ------------------ render ------------------
function render(){
  const hasItems = (month.fixed || []).length > 0;

  if (emptyBox) emptyBox.style.display = hasItems ? "none" : "flex";
  if (tableEl) tableEl.style.display = hasItems ? "table" : "none";

  tbody.innerHTML = (month.fixed || []).map(item => {
    const end = (item.loanStartYm && item.loanParts) ? calcEndYm(item.loanStartYm, item.loanParts) : "";
    const faltam = (item.loanStartYm && item.loanParts) ? calcRemaining(ym, item.loanStartYm, item.loanParts) : "";

    return `
      <tr>
        <td>${item.name}</td>
        <td>${catLabel(item.category)}</td>
        <td>Dia ${item.dueDay}</td>
        <td class="right">${formatBRL(item.value)}</td>
        <td>${end ? ymToLabel(end) : "—"}</td>
        <td>${faltam ? faltam : "—"}</td>
        <td style="text-align:center;">
          <input type="checkbox" ${item.paid ? "checked":""} data-id="${item.id}" class="paid"/>
        </td>
        <td class="right">
          <button data-id="${item.id}" class="del">Excluir</button>
        </td>
      </tr>
    `;
  }).join("");

  const total = (month.fixed || []).reduce((a,b)=> a + Number(b.value||0), 0);
  if (summary) summary.innerHTML = `📅 ${ymToLabel(ym)} • Total fixas: <b>${formatBRL(total)}</b>`;

  if(summaryCats){
    const map = {};
    (month.fixed || []).forEach(it=>{
      const k = it.category || "outros";
      map[k] = (map[k] || 0) + Number(it.value || 0);
    });
    summaryCats.innerHTML = Object.entries(map)
      .sort((a,b)=> b[1]-a[1])
      .map(([k,val]) => `• ${catLabel(k)}: <b>${formatBRL(val)}</b>`)
      .join("<br>");
  }

  tbody.querySelectorAll(".paid").forEach(chk=>{
    chk.addEventListener("change", ()=>{
      const it = month.fixed.find(x=> x.id === chk.dataset.id);
      if(it){
        it.paid = chk.checked;
        saveState(state);
      }
    });
  });

  tbody.querySelectorAll(".del").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      month.fixed = month.fixed.filter(x=> x.id !== btn.dataset.id);
      saveState(state);
      render();
      validateAll(false);
    });
  });
}

// ------------------ importar mês anterior ------------------
function updateImportHint(){
  if(!importPrevHint) return;

  const prevYm = getPrevYm(ym);
  const prev = state.months?.[prevYm];
  const count = Array.isArray(prev?.fixed) ? prev.fixed.length : 0;

  importPrevHint.textContent = count
    ? `Vai importar ${count} item(ns) de ${ymToLabel(prevYm)} (sem duplicar).`
    : `Sem fixas em ${ymToLabel(prevYm)} para importar.`;
}

importPrevBtn?.addEventListener("click", ()=>{
  const prevYm = getPrevYm(ym);
  const prevMonth = ensureMonth(state, prevYm);
  prevMonth.fixed = Array.isArray(prevMonth.fixed) ? prevMonth.fixed : [];

  if(!prevMonth.fixed.length){
    updateImportHint();
    return;
  }

  const existing = new Set((month.fixed || []).map(x => String(x.name||"").trim().toLowerCase()));
  let added = 0;

  prevMonth.fixed.forEach(it=>{
    const nameKey = String(it.name||"").trim().toLowerCase();
    if(!nameKey) return;
    if(existing.has(nameKey)) return;

    month.fixed.push({
      id: uid(),
      name: it.name,
      value: Number(it.value || 0),
      dueDay: Number(it.dueDay || 1),
      paid: false,
      category: it.category || "outros",
      loanParts: it.loanParts || null,
      loanStartYm: it.loanStartYm || null,
    });

    existing.add(nameKey);
    added++;
  });

  saveState(state);
  render();

  if(importPrevHint) importPrevHint.textContent = `✅ Importado: ${added} item(ns) de ${ymToLabel(prevYm)}.`;
});

// ------------------ troca de mês ------------------
monthSelect?.addEventListener("change", () => {
  ym = getSelectedMonth();
  month = ensureMonth(state, ym);
  month.fixed = Array.isArray(month.fixed) ? month.fixed : [];
  saveState(state);

  clearAllErrors();
  validateAll(false);
  updateImportHint();
  render();
});

// ------------------ adicionar ------------------
addBtn?.addEventListener("click", ()=>{
  if(!validateAll(true)) return;

  const name = (descInput.value || "").trim();
  const value = num(valorInput.value);
  const dueDay = num(dueDayInput.value);
  const category = (categorySelect?.value || "outros");

  const loanPartsRaw = (loanPartsInput?.value || "").trim();
  const loanParts = loanPartsRaw ? Number(loanPartsRaw) : null;

  const loanStartYmRaw = (loanStartYmInput?.value || "").trim();
  const loanStartYm = loanStartYmRaw ? loanStartYmRaw : null;

  month.fixed.push({ id: uid(), name, value, dueDay, paid:false, category, loanParts, loanStartYm });
  saveState(state);

  descInput.value = "";
  valorInput.value = "";
  dueDayInput.value = "";
  if(categorySelect) categorySelect.value = "outros";
  if(loanPartsInput) loanPartsInput.value = "";
  if(loanStartYmInput) loanStartYmInput.value = "";

  clearAllErrors();
  validateAll(false);
  updateImportHint();
  render();
});

// init
wireValidation();     // ✅ liga a validação dinâmica (isso resolve seu “apagado”)
clearAllErrors();
validateAll(false);
updateImportHint();
render();