import {
  loadState,
  saveState,
  ensureMonth,
  ymToLabel,
  LAST_MONTH_KEY,
} from "./storage.js";

import { supabase } from "./supabaseClient.js";
import { pullStateFromCloud } from "./cloudState.js";
import { calcMonthTotals } from "./finance.js";

/* =========================
   Perfil local
========================= */
const PROFILE_KEY = "profile_v1";

function getStoredProfile(userId) {
  try {
    const all = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
    return all[userId] || null;
  } catch {
    return null;
  }
}

function firstLetter(name) {
  const text = String(name || "").trim();
  return text ? text[0].toUpperCase() : "U";
}

export async function renderUserName() {
  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user;

  if (!user) return;

  const saved = getStoredProfile(user.id);

  const name =
    saved?.name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Usuário";

  const photo = saved?.photo || null;

  const nameEl = document.getElementById("userName");
  if (nameEl) {
    nameEl.textContent = name;
  }

  const avatarEl = document.getElementById("userAvatar");

  if (avatarEl) {
    avatarEl.innerHTML = "";

    if (photo) {
      const img = document.createElement("img");
      img.src = photo;
      img.alt = "avatar";
      img.className = "avatar-img";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.borderRadius = "999px";

      avatarEl.appendChild(img);
    } else {
      avatarEl.textContent = firstLetter(name);
    }
  }

  const badge = document.getElementById("userBadge");
  if (badge) {
    badge.style.display = "inline-flex";
  }
}

/* =========================
   Mês
========================= */
export function currentYm() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function isYm(value) {
  return /^\d{4}-\d{2}$/.test(String(value || ""));
}

export function getSelectedMonth() {
  const select = document.querySelector("#monthSelect");
  const saved = localStorage.getItem(LAST_MONTH_KEY);

  return select?.value || saved || currentYm();
}

const MIN_YEAR = 2026;

function buildMonthRange({ yearsForward = 5 } = {}) {
  const now = new Date();

  const startYear = MIN_YEAR;
  const endYear = Math.max(now.getFullYear() + yearsForward, MIN_YEAR + yearsForward);

  const list = [];

  for (let year = startYear; year <= endYear; year++) {
    for (let month = 1; month <= 12; month++) {
      list.push(`${year}-${String(month).padStart(2, "0")}`);
    }
  }

  return list;
}

/* =========================
   Auth
========================= */
export async function requireAuth() {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;

  if (!session) {
    window.location.href = "login.html";
    return null;
  }

  const uid = session.user.id;
  const lastUid = localStorage.getItem("albano_financas_uid");

  if (lastUid && lastUid !== uid) {
    localStorage.removeItem("albano_financas_v1");
    localStorage.removeItem(LAST_MONTH_KEY);
  }

  localStorage.setItem("albano_financas_uid", uid);

  return session;
}

export async function signOut() {
  await supabase.auth.signOut();

  localStorage.removeItem("albano_financas_v1");
  localStorage.removeItem(LAST_MONTH_KEY);
  localStorage.removeItem("albano_financas_uid");

  window.location.href = "login.html";
}

export async function hydrateStateFromCloud() {
  const cloud = await pullStateFromCloud();

  if (!cloud) return false;

  saveState(cloud, { sync: false });

  return true;
}

/* =========================
   Header / Navegação
========================= */
export async function initHeader(active, { syncCloud = true } = {}) {
  const session = await requireAuth();

  if (!session) return null;

  if (syncCloud) {
    await hydrateStateFromCloud();
  }

  document.querySelectorAll(".nav a, .sidebar-nav a").forEach((link) => {
    link.classList.toggle("active", link.dataset.page === active);
  });

  const logoutBtn = document.getElementById("logoutBtn");

  logoutBtn?.addEventListener("click", async () => {
    logoutBtn.disabled = true;
    await signOut();
  });

  const monthSelect = document.querySelector("#monthSelect");

  if (!monthSelect) return session;

  const state = loadState();
  const current = currentYm();
  const savedMonth = localStorage.getItem(LAST_MONTH_KEY);
  const last = isYm(savedMonth) ? savedMonth : current;

  const existingMonths = Object.keys(state.months || {}).filter(isYm);

  if (!existingMonths.length) {
    ensureMonth(state, current);
    saveState(state);
  }

  if (isYm(last) && !state.months[last]) {
    ensureMonth(state, last);
    saveState(state);
  }

  const range = Array.from(
    new Set([
      ...buildMonthRange(),
      ...Object.keys(state.months || {}),
      current,
      last,
    ].filter((ym) => isYm(ym) && Number(ym.slice(0, 4)) >= MIN_YEAR))
  ).sort();

  monthSelect.innerHTML = range
    .map((ym) => `<option value="${ym}">${ymToLabel(ym)}</option>`)
    .join("");

  monthSelect.value = range.includes(last) ? last : current;

  monthSelect.addEventListener("change", () => {
    const selected = monthSelect.value;

    localStorage.setItem(LAST_MONTH_KEY, selected);

    const nextState = loadState();
    ensureMonth(nextState, selected);
    saveState(nextState);

    window.location.reload();
  });

  document.querySelector("#exportCsv")?.addEventListener("click", () => {
    exportCsv();
  });

  return session;
}

/* =========================
   Export CSV
========================= */
function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");

  if (/[;"\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function exportCsv() {
  const state = loadState();

  const rows = [
    [
      "Mes",
      "Renda",
      "Fixas total",
      "Fixas pendentes",
      "Cartao",
      "Metas",
      "Despesas planejadas",
      "Saldo planejado",
      "Saldo realizado",
    ],
  ];

  Object.keys(state.months || {})
    .sort()
    .forEach((ym) => {
      const month = state.months[ym] || {};
      const totals = calcMonthTotals(month);

      rows.push([
        ym,
        totals.income,
        totals.fixedTotal,
        totals.fixedPending,
        totals.card,
        totals.goals,
        totals.plannedExpenses,
        totals.plannedBalance,
        totals.realizedBalance,
      ]);
    });

  const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(";")).join("\n")}`;

  download("resumo-financeiro.csv", csv, "text/csv;charset=utf-8");
}