// assets/js/ui.js
import { loadState, saveState, ensureMonth, ymToLabel } from "./storage.js";
import { supabase } from "./supabaseClient.js";
import { pullStateFromCloud } from "./cloudState.js";

export function currentYm(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  return `${y}-${m}`;
}

function buildMonthRange({ startYear = 2026, endYear = 2030 } = {}){
  const list = [];
  for(let y = startYear; y <= endYear; y++){
    for(let m = 1; m <= 12; m++){
      list.push(`${y}-${String(m).padStart(2,"0")}`);
    }
  }
  return list;
}

export function getSelectedMonth(){
  const el = document.querySelector("#monthSelect");
  const saved = localStorage.getItem("albano_financas_last_month");
  return el?.value || saved || currentYm();
}

// -------- Spinner ----------
function ensureSpinner(){
  if(document.getElementById("appSpinner")) return;

  const div = document.createElement("div");
  div.id = "appSpinner";
  div.style.cssText = `
    position:fixed; inset:0; display:none;
    align-items:center; justify-content:center;
    background:rgba(255,255,255,.65);
    backdrop-filter: blur(6px);
    z-index:9999;
  `;
  div.innerHTML = `
    <div style="
      background:#fff;border:1px solid #e5e7eb;border-radius:16px;
      padding:16px 18px;box-shadow:0 10px 22px rgba(2,6,23,.08);
      display:flex;align-items:center;gap:12px;
    ">
      <div style="
        width:18px;height:18px;border:3px solid #e5e7eb;border-top-color:#2563eb;
        border-radius:50%;animation:spin 1s linear infinite;
      "></div>
      <div style="font-weight:600;color:#0f172a">Carregando…</div>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  `;
  document.body.appendChild(div);
}
export function setLoading(v){
  ensureSpinner();
  const el = document.getElementById("appSpinner");
  if(el) el.style.display = v ? "flex" : "none";
}

// -------- Auth ----------
export async function requireAuth(){
  const { data } = await supabase.auth.getSession();
  if(!data.session){
    window.location.href = "login.html";
    return null;
  }
  return data.session;
}

async function syncFromCloud(){
  const cloud = await pullStateFromCloud();
  if(!cloud) return;

  // substitui o local pelo cloud (mais simples e seguro agora)
  localStorage.setItem("albano_financas_v1", JSON.stringify(cloud));
}

// -------- Header / Nav ----------
export async function initHeader(active){
  setLoading(true);

  // 1) garante login
  const sess = await requireAuth();
  if(!sess) return;

  // 2) puxa estado do cloud antes de preencher a UI
  await syncFromCloud();

  // nav active
  document.querySelectorAll(".nav a").forEach(a=>{
    a.classList.toggle("active", a.dataset.page === active);
  });

  // botão Sair (injeta se não existir)
  const actions = document.querySelector("header .actions");
  if(actions && !document.getElementById("logoutBtn")){
    const btn = document.createElement("button");
    btn.id = "logoutBtn";
    btn.className = "btn-danger";
    btn.textContent = "Sair";
    btn.addEventListener("click", async ()=>{
      setLoading(true);
      await supabase.auth.signOut();
      localStorage.removeItem("albano_financas_last_month");
      setLoading(false);
      window.location.href = "login.html";
    });
    actions.appendChild(btn);
  }

  // month select
  const monthSelect = document.querySelector("#monthSelect");
  if(!monthSelect){
    setLoading(false);
    return;
  }

  const state = loadState();
  const cur = currentYm();

  // se vazio, cria mês atual
  if(!state.months || Object.keys(state.months).length === 0){
    ensureMonth(state, cur);
    saveState(state);
  }

  const range = buildMonthRange({ startYear: 2026, endYear: 2030 });

  monthSelect.innerHTML = range
    .map(ym => `<option value="${ym}">${ymToLabel(ym)}</option>`)
    .join("");

  const last = localStorage.getItem("albano_financas_last_month") || cur;
  monthSelect.value = range.includes(last) ? last : cur;

  // ✅ sem reload: dispara evento global
  monthSelect.addEventListener("change", ()=>{
    localStorage.setItem("albano_financas_last_month", monthSelect.value);

    // garante mês no estado
    const st = loadState();
    ensureMonth(st, monthSelect.value);
    saveState(st);

    window.dispatchEvent(new CustomEvent("monthChanged", { detail: { ym: monthSelect.value } }));
  });

  // export buttons (mantém)
  const btnCsv = document.querySelector("#exportCsv");
  btnCsv?.addEventListener("click", ()=> exportCsv());

  setLoading(false);
}

function download(filename, content, mime){
  const blob = new Blob([content], { type:mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCsv(){
  const state = loadState();
  const rows = [["Mes","Renda","Fixas","Cartao","Metas (guardado)","Saldo"]];

  Object.keys(state.months || {}).sort().forEach(ym=>{
    const m = state.months[ym] || {};
    const rendaBase = Number(m.incomeBase || m.income || 0);
    const rendaExtras = Array.isArray(m.incomeExtra)
      ? m.incomeExtra.reduce((a,b)=> a + Number(b.value||0), 0)
      : 0;
    const renda = rendaBase + rendaExtras;

    const fixed = sum((m.fixed || []).map(x=> x.value));
    const card  = sum((m.card || []).map(x=> x.monthValue));
    const goals = sum((m.goals || []).map(x=> x.saved));
    const saldo = renda - fixed - card - goals;

    rows.push([ym, renda, fixed, card, goals, saldo]);
  });

  const csv = rows.map(r=> r.join(";")).join("\n");
  download("resumo-anual.csv", csv, "text/csv;charset=utf-8");
}
function sum(arr){ return (arr||[]).reduce((a,b)=> a + Number(b||0), 0); }