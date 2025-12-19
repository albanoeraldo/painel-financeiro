import { initHeader, getSelectedMonth } from "./ui.js";
import { loadState, saveState, ensureMonth, uid, formatBRL, ymToLabel } from "./storage.js";

const monthSelect = document.getElementById("monthSelect");
const dueDayInput = document.getElementById("dueDay");
const dueDayError = document.getElementById("dueDayError");
const addFixedBtn  = document.getElementById("addFixedBtn");

monthSelect.addEventListener("change", validateDueDay);
dueDayInput.addEventListener("input", validateDueDay);
validateDueDay(); // já inicia desativado se estiver vazio

initHeader("fixas");

const ym = getSelectedMonth();
const state = loadState();
const month = ensureMonth(state, ym);
saveState(state);

function render(){
  const tbody = document.querySelector("#table tbody");
  tbody.innerHTML = month.fixed.map(item=> `
    <tr>
      <td>${item.name}</td>
      <td>Dia ${item.dueDay}</td>
      <td class="right">${formatBRL(item.value)}</td>
      <td>
        <input type="checkbox" ${item.paid ? "checked":""} data-id="${item.id}" class="paid"/>
      </td>
      <td class="right">
        <button data-id="${item.id}" class="del">Excluir</button>
      </td>
    </tr>
  `).join("");

  const total = month.fixed.reduce((a,b)=> a + Number(b.value||0), 0);
  document.querySelector("#summary").innerHTML = `📅 ${ymToLabel(ym)} • Total fixas: <b>${formatBRL(total)}</b>`;

  tbody.querySelectorAll(".paid").forEach(chk=>{
    chk.addEventListener("change", ()=>{
      const id = chk.dataset.id;
      const it = month.fixed.find(x=> x.id===id);
      if(it){ it.paid = chk.checked; saveState(state); }
    });
  });

    tbody.querySelectorAll(".del").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.dataset.id;
        month.fixed = month.fixed.filter(x=> x.id !== id);
        saveState(state);
        render();
      });
  });
}

document.querySelector("#add").addEventListener("click", ()=>{
  const name = document.querySelector("#name").value.trim();
  const value = Number(document.querySelector("#value").value);
  const dueDay = Number(document.querySelector("#due").value);

  if(!name || !value || !dueDay) return;

  month.fixed.push({ id: uid(), name, value, dueDay, paid:false });
  saveState(state);

  document.querySelector("#name").value = "";
  document.querySelector("#value").value = "";
  document.querySelector("#due").value = "";

  render();
});

render();

function daysInMonth(year, month1to12){
  return new Date(year, month1to12, 0).getDate();
}

// Se seu select usa value tipo "2025-12"
function parseMonthSelect(value){
  const [y, m] = value.split("-").map(Number);
  return { year: y, month: m };
}

function validateDueDay(){
  const {year, month} = parseMonthSelect(monthSelect.value);
  const maxDay = daysInMonth(year, month);

  dueDayInput.max = String(maxDay);

  const day = Number(dueDayInput.value);

  if (!day) {
    dueDayError.textContent = "";
    dueDayInput.classList.remove("invalid");
    addFixedBtn.disabled = true;
    return false;
  }

  if (day < 1 || day > maxDay){
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

