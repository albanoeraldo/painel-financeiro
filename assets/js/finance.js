export const CATEGORIES = [
  { key: "moradia", label: "🏠 Moradia" },
  { key: "alimentacao", label: "🍽️ Alimentação" },
  { key: "transporte", label: "🚗 Transporte" },
  { key: "saude", label: "🩺 Saúde" },
  { key: "internet", label: "📶 Internet/Telefone" },
  { key: "lazer", label: "🎉 Lazer" },
  { key: "emprestimo", label: "💳 Empréstimo" },
  { key: "outros", label: "📌 Outros" },
];

export function sumValues(values) {
  return (values || []).reduce((total, value) => {
    return total + Number(value || 0);
  }, 0);
}

export function sumBy(items, selector) {
  return (items || []).reduce((total, item) => {
    return total + Number(selector(item) || 0);
  }, 0);
}

export function normalizeCategoryKey(raw) {
  const value = String(raw || "").trim();

  if (!value) return "outros";

  if (CATEGORIES.some((category) => category.key === value)) {
    return value;
  }

  const clean = value
    .replace(/^[^\p{L}\p{N}]*/gu, "")
    .trim()
    .toLowerCase();

  const mapTextToKey = {
    moradia: "moradia",
    alimentação: "alimentacao",
    alimentacao: "alimentacao",
    transporte: "transporte",
    saúde: "saude",
    saude: "saude",
    "internet/telefone": "internet",
    internet: "internet",
    lazer: "lazer",
    empréstimo: "emprestimo",
    emprestimo: "emprestimo",
    outros: "outros",
  };

  return mapTextToKey[clean] || "outros";
}

export function catLabel(key) {
  const normalized = normalizeCategoryKey(key);
  const category = CATEGORIES.find((item) => item.key === normalized);

  return category ? category.label : "📌 Outros";
}

export function fixedTotals(month) {
  const fixedTotal = sumBy(month?.fixed || [], (item) => item.value);
  const fixedPending = sumBy(
    (month?.fixed || []).filter((item) => !item.paid),
    (item) => item.value
  );

  const fixedPaid = fixedTotal - fixedPending;

  return {
    fixedTotal,
    fixedPending,
    fixedPaid,
  };
}

export function cardRecurringTotal(month) {
  return sumBy(
    (month?.cardRecurring || []).filter((item) => item && item.active !== false),
    (item) => item.value
  );
}

export function cardTotals(month) {
  const cardParts = sumBy(month?.card || [], (item) => item.monthValue ?? item.value);
  const cardRecurring = cardRecurringTotal(month);
  const card = cardParts + cardRecurring;

  return {
    cardParts,
    cardRecurring,
    card,
  };
}

export function goalsTotal(month) {
  return sumBy(month?.goals || [], (item) => item.saved);
}

export function incomeTotals(month) {
  const incomeBase = Number(month?.incomeBase || 0);
  const incomeExtra = sumBy(month?.incomeExtra || [], (item) => item.value);
  const income = incomeBase + incomeExtra;

  return {
    incomeBase,
    incomeExtra,
    income,
  };
}

export function calcMonthTotals(month) {
  const { fixedTotal, fixedPending, fixedPaid } = fixedTotals(month);
  const { cardParts, cardRecurring, card } = cardTotals(month);
  const goals = goalsTotal(month);
  const { incomeBase, incomeExtra, income } = incomeTotals(month);

  const pendingExpenses = fixedPending + card + goals;
  const plannedExpenses = fixedTotal + card + goals;
  const realizedExpenses = fixedPaid + card + goals;

  const plannedBalance = income - plannedExpenses;
  const realizedBalance = income - realizedExpenses;

  return {
    incomeBase,
    incomeExtra,
    income,

    fixedTotal,
    fixedPending,
    fixedPaid,

    cardParts,
    cardRecurring,
    card,

    goals,

    pendingExpenses,
    plannedExpenses,
    realizedExpenses,

    plannedBalance,
    realizedBalance,

    // nomes antigos mantidos para compatibilidade com sua tela atual
    despesasPendentes: pendingExpenses,
    despesasPlanejadas: plannedExpenses,
    despesasRealizadas: realizedExpenses,
    saldo: plannedBalance,
    saldoFechamento: realizedBalance,
  };
}

export function totalsByCategoryExpenses(month) {
  const mapTotal = {};
  const mapPending = {};

  function addTotal(category, value) {
    const key = normalizeCategoryKey(category);
    const number = Number(value || 0);

    if (!number) return;

    mapTotal[key] = (mapTotal[key] || 0) + number;
  }

  function addPending(category, value) {
    const key = normalizeCategoryKey(category);
    const number = Number(value || 0);

    if (!number) return;

    mapPending[key] = (mapPending[key] || 0) + number;
  }

  (month?.fixed || []).forEach((item) => {
    if (!item.paid) {
      addTotal(item.category || "outros", item.value);
      addPending(item.category || "outros", item.value);
    }
  });

  (month?.card || []).forEach((item) => {
    addTotal(item.category || "outros", item.monthValue ?? item.value);
  });

  (month?.cardRecurring || [])
    .filter((item) => item && item.active !== false)
    .forEach((item) => {
      addTotal(item.category || "outros", item.value);
    });

  return {
    mapTotal,
    mapPending,
  };
}

export function buildClosureSnapshot(ym, month) {
  const totals = calcMonthTotals(month);

  return {
    month: ym,
    closedAt: new Date().toISOString(),

    incomeBase: totals.incomeBase,
    incomeExtra: totals.incomeExtra,
    income: totals.income,

    fixedTotal: totals.fixedTotal,
    fixedPaid: totals.fixedPaid,
    fixedPending: totals.fixedPending,

    cardParts: totals.cardParts,
    cardRecurring: totals.cardRecurring,
    card: totals.card,

    goals: totals.goals,

    pendingExpenses: totals.pendingExpenses,
    plannedExpenses: totals.plannedExpenses,
    realizedExpenses: totals.realizedExpenses,

    plannedBalance: totals.plannedBalance,
    realizedBalance: totals.realizedBalance,

    // compatibilidade com fechamentos antigos
    expensesClosed: totals.plannedExpenses,
    saldoFinal: totals.plannedBalance,
  };
}

export function formatDateTimeBR(iso) {
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return "-";
  }
}