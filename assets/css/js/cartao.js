import { initHeader, getSelectedMonth } from "./ui.js";
import { loadState, saveState, ensureMonth, uid, formatBRL, endMonth, ymToLabel } from "./storage.js";

initHeader("cartao");

const ym = getSelectedMonth();
const state = loadState();
const month = ensureMonth(state, ym);
saveState(state);

function calcRemaining(item){
  // cálculo simples com base no mês atual
  // meses passados desde startYm até ym
  const [sy, sm] = item.startYm.split("-").map(Number);
  const [cy, cm] = ym.split("-").map(Number);
  const passed = (cy - sy) * 12 + (cm - sm); // 0 = mês de início
  const paid = Math.max(0, Math.min(item.totalParts, passed + 1)); // parcelas já "chegaram"
  const remaining = Math.max(0, item.totalParts - paid);
  return remaining;
}

function render(){
  const tbody = document.querySelector("#table tbody");

  tbody.innerHTML = month.card.map(item=>{
    const end = endMonth(item.startYm, item.totalParts);
    const remaining = calcRemaining(item);
    return `
      <tr>
        <td>${item.name}</td>
        <td class="right">${formatBRL(item.monthValue)}</td>
        <td>${ymToLabel(item.startYm)}</td>
        <td>${ymToLabel(end)}</td>
        <td>${remaining}</td>
        <td class="right"><button class="del" data-id="${item.id}">Excluir</button></td>
      </tr>
    `;
  }).join("");

  const total = month.card.reduce((a,b)=> a + Number(b.monthValue||0), 0);
  document.querySelector("#total").innerHTML = `Total do cartão neste mês: <b>${formatBRL(total)}</b>`;

  tbody.querySelectorAll(".del").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      month.card = month.card.filter(x=> x.id !== btn.dataset.id);
      saveState(state);
      render();
    });
  });
}

document.querySelector("#add").addEventListener("click", ()=>{
  const name = document.querySelector("#name").value.trim();
  const monthValue = Number(document.querySelector("#monthValue").value);
  const totalParts = Number(document.querySelector("#totalParts").value);
  const startYm = document.querySelector("#startYm").value;

  if(!name || !monthValue || !totalParts || !startYm) return;

  month.card.push({ id: uid(), name, monthValue, totalParts, startYm });
  saveState(state);

  document.querySelector("#name").value = "";
  document.querySelector("#monthValue").value = "";
  document.querySelector("#totalParts").value = "";
  document.querySelector("#startYm").value = "";

  render();
});

render();
