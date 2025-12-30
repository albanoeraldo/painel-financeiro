import { initHeader, getSelectedMonth } from "./ui.js";
import { loadState, saveState, ensureMonth, uid, formatBRL, ymToLabel } from "./storage.js";
import { createValidator } from "./validate.js";
import { pullStateFromCloud } from "./cloudState.js";

await initHeader("dashboard");

// ✅ Puxa do Supabase e grava no localStorage antes de usar state/month
const cloud = await pullStateFromCloud();
if (cloud) saveState(cloud);

// Estado e mês (let pq muda ao trocar o mês)
let ym = getSelectedMonth();
const state = loadState();
let month = ensureMonth(state, ym);

// garante estrutura
function normalizeMonth(m){
  m.incomeBase  = Number(m.incomeBase || 0);
  m.incomeExtra = Array.isArray(m.incomeExtra) ? m.incomeExtra : [];
  m.fixed       = Array.isArray(m.fixed) ? m.fixed : [];
  m.card        = Array.isArray(m.card) ? m.card : [];
  m.cardRecurring = Array.isArray(m.cardRecurring) ? m.cardRecurring : []; // ✅ NEW
  m.goals       = Array.isArray(m.goals) ? m.goals : [];
  return m;
}
normalizeMonth(month);
saveState(state);

// UI
const monthLabelEl = document.querySelector("#monthLabel");
if (monthLabelEl) monthLabelEl.textContent = ymToLabel(ym);

// elements
const incomeBaseInput = document.getElementById("incomeBase");
const incomeBaseErr   = document.getElementById("incomeBaseError");
const saveIncomeBaseBtn = document.getElementById("saveIncomeBase");
const clearSalaryBtn = document.getElementById("clearSalary");

const extraNameInput = document.getElementById("incomeExtraName");
const extraNameErr   = document.getElementById("incomeExtraNameError");
const extraValueInput = document.getElementById("incomeExtraValue");
const extraValueErr   = document.getElementById("incomeExtraValueError");
const addExtraBtn = document.getElementById("addIncomeExtra");
const extraTbody = document.querySelector("#incomeExtraTable tbody");

// validator
const v = createValidator({ showOn: "submit" });

// helpers
function sum(arr){ return (arr || []).reduce((a,b)=> a + Number(b || 0), 0); }
function clearErr(input, errEl){
  if (input) input.classList.remove("invalid");
  if (errEl) errEl.textContent = "";
}

// ✅ total das assinaturas ativas do cartão
function cardRecurringTotal(m){
  return sum((m.cardRecurring || [])
    .filter(x => x && x.active !== false)
    .map(x => x.value));
}

function calcTotals(m){
  const fixed = sum((m.fixed || []).map(x => x.value));

  // ✅ parcelas + assinaturas
  const cardParts = sum((m.card || []).map(x => x.monthValue));
  const cardRec   = cardRecurringTotal(m);
  const card      = cardParts + cardRec;

  const goals = sum((m.goals || []).map(x => x.saved));

  const incomeBase = Number(m.incomeBase || 0);
  const incomeExtra = (m.incomeExtra || []).reduce((a,b)=> a + Number(b.value || 0), 0);
  const income = incomeBase + incomeExtra;
  const saldo = income - fixed - card - goals;

  return { fixed, card, goals, incomeBase, incomeExtra, income, saldo };
}

// renders
function renderKpis(){
  const { fixed, card, goals, income, saldo } = calcTotals(month);

  const kpis = [
    { label:"Renda do mês", value: formatBRL(income) },
    { label:"Fixas", value: formatBRL(fixed) },
    { label:"Cartão (parcelas + assinaturas)", value: formatBRL(card) },
    { label:"Metas (guardado no mês)", value: formatBRL(goals) },
    { label:"Saldo (sobra/falta)", value: formatBRL(saldo), badge: saldo >= 0 ? "ok" : "bad" },
  ];

  const kpiEl = document.querySelector("#kpis");
  if(!kpiEl) return;

  kpiEl.innerHTML = kpis.map(k=>{
    const cls = k.badge ? `badge ${k.badge}` : "badge";
    return `
      <div class="card kpi">
        <div class="label">${k.label}</div>
        <div class="value">${k.value}</div>
        ${k.badge ? `<div style="margin-top:10px;"><span class="${cls}">${k.badge==="ok" ? "✅ Positivo" : "❌ Negativo"}</span></div>` : ""}
      </div>
    `;
  }).join("");
}

