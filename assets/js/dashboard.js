import { initHeader, renderUserName, getSelectedMonth } from "./ui.js";

import {
  loadState,
  saveState,
  ensureMonth,
  uid,
  formatBRL,
  ymToLabel,
  escapeHTML,
  parseMoneyInput,
} from "./storage.js";

import { createValidator } from "./validate.js";

import {
  calcMonthTotals,
  fixedTotals,
  cardRecurringTotal,
  totalsByCategoryExpenses,
  catLabel,
  buildClosureSnapshot,
  formatDateTimeBR,
} from "./finance.js";

/* =========================
   Boot
========================= */
await initHeader("dashboard", { syncCloud: true });
await renderUserName();

let ym = getSelectedMonth();
const state = loadState();

state.closedMonths =
  state.closedMonths && typeof state.closedMonths === "object"
    ? state.closedMonths
    : {};

const monthAlreadyExists = !!state.months?.[ym];
let month = ensureMonth(state, ym);

if (!monthAlreadyExists) {
  saveState(state);
}

/* =========================
   Elementos da tela
========================= */
const monthLabelEl = document.querySelector("#monthLabel");

const incomeBaseInput = document.getElementById("incomeBase");
const incomeBaseErr = document.getElementById("incomeBaseError");
const saveIncomeBaseBtn = document.getElementById("saveIncomeBase");
const clearSalaryBtn = document.getElementById("clearSalary");

const extraNameInput = document.getElementById("incomeExtraName");
const extraNameErr = document.getElementById("incomeExtraNameError");
const extraValueInput = document.getElementById("incomeExtraValue");
const extraValueErr = document.getElementById("incomeExtraValueError");
const addExtraBtn = document.getElementById("addIncomeExtra");
const extraTbody = document.querySelector("#incomeExtraTable tbody");

const closeMonthBtn = document.getElementById("closeMonthBtn");
const reopenMonthBtn = document.getElementById("reopenMonthBtn");
const monthClosedBox = document.getElementById("monthClosedBox");
const monthClosedSummary = document.getElementById("monthClosedSummary");

const appConfirmModal = document.getElementById("appConfirmModal");
const appConfirmTitle = document.getElementById("appConfirmTitle");
const appConfirmText = document.getElementById("appConfirmText");
const appConfirmOk = document.getElementById("appConfirmOk");
const appConfirmCancel = document.getElementById("appConfirmCancel");

const v = createValidator({ showOn: "submit" });

/* =========================
   Modal de confirmação
========================= */
function openConfirmModal({
  title = "Confirmar ação",
  message = "Tem certeza?",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
} = {}) {
  return new Promise((resolve) => {
    if (
      !appConfirmModal ||
      !appConfirmTitle ||
      !appConfirmText ||
      !appConfirmOk ||
      !appConfirmCancel
    ) {
      resolve(false);
      return;
    }

    appConfirmTitle.textContent = title;
    appConfirmText.textContent = message;
    appConfirmOk.textContent = confirmText;
    appConfirmCancel.textContent = cancelText;

    appConfirmModal.classList.add("is-open");
    appConfirmModal.setAttribute("aria-hidden", "false");

    function close(result) {
      appConfirmModal.classList.remove("is-open");
      appConfirmModal.setAttribute("aria-hidden", "true");

      appConfirmOk.removeEventListener("click", onOk);
      appConfirmCancel.removeEventListener("click", onCancel);
      appConfirmModal.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKeyDown);

      resolve(result);
    }

    function onOk() {
      close(true);
    }

    function onCancel() {
      close(false);
    }

    function onBackdrop(event) {
      if (event.target.hasAttribute("data-close-modal")) {
        close(false);
      }
    }

    function onKeyDown(event) {
      if (event.key === "Escape") close(false);
      if (event.key === "Enter") close(true);
    }

    appConfirmOk.addEventListener("click", onOk);
    appConfirmCancel.addEventListener("click", onCancel);
    appConfirmModal.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKeyDown);
  });
}

