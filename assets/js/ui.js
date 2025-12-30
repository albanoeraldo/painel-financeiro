import { loadState, saveState, ensureMonth, ymToLabel } from "./storage.js";
import { supabase } from "./supabaseClient.js";

export function currentYm(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  return `${y}-${m}`;
}

export function getSelectedMonth(){
  const el = document.querySelector("#monthSelect");
  const saved = localStorage.getItem("albano_financas_last_month");
  return el?.value || saved || currentYm();
}

// --- AUTH helpers ---
export async function requireAuth(){
  const { data } = await supabase.auth.getSession();
  if(!data.session){
    window.location.href = "login.html";
    return null;
  }
  return data.session;
}

export async function signOut(){
  await supabase.auth.signOut();
  window.location.href = "login.html";
}

/** Gera meses fixos (range) */
function buildMonthRange({ startYear = 2026, endYear = 2030 } = {}){
  const list = [];
  for(let y = startYear; y <= endYear; y++){
    for(let m = 1; m <= 12; m++){
      list.push(`${y}-${String(m).padStart(2,"0")}`);
    }
  }
  return list;
}

export async function initHeader(active){
  // ✅ garante que está logado (evita bugs de sessão em páginas)
  const session = await requireAuth();
  if(!session) return;

  // nav active
  document.querySelectorAll(".nav a").forEach(a=>{
    if(a.dataset.page === active) a.classList.add("active");
  });

  // ✅ botão sair (funciona em todas as páginas)
  const logoutBtn = document.getElementById("logoutBtn");
  logoutBtn?.addEventListener("click", async ()=> {
    logoutBtn.disabled = true;
    await signOut();
  });

  // month select
  const monthSelect = document.querySelector("#monthSelect");
  if(!monthSelect) return;

  const state = loadState();
  state.months = state.months || {}; // segurança
  const cur = currentYm();

  // se não existir nenhum mês ainda, cria o mês atual
  if(Object.keys(state.months).length === 0){
    ensureMonth(state, cur);
    saveState(state);
  }

  const range = buildMonthRange({ startYear: 2026, endYear: 2030 });

  monthSelect.innerHTML = range
    .map(ym => `<option value="${ym}">${ymToLabel(ym)}</option>`)
    .join("");

  // manter último selecionado
  const last = localStorage.getItem("albano_financas_last_month") || cur;
  monthSelect.value = range.includes(last) ? last : cur;

  monthSelect.addEventListener("change", ()=>{
    localStorage.setItem("albano_financas_last_month", monthSelect.value);

    const st = loadState();
    st.months = st.months || {};
    ensureMonth(st, monthSelect.value);
    saveState(st);

    window.location.reload();
  });

  // export
  document.querySelector("#exportCsv")?.addEventListener("click", ()=> exportCsv());
}

function download(filename, content, mime){
  const blob = new Blob([content], { type:mime });
 _toggleDownload(blob, filename);
}
function _toggleDownload(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCsv(){
  const state = loadState();
  state.months = state.months || {};
  const rows = [["Mes","Renda","Fixas","Cartao","Metas (guardado)","Saldo"]];

  Object.keys(state.months).sort().forEach(ym=>{
    const m = state.months[ym] || {};

    const rendaBase = Number(m.incomeBase || m.income || 0);
    const rendaExtras = Array.isArray(m.incomeExtra)
      ? m.incomeExtra.reduce((a,b)=> a + Number(b.value||0), 0)
      : 0;
    const renda = rendaBase + rendaExtras;

    const fixed = sum((m.fixed || []).map(x=> x.value));
    const card  = sum((m.card || []).map(x=> x.monthValue));
    const goalsSaved = sum((m.goals || []).map(x=> x.saved));
    const saldo = renda - fixed - card - goalsSaved;

    rows.push([ym, renda, fixed, card, goalsSaved, saldo]);
  });

  const csv = rows.map(r=> r.join(";")).join("\n");
  download("resumo-anual.csv", csv, "text/csv;charset=utf-8");
}

function sum(arr){ return (arr || []).reduce((a,b)=> a + Number(b||0), 0); }