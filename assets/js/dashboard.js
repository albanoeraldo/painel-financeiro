import { initHeader, renderUserName, getSelectedMonth } from "./ui.js";
import { loadState, saveState, ensureMonth, uid, formatBRL, ymToLabel } from "./storage.js";
import { createValidator } from "./validate.js";
import { pullStateFromCloud } from "./cloudState.js";

await initHeader("dashboard");
await renderUserName();

// ✅ Puxa do Supabase e grava no localStorage antes de usar state/month
const cloud = await pullStateFromCloud();
if (cloud) saveState(cloud);

// Estado e mês (let pq muda ao trocar o mês)
let ym = getSelectedMonth();
const state = loadState();
let month = ensureMonth(state, ym);

// -------------------------
// Normalização
// -------------------------
function normalizeMonth(m){
  m.incomeBase  = Number(m.incomeBase || 0);
  m.incomeExtra = Array.isArray(m.incomeExtra) ? m.incomeExtra : [];
  m.fixed       = Array.isArray(m.fixed) ? m.fixed : [];
  m.card        = Array.isArray(m.card) ? m.card : [];
  m.cardRecurring = Array.isArray(m.cardRecurring) ? m.cardRecurring : [];
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

// -------------------------
// Categorias (para o Dashboard)
// -------------------------
const CATEGORIES = [
  { key: "moradia", label: "🏠 Moradia" },
  { key: "alimentacao", label: "🍽️ Alimentação" },
  { key: "transporte", label: "🚗 Transporte" },
  { key: "saude", label: "🩺 Saúde" },
  { key: "internet", label: "📶 Internet/Telefone" },
  { key: "lazer", label: "🎉 Lazer" },
  { key: "emprestimo", label: "💳 Empréstimo" },
  { key: "outros", label: "📌 Outros" },
];

function catLabel(key){
  const c = CATEGORIES.find(x => x.key === key);
  return c ? c.label : "📌 Outros";
}

/**
 * ✅ NOVO: Normaliza categoria vinda do Fixas/Cartão
 * - aceita "moradia" (key)
 * - aceita "Moradia" (texto)
 * - aceita "📶 Internet/Telefone" etc (texto com emoji)
 */
function normalizeCategoryKey(raw){
  const s = String(raw || "").trim();
  if(!s) return "outros";

  // já é key?
  if(CATEGORIES.some(c => c.key === s)) return s;

  // remove emoji e normaliza texto
  const clean = s
    .replace(/^[^\p{L}\p{N}]*/gu, "") // tira emoji no início (best-effort)
    .trim()
    .toLowerCase();

  const mapTextToKey = {
    "moradia": "moradia",
    "alimentação": "alimentacao",
    "alimentacao": "alimentacao",
    "transporte": "transporte",
    "saúde": "saude",
    "saude": "saude",
    "internet/telefone": "internet",
    "internet": "internet",
    "lazer": "lazer",
    "empréstimo": "emprestimo",
    "emprestimo": "emprestimo",
    "outros": "outros",
  };

  return mapTextToKey[clean] || "outros";
}

// ✅ total das assinaturas ativas do cartão
function cardRecurringTotal(m){
  return sum((m.cardRecurring || [])
    .filter(x => x && x.active !== false)
    .map(x => x.value));
}

function fixedTotals(m){
  const fixedTotal = sum((m.fixed || []).map(x => x.value));
  const fixedPending = sum((m.fixed || []).filter(x => !x.paid).map(x => x.value));
  const fixedPaid = fixedTotal - fixedPending;
  return { fixedTotal, fixedPending, fixedPaid };
}

function totalsByCategoryFixed(m){
  // soma por categoria (todas as fixas)
  const mapTotal = {};
  // soma por categoria (somente pendentes)
  const mapPending = {};

  (m.fixed || []).forEach(it=>{
    const key = normalizeCategoryKey(it.category || "outros");
    const val = Number(it.value || 0);

    mapTotal[key] = (mapTotal[key] || 0) + val;
    if(!it.paid) mapPending[key] = (mapPending[key] || 0) + val;
  });

  return { mapTotal, mapPending };
}

/**
 * ✅ NOVO: soma por categoria das despesas do mês
 * (Fixas PENDENTES + Cartão (parcelas + assinaturas ativas))
 */
function totalsByCategoryExpenses(m){
  const mapTotal = {}; // total por categoria das despesas do mês (pendentes + cartão)
  const mapPending = {}; // pendente por categoria (aqui só faz sentido para Fixas)

  // FIXAS (pendentes) por categoria
  (m.fixed || []).forEach(it=>{
    const key = normalizeCategoryKey(it.category || "outros");
    const val = Number(it.value || 0);

    if(!it.paid){
      mapTotal[key] = (mapTotal[key] || 0) + val;
      mapPending[key] = (mapPending[key] || 0) + val;
    }
  });

  // CARTÃO - PARCELAS (sempre entram no mês)
  (m.card || []).forEach(it=>{
    const key = normalizeCategoryKey(it.category || "outros");
    const val = Number(it.monthValue || 0);
    mapTotal[key] = (mapTotal[key] || 0) + val;
  });

  // CARTÃO - ASSINATURAS ATIVAS
  (m.cardRecurring || [])
    .filter(x => x && x.active !== false)
    .forEach(it=>{
      const key = normalizeCategoryKey(it.category || "outros");
      const val = Number(it.value || 0);
      mapTotal[key] = (mapTotal[key] || 0) + val;
    });

  return { mapTotal, mapPending };
}

function calcTotals(m){
  const { fixedTotal, fixedPending, fixedPaid } = fixedTotals(m);

  // ✅ parcelas + assinaturas
  const cardParts = sum((m.card || []).map(x => x.monthValue));
  const cardRec   = cardRecurringTotal(m);
  const card      = cardParts + cardRec;

  const goals = sum((m.goals || []).map(x => x.saved));

  const incomeBase  = Number(m.incomeBase || 0);
  const incomeExtra = (m.incomeExtra || []).reduce((a,b)=> a + Number(b.value || 0), 0);
  const income      = incomeBase + incomeExtra;

  // ✅ Falta pagar muda conforme você marca "pago?"
  const despesasPendentes = fixedPending + card + goals;

  // ✅ Saldo NÃO muda ao pagar fixas (usa o plano do mês)
  const despesasPlanejadas = fixedTotal + card + goals;
  const saldo = income - despesasPlanejadas;

  return {
    fixedTotal,
    fixedPending,
    fixedPaid,
    card,
    goals,
    incomeBase,
    incomeExtra,
    income,
    despesasPendentes,      // "Falta pagar (mês)"
    despesasPlanejadas,     // opcional (se quiser usar depois)
    saldo                   // "Saldo (sobra/falta)" travado
  };
}

// -------------------------
// Renders
// -------------------------
function renderKpis(){
  const {
    fixedTotal, fixedPending, fixedPaid,
    card, goals, income, despesasPendentes, saldo
  } = calcTotals(month);

  const kpis = [
    { label:"Renda do mês", value: formatBRL(income) },
    { label:"Fixas (pendentes)", value: formatBRL(fixedPending) },
    { label:"Cartão (parcelas + assinaturas)", value: formatBRL(card) },
    { label:"Metas (guardado no mês)", value: formatBRL(goals) },
    { label:"Falta pagar (mês)", value: formatBRL(despesasPendentes) },
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

        ${
          k.label === "Fixas (pendentes)"
            ? `<div class="helper" style="margin-top:10px;">Pagas: <b>${formatBRL(fixedPaid)}</b> • Total fixas: <b>${formatBRL(fixedTotal)}</b></div>`
            : ``
        }
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

function ensureCategoriesCard(){
  let el = document.getElementById("categoriesSummary");
  if(el) return el;

  // cria um card no final da container se não existir no HTML
  const container = document.querySelector(".container");
  if(!container) return null;

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h3 style="margin:0 0 10px;">Categorias do mês</h3>
    <div id="categoriesSummary"></div>
    <div class="helper" style="margin-top:8px;">
      Dica: esse resumo usa categorias das <b>Fixas (pendentes)</b> + <b>Cartão</b>.
    </div>
  `;
  container.appendChild(card);

  return document.getElementById("categoriesSummary");
}

function renderCategories(){
  const el = ensureCategoriesCard();
  if(!el) return;

  // ✅ agora integra Fixas (pendentes) + Cartão
  const { mapTotal, mapPending } = totalsByCategoryExpenses(month);

  const entries = Object.entries(mapTotal)
    .map(([k, total]) => {
      const pending = Number(mapPending[k] || 0);
      return { k, total: Number(total || 0), pending };
    })
    .filter(x => x.total > 0)
    .sort((a,b)=> b.total - a.total);

  if(!entries.length){
    el.innerHTML = `<div class="empty"><div><div class="title">Sem dados por categoria</div><div class="desc">Adicione Fixas/Cartão com categoria para aparecer aqui.</div></div></div>`;
    return;
  }

  const max = Math.max(...entries.map(x=> x.total));

  el.innerHTML = entries.map(x=>{
    const pct = max > 0 ? (x.total / max) * 100 : 0;
    const pctPend = x.total > 0 ? (x.pending / x.total) * 100 : 0;

    return `
      <div style="margin:10px 0;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div style="font-weight:600;">${catLabel(x.k)}</div>
          <div class="right" style="white-space:nowrap;">
            <b>${formatBRL(x.total)}</b>
            ${x.pending > 0 ? `<span style="opacity:.7;"> • fixas pendente ${formatBRL(x.pending)}</span>` : ``}
          </div>
        </div>

        <div style="height:10px; background:rgba(2,6,23,.08); border-radius:999px; overflow:hidden; margin-top:8px;">
          <div style="width:${pct}%; height:100%; background:rgba(37,99,235,.85);"></div>
        </div>

        ${
          x.pending > 0
            ? `<div class="helper" style="margin-top:6px;">Fixas pendente: ${pctPend.toFixed(0)}%</div>`
            : ``
        }
      </div>
    `;
  }).join("");
}

function renderMonthSummary(){
  const tbody = document.querySelector("#monthBreakdown tbody");
  if(!tbody) return;

  // ✅ aqui também considera fixas pendentes
  const { fixedTotal, fixedPending } = fixedTotals(month);

  const cardParts = sum((month.card || []).map(x => x.monthValue));
  const cardRec = cardRecurringTotal(month);
  const card = cardParts + cardRec;

  const goals = sum((month.goals || []).map(x => x.saved));
  const totalDespesas = fixedPending + card + goals;

  const rows = [
    { name:"Fixas (pendentes)", value: fixedPending },
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

  // se existir um lugar pra mostrar uma observação do total das fixas, coloca
  const foot = document.querySelector("#monthBreakdownFoot");
  if(foot){
    foot.innerHTML = `Total fixas (incluindo pagas): <b>${formatBRL(fixedTotal)}</b>`;
  }
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
  renderCategories();
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

// UX
incomeBaseInput?.addEventListener("input", ()=>{ if(incomeBaseInput.classList.contains("invalid")) ruleSalaryOptional(); });
extraNameInput?.addEventListener("input", ()=>{ if(extraNameInput.classList.contains("invalid")) ruleExtraName(); });
extraValueInput?.addEventListener("input", ()=>{ if(extraValueInput.classList.contains("invalid")) ruleExtraValue(); });

// init
renderDashboard();
