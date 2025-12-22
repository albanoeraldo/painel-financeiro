const KEY = "albano_financas_v1";

function defaultState(){
  return {
    months: {
      // exemplo:
      // "2026-01": { income: 5400, fixed:[], card:[], goals:[] }
    }
  };
}

export function loadState(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // MIGRAÇÃO: garantir estrutura nova nos meses antigos
    for (const ym in parsed.months) {
     const m = parsed.months[ym];

    // Se existia "income" antigo, joga em incomeBase
    if (m.income !== undefined && m.incomeBase === undefined) {
      m.incomeBase = Number(m.income || 0);
    delete m.income;
  }

  if (m.incomeBase === undefined) m.incomeBase = 0;
  if (!Array.isArray(m.incomeExtra)) m.incomeExtra = [];

  if (!Array.isArray(m.fixed)) m.fixed = [];
  if (!Array.isArray(m.card)) m.card = [];
  if (!Array.isArray(m.goals)) m.goals = [];
}

    if(!parsed.months) return defaultState();
    return parsed;
  }catch{
    return defaultState();
  }
}

export function saveState(state){
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function ensureMonth(state, ym){
  if(!state.months[ym]){
    state.months[ym] = {
      incomeBase: 0,
      incomeExtra: [],   // [{id, name, value}]
      fixed: [],
      card: [],
      goals: []
    };
  }
  return state.months[ym];
}

export function uid(){
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function formatBRL(value){
  const v = Number(value || 0);
  return v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
}

// ym = "2026-01"
export function ymToLabel(ym){
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m-1, 1);
  return d.toLocaleDateString("pt-BR", { month:"long", year:"numeric" });
}

export function addMonths(ym, add){
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m-1 + add, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  return `${yy}-${mm}`;
}

// início + (parcelas-1) meses
export function endMonth(startYm, parcelas){
  return addMonths(startYm, Math.max(0, Number(parcelas)-1));
}
