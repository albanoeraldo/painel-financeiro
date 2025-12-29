import { initHeader, getSelectedMonth } from "./ui.js";
import { loadState, saveState, ensureMonth, uid, formatBRL, ymToLabel } from "./storage.js";
import { createValidator } from "./validate.js";

await initHeader("metas");

import { requireAuth } from "./ui.js";
await requireAuth();

import { pullStateFromCloud } from "./cloudState.js";
import { saveState } from "./storage.js";

await requireAuth();

const cloud = await pullStateFromCloud();
if(cloud){
  // joga no localStorage usando o seu saveState
  saveState(cloud);
}

// Estado e mês (let pq muda ao trocar mês)
let ym = getSelectedMonth();
const state = loadState();
let month = ensureMonth(state, ym);

// Garante estrutura
month.goals = Array.isArray(month.goals) ? month.goals : [];
saveState(state);

// Elements
const monthSelect = document.getElementById("monthSelect");

const nameInput = document.getElementById("name");
const targetInput = document.getElementById("target");
const savedInput = document.getElementById("saved");
const addBtn = document.getElementById("add");

const nameErr = document.getElementById("nameError");
const targetErr = document.getElementById("targetError");
const savedErr = document.getElementById("savedError");

const tbody = document.querySelector("#table tbody");
const totalEl = document.getElementById("total");

// Validator (mesmo padrão do fixas/cartão)
const v = createValidator({ showOn: "submit" });

function validateAll() {
  return v.validateAll(
    [
      () => v.required(nameInput, nameErr, "Informe a meta."),
      () => v.numberMin(targetInput, targetErr, 0.01, "Informe um custo total maior que 0."),
      // saved é opcional, mas se preencher tem que ser >= 0
      () => {
        const val = (savedInput?.value || "").trim();
        if (!val) {
          v.setShowMsg(false); // garante que não force erro
          // limpa (sem vermelho)
          savedInput?.classList.remove("invalid");
          if (savedErr) savedErr.textContent = "";
          return true;
        }
        // ativa validação só desse campo quando showMsg estiver on
        return v.numberMin(savedInput, savedErr, 0, "Guardado não pode ser negativo.");
      },
    ],
    addBtn
  );
}

function render() {
  month.goals = Array.isArray(month.goals) ? month.goals : [];

  tbody.innerHTML = (month.goals || [])
    .map(
      (g) => `
      <tr>
        <td>${g.name}</td>
        <td class="right">${formatBRL(g.target)}</td>
        <td class="right">${formatBRL(g.saved || 0)}</td>
        <td class="right"><button class="del" data-id="${g.id}">Excluir</button></td>
      </tr>
    `
    )
    .join("");

  const totalSaved = (month.goals || []).reduce((a, b) => a + Number(b.saved || 0), 0);
  totalEl.innerHTML = `📅 ${ymToLabel(ym)} • Total guardado em metas neste mês: <b>${formatBRL(totalSaved)}</b>`;

  tbody.querySelectorAll(".del").forEach((btn) => {
    btn.addEventListener("click", () => {
      month.goals = (month.goals || []).filter((x) => x.id !== btn.dataset.id);
      saveState(state);
      render();
    });
  });
}

// Troca de mês
monthSelect?.addEventListener("change", () => {
  ym = getSelectedMonth();
  month = ensureMonth(state, ym);
  month.goals = Array.isArray(month.goals) ? month.goals : [];
  saveState(state);

  // limpa form
  nameInput.value = "";
  targetInput.value = "";
  savedInput.value = "";

  // volta ao modo “sem mensagem”
  v.setShowMsg(false);
  validateAll();

  render();
});

// Eventos de validação ao digitar (só para habilitar/desabilitar botão, sem “vermelho”)
[nameInput, targetInput, savedInput].forEach((el) => {
  el?.addEventListener("input", () => {
    v.setShowMsg(false);
    validateAll();
  });
});

// Adicionar
addBtn?.addEventListener("click", () => {
  v.setShowMsg(true);
  if (!validateAll()) return;

  const name = nameInput.value.trim();
  const target = Number(targetInput.value || 0);
  const saved = Number(savedInput.value || 0);

  month.goals.push({ id: uid(), name, target, saved: saved || 0 });
  saveState(state);

  nameInput.value = "";
  targetInput.value = "";
  savedInput.value = "";

  v.setShowMsg(false);
  validateAll();
  render();
});

// Init
v.setShowMsg(false);
validateAll();
render();
