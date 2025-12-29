import { loadState, saveState, ensureMonth, ymToLabel } from "./storage.js";

export function currentYm(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  return `${y}-${m}`;
}

import { supabase } from "./supabaseClient.js";

export async function requireAuth(){
  const { data } = await supabase.auth.getSession();
  if(!data.session){
    window.location.href = "login.html";
    return null;
  }
  return data.session;
}

/**
 * ✅ Gera lista de meses (YYYY-MM) em um range de anos
 * Ajuste startYear/endYear como quiser (ex: 2024–2030)
 */
function buildMonthRange({ startYear = 2024, endYear = 2028 } = {}){
  const list = [];
  for(let y = startYear; y <= endYear; y++){
    for(let m = 1; m <= 12; m++){
      const mm = String(m).padStart(2,"0");
      list.push(`${y}-${mm}`);
    }
  }
  return list;
}

export function getSelectedMonth(){
  const el = document.querySelector("#monthSelect");
  const saved = localStorage.getItem("albano_financas_last_month");
  return el?.value || saved || currentYm();
}

export function initHeader(active){
  // nav active
  document.querySelectorAll(".nav a").forEach(a=>{
    if(a.dataset.page === active) a.classList.add("active");
  });

  // month select
  const monthSelect = document.querySelector("#monthSelect");
  if(!monthSelect) return;

  const state = loadState();
  const cur = currentYm();

  // ✅ Se não existir nenhum mês ainda, cria o mês atual
  if(Object.keys(state.months).length === 0){
    ensureMonth(state, cur);
    saveState(state);
  }

  // ✅ Agora preenche com um RANGE completo (não só meses existentes)
  const range = buildMonthRange({ startYear: 2026, endYear: 2030 });

  monthSelect.innerHTML = range
    .map(ym => `<option value="${ym}">${ymToLabel(ym)}</option>`)
    .join("");

  // manter último selecionado
  const last = localStorage.getItem("albano_financas_last_month") || cur;
  monthSelect.value = range.includes(last) ? last : cur;

  // ✅ Ao trocar mês: salva + garante mês no state + recarrega
  monthSelect.addEventListener("change", ()=>{
    localStorage.setItem("albano_financas_last_month", monthSelect.value);

    const st = loadState();
    ensureMonth(st, monthSelect.value);
    saveState(st);

    window.location.reload();
  });

  // Botões export
  const btnJson = document.querySelector("#exportJson");
  btnJson?.addEventListener("click", ()=> exportJson());

  const btnCsv = document.querySelector("#exportCsv");
  btnCsv?.addEventListener("click", ()=> exportCsv());
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

function exportJson(){
  const state = loadState();
  download("relatorio-financas.json", JSON.stringify(state, null, 2), "application/json");
}

function exportCsv(){
  // CSV simples: mês, renda, fixas, cartao, metas, saldo
  const state = loadState();
  const rows = [["Mes","Renda","Fixas","Cartao","Metas (guardado)","Saldo"]];

  Object.keys(state.months).sort().forEach(ym=>{
    const m = state.months[ym];

    // ✅ renda = base + extras (caso você esteja usando incomeBase/incomeExtra)
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

function sum(arr){ return arr.reduce((a,b)=> a + Number(b||0), 0); }
