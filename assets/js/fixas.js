import { initHeader, getSelectedMonth } from "./ui.js";
import { loadState, saveState, ensureMonth, uid, formatBRL, ymToLabel } from "./storage.js";
import { createValidator } from "./validate.js";

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

const copyPrevFixedBtn = document.getElementById("copyPrevFixed");

// Helpers
function daysInMonth(year, month1to12) {
  return new Date(year, month1to12, 0).getDate();
}
function parseYM(ymStr) {
  const [y, m] = ymStr.split("-").map(Number);
  return { year: y, month: m };
}
function num(v) {
  return Number(v || 0);
}

// ✅ Validador reutilizável (showMsg controlado)
const v = createValidator({ showOn: "submit" });

const rules = [
  () => v.required(descInput, descErr, "Informe a descrição."),
  () => v.numberMin(valorInput, valorErr, 0.01, "Informe um valor maior que 0."),
  () => {
    const { year, month: m } = parseYM(getSelectedMonth());
    const max = daysInMonth(year, m);
    if (dueDayInput) dueDayInput.max = String(max);
    return v.numberRange(dueDayInput, dueErr, 1, max, `Dia inválido. Use 1 a ${max}.`);
  },
];

function validateUI() {
  return v.validateAll(rules, addBtn);
}

// valida enquanto digita (mas sem mostrar msg até clicar no botão)
descInput?.addEventListener("input", validateUI);
valorInput?.addEventListener("input", validateUI);
dueDayInput?.addEventListener("input", validateUI);

// Troca de mês
monthSelect?.addEventListener("change", () => {
  ym = getSelectedMonth();
  month = ensureMonth(state, ym);
  month.fixed = Array.isArray(month.fixed) ? month.fixed : [];
  saveState(state);

  // reset do “mostrar mensagens”
  v.setShowMsg(false);
  validateUI();
  render();
});

function render() {
  const list = month.fixed || [];

  // Estado vazio
  const hasItems = list.length > 0;
  if (emptyBox) emptyBox.style.display = hasItems ? "none" : "flex";
  if (tableEl) tableEl.style.display = hasItems ? "table" : "none";

  // Tabela
  if (tbody) {
    tbody.innerHTML = list
      .map(
        (item) => `
      <tr>
        <td>${item.name}</td>
        <td>Dia ${item.dueDay}</td>
        <td class="right">${formatBRL(item.value)}</td>
        <td style="text-align:center;">
          <input type="checkbox" ${item.paid ? "checked" : ""} data-id="${item.id}" class="paid"/>
        </td>
        <td class="right">
          <button data-id="${item.id}" class="del">Excluir</button>
        </td>
      </tr>
    `
      )
      .join("");

    // eventos: pago
    tbody.querySelectorAll(".paid").forEach((chk) => {
      chk.addEventListener("change", () => {
        const id = chk.dataset.id;
        const it = month.fixed.find((x) => x.id === id);
        if (it) {
          it.paid = chk.checked;
          saveState(state);
        }
      });
    });

    // eventos: excluir
    tbody.querySelectorAll(".del").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        month.fixed = month.fixed.filter((x) => x.id !== id);
        saveState(state);
        render();
        validateUI();
      });
    });
  }

  // Resumo
  const total = list.reduce((a, b) => a + Number(b.value || 0), 0);
  if (summary) {
    summary.innerHTML = `📅 ${ymToLabel(ym)} • Total fixas: <b>${formatBRL(total)}</b>`;
  }
}

// Adicionar
addBtn?.addEventListener("click", () => {
  // agora sim mostra as mensagens e valida “pra valer”
  v.setShowMsg(true);
  if (!validateUI()) return;

  const name = (descInput.value || "").trim();
  const value = num(valorInput.value);
  const dueDay = num(dueDayInput.value);

  month.fixed.push({ id: uid(), name, value, dueDay, paid: false });
  saveState(state);

  // limpa
  descInput.value = "";
  valorInput.value = "";
  dueDayInput.value = "";

  // volta a esconder msgs até próxima tentativa
  v.setShowMsg(false);
  validateUI();
  render();
});

// Copiar fixas do mês anterior (se tiver o botão no HTML)
copyPrevFixedBtn?.addEventListener("click", () => {
  // pega mês anterior
  const { year, month: m } = parseYM(ym);
  const prev = new Date(year, m - 2, 1); // m-1 é o atual, m-2 é o anterior
  const prevYM = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;

  const prevMonth = state.months?.[prevYM];
  const prevFixed = Array.isArray(prevMonth?.fixed) ? prevMonth.fixed : [];

  if (prevFixed.length === 0) return;

  // evita duplicar por name+value+dueDay
  const exists = new Set((month.fixed || []).map((x) => `${x.name}|${x.value}|${x.dueDay}`));

  prevFixed.forEach((x) => {
    const key = `${x.name}|${x.value}|${x.dueDay}`;
    if (!exists.has(key)) {
      month.fixed.push({
        id: uid(),
        name: x.name,
        value: Number(x.value || 0),
        dueDay: Number(x.dueDay || 1),
        paid: false,
      });
      exists.add(key);
    }
  });

  saveState(state);
  render();
});

// Init
v.setShowMsg(false);
validateUI();
render();