/* =========================
   Helpers de UI
========================= */
function clearErr(input, errEl) {
  if (input) input.classList.remove("invalid");
  if (errEl) errEl.textContent = "";
}

function getMonthClosure(selectedYm = ym) {
  return state.closedMonths?.[selectedYm] || null;
}

/* =========================
   Fechamento do mês
========================= */
function renderMonthClosure() {
  if (!monthClosedBox || !monthClosedSummary || !closeMonthBtn || !reopenMonthBtn) {
    return;
  }

  const closure = getMonthClosure(ym);

  if (!closure) {
    monthClosedBox.style.display = "none";
    closeMonthBtn.style.display = "inline-flex";
    reopenMonthBtn.style.display = "none";
    return;
  }

  const plannedBalance = Number(closure.plannedBalance ?? closure.saldoFinal ?? 0);
  const realizedBalance = Number(closure.realizedBalance ?? closure.saldoFinal ?? 0);
  const plannedExpenses = Number(closure.plannedExpenses ?? closure.expensesClosed ?? 0);
  const realizedExpenses = Number(closure.realizedExpenses ?? closure.expensesClosed ?? 0);

  const fixedTotal = Number(closure.fixedTotal || 0);
  const fixedPaid = Number(closure.fixedPaid || 0);
  const fixedPending = Number(closure.fixedPending || Math.max(fixedTotal - fixedPaid, 0));

  const statusIsPositive = plannedBalance >= 0;
  const statusClass = statusIsPositive ? "ok" : "bad";
  const statusText = statusIsPositive ? "✅ Fechado positivo" : "❌ Fechado negativo";
  const saldoClass = statusIsPositive ? "positive" : "negative";

  monthClosedBox.style.display = "block";
  closeMonthBtn.style.display = "none";
  reopenMonthBtn.style.display = "inline-flex";

  monthClosedSummary.innerHTML = `
    <div class="month-close-meta">
      <span class="badge ${statusClass}">${statusText}</span>
      <span class="badge">📌 Mês: <b>${ymToLabel(closure.month)}</b></span>
    </div>

    <div class="closure-grid">
      <div class="closure-item">
        <div class="label">Renda do mês</div>
        <div class="value">${formatBRL(closure.income)}</div>
      </div>

      <div class="closure-item">
        <div class="label">Fixas total</div>
        <div class="value">${formatBRL(fixedTotal)}</div>
      </div>

      <div class="closure-item">
        <div class="label">Fixas pagas</div>
        <div class="value">${formatBRL(fixedPaid)}</div>
      </div>

      <div class="closure-item">
        <div class="label">Fixas pendentes</div>
        <div class="value">${formatBRL(fixedPending)}</div>
      </div>

      <div class="closure-item">
        <div class="label">Cartão</div>
        <div class="value">${formatBRL(closure.card)}</div>
      </div>

      <div class="closure-item">
        <div class="label">Metas</div>
        <div class="value">${formatBRL(closure.goals)}</div>
      </div>

      <div class="closure-item">
        <div class="label">Despesas planejadas</div>
        <div class="value">${formatBRL(plannedExpenses)}</div>
      </div>

      <div class="closure-item">
        <div class="label">Despesas realizadas</div>
        <div class="value">${formatBRL(realizedExpenses)}</div>
      </div>

      <div class="closure-item">
        <div class="label">Saldo planejado</div>
        <div class="value ${saldoClass}">${formatBRL(plannedBalance)}</div>
      </div>

      <div class="closure-item">
        <div class="label">Saldo realizado</div>
        <div class="value ${realizedBalance >= 0 ? "positive" : "negative"}">${formatBRL(realizedBalance)}</div>
      </div>
    </div>

    <div class="month-close-date">
      Fechado em: <b>${formatDateTimeBR(closure.closedAt)}</b>
    </div>
  `;
}