function renderExtras(){
  if(!extraTbody) return;

  extraTbody.innerHTML = (month.incomeExtra || []).map(item => `
    <tr>
      <td>${item.name}</td>
      <td class="right">${formatBRL(item.value)}</td>
      <td class="right"><button class="del-extra" data-id="${item.id}">Excluir</button></td>
    </tr>
  `).join("");

  extraTbody.querySelectorAll(".del-extra").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.id;
      month.incomeExtra = (month.incomeExtra || []).filter(x => x.id !== id);
      saveState(state);
      renderDashboard();
    });
  });
}

function renderMonthSummary(){
  const tbody = document.querySelector("#monthBreakdown tbody");
  if(!tbody) return;

  const fixed = sum((month.fixed || []).map(x => x.value));
  const cardParts = sum((month.card || []).map(x => x.monthValue));
  const cardRec = cardRecurringTotal(month);
  const card = cardParts + cardRec;
  const goals = sum((month.goals || []).map(x => x.saved));
  const totalDespesas = fixed + card + goals;

  const rows = [
    { name:"Fixas", value: fixed },
    { name:"Cartão", value: card },
    { name:"Metas", value: goals },
  ];

  tbody.innerHTML = rows.map(r=>{
    const pct = totalDespesas > 0 ? (r.value/totalDespesas)*100 : 0;
    return `
      <tr>
        <td>${r.name}</td>
        <td class="right">${formatBRL(r.value)}</td>
        <td class="right">${pct ? pct.toFixed(1) + "%" : "-"}</td>
      </tr>
    `;
  }).join("");
}

function renderDashboard(){
  ym = getSelectedMonth();
  month = ensureMonth(state, ym);
  normalizeMonth(month);
  saveState(state);

  if (monthLabelEl) monthLabelEl.textContent = ymToLabel(ym);

  if (incomeBaseInput) incomeBaseInput.value = month.incomeBase ? String(Number(month.incomeBase)) : "";

  renderKpis();
  renderExtras();
  renderMonthSummary();
}

// ---------- VALIDAÇÕES ----------

function ruleSalaryOptional(){
  const val = (incomeBaseInput?.value || "").trim();
  if(!val){ clearErr(incomeBaseInput, incomeBaseErr); return true; }
  return v.numberMin(incomeBaseInput, incomeBaseErr, 0.01, "Informe um salário maior que 0.");
}

function ruleExtraName(){ return v.required(extraNameInput, extraNameErr, "Informe a descrição da entrada extra."); }
function ruleExtraValue(){ return v.numberMin(extraValueInput, extraValueErr, 0.01, "Informe um valor maior que 0."); }

// salvar salário
saveIncomeBaseBtn?.addEventListener("click", ()=>{
  v.setShowMsg(true);
  const ok = v.validateAll([ruleSalaryOptional]);
  if(!ok) return;

  month.incomeBase = Number(incomeBaseInput?.value || 0);
  saveState(state);
  renderDashboard();
});

// remover salário
clearSalaryBtn?.addEventListener("click", ()=>{
  month.incomeBase = 0;
  saveState(state);

  if (incomeBaseInput) incomeBaseInput.value = "";
  clearErr(incomeBaseInput, incomeBaseErr);

  renderDashboard();
});

// adicionar extra
addExtraBtn?.addEventListener("click", ()=>{
  v.setShowMsg(true);
  const ok = v.validateAll([ruleExtraName, ruleExtraValue]);
  if(!ok) return;

  month.incomeExtra.push({
    id: uid(),
    name: extraNameInput.value.trim(),
    value: Number(extraValueInput.value),
  });
  saveState(state);

  extraNameInput.value = "";
  extraValueInput.value = "";
  clearErr(extraNameInput, extraNameErr);
  clearErr(extraValueInput, extraValueErr);

  renderDashboard();
});

// UX: ao mexer depois do submit, pode revalidar
incomeBaseInput?.addEventListener("input", ()=>{ if(incomeBaseInput.classList.contains("invalid")) ruleSalaryOptional(); });
extraNameInput?.addEventListener("input", ()=>{ if(extraNameInput.classList.contains("invalid")) ruleExtraName(); });
extraValueInput?.addEventListener("input", ()=>{ if(extraValueInput.classList.contains("invalid")) ruleExtraValue(); });

// init
renderDashboard();