import { initHeader, getSelectedMonth } from "./ui.js";
import { loadState, saveState, ensureMonth, uid, formatBRL } from "./storage.js";

initHeader("metas");

const ym = getSelectedMonth();
const state = loadState();
const month = ensureMonth(state, ym);
saveState(state);

function render(){
  const tbody = document.querySelector("#table tbody");
  tbody.innerHTML = month.goals.map(g=>`
    <tr>
      <td>${g.name}</td>
      <td class="right">${formatBRL(g.target)}</td>
      <td class="right">${formatBRL(g.saved)}</td>
      <td class="right"><button class="del" data-id="${g.id}">Excluir</button></td>
    </tr>
  `).join("");

  const totalSaved = month.goals.reduce((a,b)=> a + Number(b.saved||0), 0);
  document.querySelector("#total").innerHTML = `Total guardado em metas neste mês: <b>${formatBRL(totalSaved)}</b>`;

  tbody.querySelectorAll(".del").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      month.goals = month.goals.filter(x=> x.id !== btn.dataset.id);
      saveState(state);
      render();
    });
  });
}

document.querySelector("#add").addEventListener("click", ()=>{
  const name = document.querySelector("#name").value.trim();
  const target = Number(document.querySelector("#target").value);
  const saved = Number(document.querySelector("#saved").value);

  if(!name || !target) return;

  month.goals.push({ id: uid(), name, target, saved: saved || 0 });
  saveState(state);

  document.querySelector("#name").value = "";
  document.querySelector("#target").value = "";
  document.querySelector("#saved").value = "";

  render();
});

render();