function closeCurrentMonth() {
  state.closedMonths[ym] = buildClosureSnapshot(ym, month);

  saveState(state);
  renderDashboard();
}

function reopenCurrentMonth() {
  if (state.closedMonths?.[ym]) {
    delete state.closedMonths[ym];
    saveState(state);
  }

  renderDashboard();
}

/* =========================
   Renders
========================= */
function renderKpis() {
  const totals = calcMonthTotals(month);
  const closure = getMonthClosure(ym);

  const kpis = [
    {
      label: "Renda do mês",
      value: formatBRL(totals.income),
    },
    {
      label: "Fixas pendentes",
      value: formatBRL(totals.fixedPending),
      helper: `Pagas: <b>${formatBRL(totals.fixedPaid)}</b> • Total fixas: <b>${formatBRL(totals.fixedTotal)}</b>`,
    },
    {
      label: "Cartão",
      value: formatBRL(totals.card),
      helper: `Parcelas: <b>${formatBRL(totals.cardParts)}</b> • Assinaturas: <b>${formatBRL(totals.cardRecurring)}</b>`,
    },
    {
      label: "Metas",
      value: formatBRL(totals.goals),
      helper: "Valor guardado no mês selecionado.",
    },
    {
      label: "Falta pagar",
      value: formatBRL(totals.pendingExpenses),
      helper: "Fixas pendentes + cartão + metas.",
    },
    {
      label: closure ? "Saldo planejado" : "Saldo",
      value: formatBRL(totals.plannedBalance),
      badge: totals.plannedBalance >= 0 ? "ok" : "bad",
      helper: closure
        ? `Fechamento salvo: <b>${formatBRL(closure.plannedBalance ?? closure.saldoFinal ?? 0)}</b>`
        : "Renda - todas as despesas planejadas.",
    },
    {
      label: "Saldo realizado",
      value: formatBRL(totals.realizedBalance),
      badge: totals.realizedBalance >= 0 ? "ok" : "bad",
      helper: "Renda - despesas realmente pagas/realizadas.",
    },
  ];

  const kpiEl = document.querySelector("#kpis");

  if (!kpiEl) return;

  kpiEl.innerHTML = kpis
    .map((kpi) => {
      const badgeClass = kpi.badge ? `badge ${kpi.badge}` : "badge";
      const badgeText = kpi.badge === "ok" ? "✅ Positivo" : "❌ Negativo";

      return `
        <div class="card kpi">
          <div class="label">${kpi.label}</div>
          <div class="value">${kpi.value}</div>

          ${
            kpi.badge
              ? `<div style="margin-top:10px;"><span class="${badgeClass}">${badgeText}</span></div>`
              : ""
          }

          ${
            kpi.helper
              ? `<div class="helper" style="margin-top:10px;">${kpi.helper}</div>`
              : ""
          }
        </div>
      `;
    })
    .join("");
}

