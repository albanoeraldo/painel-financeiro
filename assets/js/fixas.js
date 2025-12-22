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

const descErr = document.getElementById("descFixaError");   // opcional
const valorErr = document.getElementById("valorFixaError"); // opcional
const dueErr = document.getElementById("dueDayError");      // obrigatório pra ver msg

const addBtn = document.getElementById("addFixedBtn");
const tbody = document.querySelector("#table tbody");
const summary = document.getElementById("summary");

const emptyBox = document.getElementById("fixedEmpty");
const tableEl = document.getElementById("table");

const focusAddBtn = document.getElementById("focusAddFixed");
focusAddBtn?.addEventListener("click", () => descInput?.focus());

// ====== controle de "touched" (pra não mostrar erro ao abrir) ======
let touched = {
  desc: false,
  valor: false,
  due: false,
};

// Troca de mês
monthSelect?.addEventListener("change", () => {
  ym = getSelectedMonth();
  month = ensureMonth(state, ym);
  month.fixed = Array.isArray(month.fixed) ? month.fixed : [];
  saveState(state);

  // ao trocar mês, não precisa “gritar” erro
  touched = { desc: false, valor: false, due: false };

  validateAll(false);
  render();
});

// Helpers
function daysInMonth(year, month1to12) {
  return new Date(year, month1to12, 0).getDate();
}

function parseYM(ymStr) {
  const [y, m] = ymStr.split("-").map(Number);
  return { year: y, month: m };
}

function setErr(input, el, msg, show) {
  // se não tem elemento de erro no HTML, só marca inválido e pronto
  if (input) input.classList.toggle("invalid", !!msg && show);
  if (el) el.textContent = show ? (msg || "") : "";
}

function num(v) {
  return Number(v || 0);
}

// ====== Validações (com showMsg controlado) ======
function validateDesc(showMsg = touched.desc) {
  const v = (descInput?.value || "").trim();
  if (!v) {
    setErr(descInput, descErr, "Informe a descrição.", showMsg);
    return false;
  }
  setErr(descInput, descErr, "", showMsg);
  return true;
}

function validateValor(showMsg = touched.valor) {
  const v = num(valorInput?.value);
  if (!v || v <= 0) {
    setErr(valorInput, valorErr, "Informe um valor maior que 0.", showMsg);
    return false;
  }
  setErr(valorInput, valorErr, "", showMsg);
  return true;
}

function validateDueDay(showMsg = touched.due) {
  const { year, month: m } = parseYM(getSelectedMonth());
  const max = daysInMonth(year, m);

  if (dueDayInput) dueDayInput.max = String(max);

  const day = num(dueDayInput?.value);

  if (!day) {
    setErr(dueDayInput, dueErr, "Informe o dia do vencimento.", showMsg);
    return false;
  }
  if (day < 1 || day > max) {
    setErr(dueDayInput, dueErr, `Dia inválido. Use 1 a ${max}.`, showMsg);
    return false;
  }

  setErr(dueDayInput, dueErr, "", showMsg);
  return true;
}

function validateAll(showMsgs = false) {
  // showMsgs=true => força mostrar mensagens (ex.: ao clicar em Adicionar)
  const okDesc = validateDesc(showMsgs ? true : touched.desc);
  const okValor = validateValor(showMsgs ? true : touched.valor);
  const okDue = validateDueDay(showMsgs ? true : touched.due);

  const ok = okDesc && okValor && okDue;

  if (addBtn) addBtn.disabled = !ok;
  return ok;
}

// Eventos de validação ao digitar (marca touched)
descInput?.addEventListener("input", () => {
  touched.desc = true;
  validateAll(false);
});

valorInput?.addEventListener("input", () => {
  touched.valor = true;
  validateAll(false);
});

dueDayInput?.addEventListener("input", () => {
  touched.due = true;
  validateAll(false);
});

// blur também conta como touched (bom pra mostrar msg ao sair do campo)
descInput?.addEventListener("blur", () => {
  touched.desc = true;
  validateAll(false);
});

valorInput?.addEventListener("blur", () => {
  touched.valor = true;
  validateAll(false);
});

dueDayInput?.addEventListener("blur", () => {
  touched.due = true;
  validateAll(false);
});

function render() {
  const list = month.fixed || [];
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
  }

  // Resumo
  const total = list.reduce((a, b) => a + Number(b.value || 0), 0);
  if (summary) {
    summary.innerHTML = `📅 ${ymToLabel(ym)} • Total fixas: <b>${formatBRL(total)}</b>`;
  }

  // Eventos checkbox pago
  tbody?.querySelectorAll(".paid").forEach((chk) => {
    chk.addEventListener("change", () => {
      const id = chk.dataset.id;
      const it = month.fixed.find((x) => x.id === id);
      if (it) {
        it.paid = chk.checked;
        saveState(state);
      }
    });
  });

  // Eventos excluir
  tbody?.querySelectorAll(".del").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      month.fixed = (month.fixed || []).filter((x) => x.id !== id);
      saveState(state);
      render();
      validateAll(false);
    });
  });
}

// Adicionar
addBtn?.addEventListener("click", () => {
  // força mostrar mensagens ao clicar
  touched.desc = true;
  touched.valor = true;
  touched.due = true;

  if (!validateAll(true)) return;

  const name = (descInput.value || "").trim();
  const value = num(valorInput.value);
  const dueDay = num(dueDayInput.value);

  month.fixed.push({ id: uid(), name, value, dueDay, paid: false });
  saveState(state);

  // limpa
  descInput.value = "";
  valorInput.value = "";
  dueDayInput.value = "";

  // volta touched pra false (não mostrar erro logo após limpar)
  touched = { desc: false, valor: false, due: false };

  validateAll(false);
  render();
});

// Init
validateAll(false); // não mostra mensagens ao abrir
render();
