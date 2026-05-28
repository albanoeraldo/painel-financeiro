import { parseMoneyInput } from "./storage.js";

export function createValidator({ showOn = "submit" } = {}) {
  let showMsg = showOn === "input";

  function setShowMsg(value) {
    showMsg = !!value;
  }

  function setErr(input, errEl, msg) {
    if (!input) return;

    const hasErr = !!msg;

    if (!showMsg) {
      input.classList.remove("invalid");
      if (errEl) errEl.textContent = "";
      return;
    }

    input.classList.toggle("invalid", hasErr);

    if (errEl) {
      errEl.textContent = msg || "";
    }
  }

  function required(input, errEl, msg = "Campo obrigatório") {
    const value = (input?.value || "").trim();
    const ok = !!value;

    setErr(input, errEl, ok ? "" : msg);

    return ok;
  }

  function numberMin(input, errEl, min = 0.01, msg) {
    const number = parseMoneyInput(input?.value);
    const ok = Number.isFinite(number) && number >= min;

    setErr(input, errEl, ok ? "" : msg || `Informe um valor maior ou igual a ${min}.`);

    return ok;
  }

  function numberRange(input, errEl, min, max, msg) {
    const number = parseMoneyInput(input?.value);
    const ok = Number.isFinite(number) && number >= min && number <= max;

    setErr(input, errEl, ok ? "" : msg || `Use um valor entre ${min} e ${max}.`);

    return ok;
  }

  function validateAll(rules, submitBtn) {
    const ok = rules.map((rule) => rule()).every(Boolean);

    if (submitBtn) {
      submitBtn.disabled = !ok;
    }

    return ok;
  }

  return {
    setShowMsg,
    required,
    numberMin,
    numberRange,
    validateAll,
  };
}