function renderExtras() {
  if (!extraTbody) return;

  const extras = month.incomeExtra || [];

  if (!extras.length) {
    extraTbody.innerHTML = `
      <tr>
        <td colspan="3">
          <div class="empty">
            <div>
              <div class="title">Nenhuma renda extra cadastrada</div>
              <div class="desc">Adicione bônus, comissão, serviço extra ou outra entrada do mês.</div>
            </div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  extraTbody.innerHTML = extras
    .map(
      (item) => `
        <tr>
          <td>${escapeHTML(item.name)}</td>
          <td class="right">${formatBRL(item.value)}</td>
          <td class="right">
            <button class="del-extra" data-id="${escapeHTML(item.id)}">Excluir</button>
          </td>
        </tr>
      `
    )
    .join("");

  extraTbody.querySelectorAll(".del-extra").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;

      month.incomeExtra = (month.incomeExtra || []).filter((item) => item.id !== id);

      saveState(state);
      renderDashboard();
    });
  });
}

function ensureCategoriesCard() {
  let el = document.getElementById("categoriesSummary");

  if (el) return el;

  const container = document.querySelector(".container");

  if (!container) return null;

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h3 style="margin:0 0 10px;">Categorias do mês</h3>
    <div id="categoriesSummary"></div>
    <div class="helper" style="margin-top:8px;">
      Dica: esse resumo usa categorias das <b>Fixas pendentes</b> + <b>Cartão</b>.
    </div>
  `;

  container.appendChild(card);

  return document.getElementById("categoriesSummary");
}

function renderCategories() {
  const el = ensureCategoriesCard();

  if (!el) return;

  const { mapTotal, mapPending } = totalsByCategoryExpenses(month);

  const entries = Object.entries(mapTotal)
    .map(([key, total]) => {
      const pending = Number(mapPending[key] || 0);

      return {
        key,
        total: Number(total || 0),
        pending,
      };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);

  if (!entries.length) {
    el.innerHTML = `
      <div class="empty">
        <div>
          <div class="title">Sem dados por categoria</div>
          <div class="desc">Adicione Fixas ou Cartão com categoria para aparecer aqui.</div>
        </div>
      </div>
    `;
    return;
  }

  const max = Math.max(...entries.map((item) => item.total));

  el.innerHTML = entries
    .map((item) => {
      const pct = max > 0 ? (item.total / max) * 100 : 0;
      const pctPending = item.total > 0 ? (item.pending / item.total) * 100 : 0;

      return `
        <div style="margin:10px 0;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="font-weight:600;">${catLabel(item.key)}</div>

            <div class="right" style="white-space:nowrap;">
              <b>${formatBRL(item.total)}</b>
              ${
                item.pending > 0
                  ? `<span style="opacity:.7;"> • fixas pendentes ${formatBRL(item.pending)}</span>`
                  : ""
              }
            </div>
          </div>

          <div style="height:10px; background:rgba(2,6,23,.08); border-radius:999px; overflow:hidden; margin-top:8px;">
            <div style="width:${pct}%; height:100%; background:rgba(37,99,235,.85);"></div>
          </div>

          ${
            item.pending > 0
              ? `<div class="helper" style="margin-top:6px;">Fixas pendentes: ${pctPending.toFixed(0)}%</div>`
              : ""
          }
        </div>
      `;
    })
    .join("");
}

function renderMonthSummary() {
  const tbody = document.querySelector("#monthBreakdown tbody");

  if (!tbody) return;

  const totals = calcMonthTotals(month);

  const rows = [
    {
      name: "Fixas pendentes",
      value: totals.fixedPending,
    },
    {
      name: "Cartão",
      value: totals.card,
    },
    {
      name: "Metas",
      value: totals.goals,
    },
  ];

  const totalExpenses = rows.reduce((total, row) => {
    return total + Number(row.value || 0);
  }, 0);

  tbody.innerHTML = rows
    .map((row) => {
      const pct = totalExpenses > 0 ? (row.value / totalExpenses) * 100 : 0;

      return `
        <tr>
          <td>${row.name}</td>
          <td class="right">${formatBRL(row.value)}</td>
          <td class="right">${pct ? `${pct.toFixed(1)}%` : "-"}</td>
        </tr>
      `;
    })
    .join("");

  let foot = document.querySelector("#monthBreakdownFoot");

  if (!foot) {
    const tableWrap = document.querySelector("#monthBreakdown")?.closest(".table-wrap");

    if (tableWrap) {
      foot = document.createElement("div");
      foot.id = "monthBreakdownFoot";
      foot.className = "helper";
      foot.style.marginTop = "10px";
      tableWrap.after(foot);
    }
  }

  if (foot) {
    foot.innerHTML = `
      Total fixas: <b>${formatBRL(totals.fixedTotal)}</b> •
      Fixas pagas: <b>${formatBRL(totals.fixedPaid)}</b> •
      Assinaturas do cartão: <b>${formatBRL(cardRecurringTotal(month))}</b>
    `;
  }
}

function renderDashboard() {
  const selected = getSelectedMonth();

  if (selected !== ym) {
    ym = selected;
  }

  const existed = !!state.months?.[ym];

  month = ensureMonth(state, ym);

  if (!existed) {
    saveState(state);
  }

  if (monthLabelEl) {
    monthLabelEl.textContent = ymToLabel(ym);
  }

  if (incomeBaseInput) {
    incomeBaseInput.value = month.incomeBase ? String(Number(month.incomeBase)) : "";
  }

  renderKpis();
  renderExtras();
  renderMonthSummary();
  renderCategories();
  renderMonthClosure();
}

/* =========================
   Validações
========================= */
function ruleSalaryOptional() {
  const value = (incomeBaseInput?.value || "").trim();

  if (!value) {
    clearErr(incomeBaseInput, incomeBaseErr);
    return true;
  }

  return v.numberMin(
    incomeBaseInput,
    incomeBaseErr,
    0.01,
    "Informe um salário maior que 0."
  );
}

function ruleExtraName() {
  return v.required(
    extraNameInput,
    extraNameErr,
    "Informe a descrição da entrada extra."
  );
}

function ruleExtraValue() {
  return v.numberMin(
    extraValueInput,
    extraValueErr,
    0.01,
    "Informe um valor maior que 0."
  );
}

/* =========================
   Eventos
========================= */
saveIncomeBaseBtn?.addEventListener("click", () => {
  v.setShowMsg(true);

  const ok = v.validateAll([ruleSalaryOptional]);

  if (!ok) return;

  month.incomeBase = parseMoneyInput(incomeBaseInput?.value);

  saveState(state);
  renderDashboard();
});

clearSalaryBtn?.addEventListener("click", () => {
  month.incomeBase = 0;

  saveState(state);

  if (incomeBaseInput) {
    incomeBaseInput.value = "";
  }

  clearErr(incomeBaseInput, incomeBaseErr);

  renderDashboard();
});

addExtraBtn?.addEventListener("click", () => {
  v.setShowMsg(true);

  const ok = v.validateAll([ruleExtraName, ruleExtraValue]);

  if (!ok) return;

  month.incomeExtra.push({
    id: uid(),
    name: extraNameInput.value.trim(),
    value: parseMoneyInput(extraValueInput.value),
  });

  saveState(state);

  extraNameInput.value = "";
  extraValueInput.value = "";

  clearErr(extraNameInput, extraNameErr);
  clearErr(extraValueInput, extraValueErr);

  renderDashboard();
});

closeMonthBtn?.addEventListener("click", async () => {
  const confirmed = await openConfirmModal({
    title: "Fechar mês",
    message: `Deseja fechar ${ymToLabel(ym)}?\n\nIsso vai salvar uma foto final do mês com saldo planejado, saldo realizado e despesas do período.`,
    confirmText: "Fechar mês",
    cancelText: "Cancelar",
  });

  if (!confirmed) return;

  closeCurrentMonth();
});

reopenMonthBtn?.addEventListener("click", async () => {
  const confirmed = await openConfirmModal({
    title: "Reabrir mês",
    message: `Deseja reabrir ${ymToLabel(ym)}?\n\nO fechamento salvo será removido e você poderá fechar novamente depois.`,
    confirmText: "Reabrir mês",
    cancelText: "Cancelar",
  });

  if (!confirmed) return;

  reopenCurrentMonth();
});

incomeBaseInput?.addEventListener("input", () => {
  if (incomeBaseInput.classList.contains("invalid")) {
    ruleSalaryOptional();
  }
});

extraNameInput?.addEventListener("input", () => {
  if (extraNameInput.classList.contains("invalid")) {
    ruleExtraName();
  }
});

extraValueInput?.addEventListener("input", () => {
  if (extraValueInput.classList.contains("invalid")) {
    ruleExtraValue();
  }
});

/* =========================
   Init
========================= */
renderDashboard();