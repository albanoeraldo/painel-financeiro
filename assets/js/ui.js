import { loadState, saveState, ensureMonth, ymToLabel } from "./storage.js";

export function getSelectedMonth(){
  const el = document.querySelector("#monthSelect");
  return el?.value || currentYm();
}

export function currentYm(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  return `${y}-${m}`;
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
  const months = Object.keys(state.months);
  const cur = currentYm();

  // se não existir nenhum mês ainda, cria o mês atual
  if(months.length === 0){
    ensureMonth(state, cur);
    saveState(state);
  }

  // preencher select com meses existentes + atual
  const all = new Set([...Object.keys(loadState().months), cur]);
  const sorted = Array.from(all).sort(); // ordem crescente
  monthSelect.innerHTML = sorted.map(ym => `<option value="${ym}">${ymToLabel(ym)}</option>`).join("");

  // manter último selecionado
  const last = localStorage.getItem("albano_financas_last_month") || cur;
  monthSelect.value = sorted.includes(last) ? last : cur;

  monthSelect.addEventListener("change", ()=>{
    localStorage.setItem("albano_financas_last_month", monthSelect.value);
    // recarrega página atual para atualizar dados
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
    const fixed = sum(m.fixed.map(x=> x.value));
    const card  = sum(m.card.map(x=> x.monthValue));
    const goalsSaved = sum(m.goals.map(x=> x.saved));
    const saldo = (m.income||0) - fixed - card - goalsSaved;
    rows.push([ym, m.income||0, fixed, card, goalsSaved, saldo]);
  });
  const csv = rows.map(r=> r.join(";")).join("\n");
  download("resumo-anual.csv", csv, "text/csv;charset=utf-8");
}

function sum(arr){ return arr.reduce((a,b)=> a + Number(b||0), 0); }
