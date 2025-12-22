import { initHeader, getSelectedMonth } from "./ui.js";
import { loadState, saveState, ensureMonth, uid, formatBRL, ymToLabel } from "./storage.js";

initHeader("fixas");

// Estado do mês selecionado
let ym = getSelectedMonth();
const state = loadState();
let month = ensureMonth(state, ym);
saveState(state);

// Elementos do HTML (AGORA batem com seus IDs)
const monthSelect = document.getElementById("monthSelect");

const descInput = document.getElementById("descFixa");
const valueInput = document.getElementById("valorFixa");
const dueDayInput = document.getElementById("dueDay");

const dueDayError = document.getElementById("dueDayError");
const addFixedBtn = document.getElementById("addFixedBtn");

// --- helpers ---
function daysInMonth(year, month1to12){
  return new Date(year, month1to12, 0).getDate();
}

function parseMonthSelect(value){
  const [y, m] = value.split("-").map(Number);
  return { year: y, month: m };
}

function validateDueDay(){
  const { year, month } = parseMonthSelect(getSelectedMonth());
  const maxDay = daysInMonth(year, month);

  // Ajusta o max do input conforme o mês
  dueDayInput.max = String(maxDay);

  const day = Number(dueDayInput.value);

  // se estiver vazio, não deixa adicionar (mas não mostra erro agressivo)
  if (!day) {
    dueDayError.textContent = "";
    dueDayInput.classList.remove("invalid");
    addFixedBtn.disabled = true;
    return false;
  }

  if (day < 1 || day > maxDay) {
    dueDayError.textContent = `Dia inválido para este mês. Use 1 a ${maxDay}.`;
    dueDayInput.classList.add("invalid");
    addFixedBtn.disabled = true;
    return false;
  }

  dueDayError.textContent = "";
  dueDayInput.classList.remove("invalid");
  addFixedBtn.disabled = false;
  return true;
}

function render(){
  const tbody = document.querySelector("#table tbody");

  tbody.innerHTML = month.fixed.map(item => `
    <tr>
      <td>${item.name}</td>
      <td>Dia ${item.dueDay}</td>
      <td class="right">${formatBRL(item.value)}</td>
      <td>
        <input type="checkbox" ${item.paid ? "checked" : ""} data-id="${item.id}" class="paid" />
      </td>
      <td class="right">
        <button data-id="${item.id}" class="del">Excluir</button>
      </td>
    </tr>
  `).join("");

  const total = month.fixed.reduce((acc, x) => acc + Number(x.value || 0), 0);

  document.querySelector("#summary").innerHTML =
    `📅 ${ymToLabel(ym)} • Total fixas: <b>${formatBRL(total)}</b>`;

  // eventos do checkbox pago
  tbody.querySelectorAll(".paid").forEach(chk => {
    chk.addEventListener("change", () => {
      const id = chk.dataset.id;
      const it = month.fixed.find(x => x.id === id);
      if (it) {
        it.paid = chk.checked;
        saveState(state);
      }
    });
  });

  // eventos do botão excluir
  tbody.querySelectorAll(".del").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      month.fixed = month.fixed.filter(x => x.id !== id);
      saveState(state);
      render();
    });
  });
}

// --- eventos ---
monthSelect.addEventListener("change", () => {
  ym = getSelectedMonth();
  month = ensureMonth(state, ym);
  saveState(state);
  render();
  validateDueDay();
});

dueDayInput.addEventListener("input", validateDueDay);

// opcional: validar também quando mexer no valor/descrição (pra manter botão consistente)
descInput.addEventListener("input", validateDueDay);
valueInput.addEventListener("input", validateDueDay);

const copyPrevBtn = document.getElementById("copyPrevFixed");

function prevMonth(ym){
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1); // mês anterior
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

copyPrevBtn?.addEventListener("click", ()=>{
  const prev = prevMonth(ym);
  const prevMonthData = ensureMonth(state, prev);

  if ((month.fixed || []).length > 0) {
    alert("Este mês já tem fixas. Apague ou ajuste manualmente.");
    return;
  }

  month.fixed = (prevMonthData.fixed || []).map(x => ({
    ...x,
    id: uid(),
    paid: false // novo mês começa como não pago
  }));

  saveState(state);
  render();
});


addFixedBtn.addEventListener("click", () => {
  // valida dia do mês
  if (!validateDueDay()) return;

  const name = descInput.value.trim();
  const value = Number(valueInput.value);
  const dueDay = Number(dueDayInput.value);

  if (!name || !value || !dueDay) return;

  month.fixed.push({
    id: uid(),
    name,
    value,
    dueDay,
    paid: false
  });

  saveState(state);

  // limpar inputs
  descInput.value = "";
  valueInput.value = "";
  dueDayInput.value = "";

  // desabilita de novo até preencher
  validateDueDay();
  render();
});

// inicial
validateDueDay();
render();
