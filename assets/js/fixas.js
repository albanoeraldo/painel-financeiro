import { initHeader, getSelectedMonth } from "./ui.js";
import { loadState, saveState, ensureMonth, uid, formatBRL, ymToLabel } from "./storage.js";

initHeader("fixas");

// Estado e mês (let pq muda ao trocar mês)
let ym = getSelectedMonth();
const state = loadState();
let month = ensureMonth(state, ym);

// Garante estrutura
month.fixed = Array.isArray(month.fixed) ? month.fixed : [];
saveState(state);

// Elements
const monthSelect = document.getElementById("monthSelect");

const descInput = document.getElementById("descFixa");
const valorInput = document.getElementById("valorFixa");
const dueDayInput = document.getElementById("dueDay");

const descErr = document.getElementById("descFixaError");
const valorErr = document.getElementById("valorFixaError");
const dueErr = document.getElementById("dueDayError");

const addBtn = document.getElementById("addFixedBtn");
const tbody = document.querySelector("#table tbody");
const summary = document.getElementById("summary");
const emptyBox = document.getElementById("fixedEmpty");
const tableEl = document.getElementById("table");

// ✅ controla quando pode “mostrar erro”
let triedSubmit = false;
const touched = { desc:false, valor:false, due:false };

// Troca de mês
monthSelect?.addEventListener("change", () => {
  ym = getSelectedMonth();
  month = ensureMonth(state, ym);
  month.fixed = Array.isArray(month.fixed) ? month.fixed : [];
  saveState(state);

  // reseta flags
  triedSubmit = false;
  touched.desc = touched.valor = touched.due = false;

  clearAllErrors();
  validateAll(false); // não mostra erro
  render();
});

// Helpers
function daysInMonth(year, month1to12){
  return new Date(year, month1to12, 0).getDate();
}
function parseYM(ymStr){
  const [y,m] = ymStr.split("-").map(Number);
  return { year:y, month:m };
}
function num(v){ return Number(v || 0); }

// ✅ mostra erro só se allowed=true
function setErr(input, el, msg, allowed){
  if (!input || !el) return;
  const show = allowed && !!msg;

  el.textContent = show ? msg : "";
  input.classList.toggle("invalid", show);
}

// ✅ limpar tudo no load/mudança de mês
function clearAllErrors(){
  if (descErr) descErr.textContent = "";
  if (valorErr) valorErr.textContent = "";
  if (dueErr) dueErr.textContent = "";
  descInput?.classList.remove("invalid");
  valorInput?.classList.remove("invalid");
  dueDayInput?.classList.remove("invalid");
}

function validateDesc(show){
  const v = (descInput?.value || "").trim();
  const msg = !v ? "Informe a descrição." : "";
  setErr(descInput, descErr, msg, show);
  return !msg;
}

function validateValor(show){
  const v = num(valorInput?.value);
  const msg = (!v || v <= 0) ? "Informe um valor maior que 0." : "";
  setErr(valorInput, valorErr, msg, show);
  return !msg;
}

function validateDueDay(show){
  const { year, month: m } = parseYM(getSelectedMonth());
  const max = daysInMonth(year, m);
  if (dueDayInput) dueDayInput.max = String(max);

  const day = num(dueDayInput?.value);
  let msg = "";

  if (!day) msg = "Informe o dia do vencimento.";
  else if (day < 1 || day > max) msg = `Dia inválido. Use 1 a ${max}.`;

  setErr(dueDayInput, dueErr, msg, show);
  return !msg;
}

// showErrors = true -> pinta e mostra msg
// showErrors = false -> só calcula se está ok, sem pintar
function validateAll(showErrors){
  const okDesc  = validateDesc(showErrors && (triedSubmit || touched.desc));
  const okValor = validateValor(showErrors && (triedSubmit || touched.valor));
  const okDue   = validateDueDay(showErrors && (triedSubmit || touched.due));

  const ok = okDesc && okValor && okDue;
  if (addBtn) addBtn.disabled = !ok;
  return ok;
}

// Eventos: marca touched no blur (quando o usuário “mexeu”)
descInput?.addEventListener("blur", ()=>{
  touched.desc = true;
  validateAll(true);
});
valorInput?.addEventListener("blur", ()=>{
  touched.valor = true;
  validateAll(true);
});
dueDayInput?.addEventListener("blur", ()=>{
  touched.due = true;
  validateAll(true);
});

// Enquanto digita: só recalcula botão (sem pintar agressivo)
descInput?.addEventListener("input", ()=> validateAll(false));
valorInput?.addEventListener("input", ()=> validateAll(false));
dueDayInput?.addEventListener("input", ()=> validateAll(false));

function render(){
  const hasItems = (month.fixed || []).length > 0;

  if (emptyBox) emptyBox.style.display = hasItems ? "none" : "flex";
  if (tableEl) tableEl.style.display = hasItems ? "table" : "none";

  tbody.innerHTML = (month.fixed || []).map(item => `
    <tr>
      <td>${item.name}</td>
      <td>Dia ${item.dueDay}</td>
      <td class="right">${formatBRL(item.value)}</td>
      <td style="text-align:center;">
        <input type="checkbox" ${item.paid ? "checked":""} data-id="${item.id}" class="paid"/>
      </td>
      <td class="right">
        <button data-id="${item.id}" class="del">Excluir</button>
      </td>
    </tr>
  `).join("");

  const total = (month.fixed || []).reduce((a,b)=> a + Number(b.value||0), 0);
  if (summary) summary.innerHTML = `📅 ${ymToLabel(ym)} • Total fixas: <b>${formatBRL(total)}</b>`;

  tbody.querySelectorAll(".paid").forEach(chk=>{
    chk.addEventListener("change", ()=>{
      const id = chk.dataset.id;
      const it = month.fixed.find(x=> x.id === id);
      if (it){
        it.paid = chk.checked;
        saveState(state);
      }
    });
  });

  tbody.querySelectorAll(".del").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.id;
      month.fixed = month.fixed.filter(x=> x.id !== id);
      saveState(state);
      render();
      validateAll(false);
    });
  });
}

// Adicionar
addBtn?.addEventListener("click", ()=>{
  triedSubmit = true;        // ✅ agora sim pode mostrar erros
  touched.desc = touched.valor = touched.due = true;

  if (!validateAll(true)) return;

  const name = (descInput.value || "").trim();
  const value = num(valorInput.value);
  const dueDay = num(dueDayInput.value);

  month.fixed.push({ id: uid(), name, value, dueDay, paid:false });
  saveState(state);

  descInput.value = "";
  valorInput.value = "";
  dueDayInput.value = "";

  // reseta flags pós-sucesso (pra não ficar vermelho de novo vazio)
  triedSubmit = false;
  touched.desc = touched.valor = touched.due = false;

  clearAllErrors();
  validateAll(false);
  render();
});

// Init (✅ não pinta nada)
clearAllErrors();
validateAll(false);
render();
