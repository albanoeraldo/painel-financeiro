import { initHeader, getSelectedMonth } from "./ui.js";
import { loadState, saveState, ensureMonth, uid, formatBRL, ymToLabel } from "./storage.js";

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
