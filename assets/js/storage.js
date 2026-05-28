import { pushStateToCloud } from "./cloudState.js";

export const STORAGE_KEY = "albano_financas_v1";
export const LAST_MONTH_KEY = "albano_financas_last_month";

const STORAGE_VERSION = 2;

let pushTimer = null;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function defaultState() {
  return {
    version: STORAGE_VERSION,
    months: {},
    closedMonths: {},
    updatedAt: null,
  };
}

export function normalizeMonth(month) {
  const m = isObject(month) ? month : {};

  m.incomeBase = Number(m.incomeBase ?? m.income ?? 0) || 0;
  m.incomeExtra = Array.isArray(m.incomeExtra) ? m.incomeExtra : [];
  m.fixed = Array.isArray(m.fixed) ? m.fixed : [];
  m.card = Array.isArray(m.card) ? m.card : [];
  m.cardRecurring = Array.isArray(m.cardRecurring) ? m.cardRecurring : [];
  m.goals = Array.isArray(m.goals) ? m.goals : [];

  return m;
}

export function normalizeState(raw) {
  const state = isObject(raw) ? raw : defaultState();

  state.version = Number(state.version || STORAGE_VERSION);
  state.months = isObject(state.months) ? state.months : {};
  state.closedMonths = isObject(state.closedMonths) ? state.closedMonths : {};
  state.updatedAt = state.updatedAt || null;

  Object.keys(state.months).forEach((ym) => {
    state.months[ym] = normalizeMonth(state.months[ym]);
  });

  return state;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();

    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch (error) {
    console.error("Erro ao carregar estado local:", error);
    return defaultState();
  }
}

export function saveState(state, { sync = true } = {}) {
  const cleanState = normalizeState(state);

  cleanState.version = STORAGE_VERSION;
  cleanState.updatedAt = new Date().toISOString();

  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanState));

  if (!sync) return cleanState;

  clearTimeout(pushTimer);

  pushTimer = setTimeout(() => {
    pushStateToCloud(cleanState).catch((error) => {
      console.error("Erro ao sincronizar com Supabase:", error);
    });
  }, 350);

  return cleanState;
}

export function replaceStateFromCloud(cloudState) {
  const cleanState = normalizeState(cloudState);
  saveState(cleanState, { sync: false });
  return cleanState;
}

export function ensureMonth(state, ym) {
  const cleanState = normalizeState(state);

  cleanState.months = cleanState.months || {};

  if (!cleanState.months[ym]) {
    cleanState.months[ym] = {};
  }

  cleanState.months[ym] = normalizeMonth(cleanState.months[ym]);

  return cleanState.months[ym];
}

export function formatBRL(value) {
  const v = Number(value || 0);

  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function ymToLabel(ym) {
  const value = String(ym || "");

  if (!/^\d{4}-\d{2}$/.test(value)) {
    return value || "-";
  }

  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1, 1);

  return date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

export function uid() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function parseMoneyInput(value) {
  const text = String(value ?? "").trim();

  if (!text) return 0;

  let normalized = text;

  if (text.includes(",") && text.includes(".")) {
    normalized = text.replaceAll(".", "").replace(",", ".");
  } else {
    normalized = text.replace(",", ".");
  }

  const number = Number(normalized);

  return Number.isFinite(number) ? number : 0;
}