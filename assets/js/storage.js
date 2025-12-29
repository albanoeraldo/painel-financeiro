// assets/js/storage.js
const KEY = "albano_financas_v1";

import { pushStateToCloud } from "./cloudState.js";

function defaultState(){
  return { months: {} };
}

export function loadState(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);

    // garante estrutura
    parsed.months = parsed.months && typeof parsed.months === "object" ? parsed.months : {};
    return parsed;
  }catch(e){
    return defaultState();
  }
}

let pushTimer = null;

export function saveState(state){
  localStorage.setItem(KEY, JSON.stringify(state));

  // debounce: evita spam no Supabase
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushStateToCloud(state).catch(console.error);
  }, 350);
}

// (mantém suas funções que já existem)
export function ensureMonth(state, ym){
  state.months = state.months || {};
  if(!state.months[ym]){
    state.months[ym] = { incomeBase:0, incomeExtra:[], fixed:[], card:[], goals:[] };
  }

  // normaliza
  const m = state.months[ym];
  if (m.incomeBase === undefined) m.incomeBase = 0;
  if (!Array.isArray(m.incomeExtra)) m.incomeExtra = [];
  if (!Array.isArray(m.fixed)) m.fixed = [];
  if (!Array.isArray(m.card)) m.card = [];
  if (!Array.isArray(m.goals)) m.goals = [];

  return state.months[ym];
}

export function formatBRL(value){
  const v = Number(value || 0);
  return v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
}

export function ymToLabel(ym){
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m-1, 1);
  return d.toLocaleDateString("pt-BR", { month:"long", year:"numeric" });
}

export function uid(){
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}