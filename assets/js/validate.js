// assets/js/validate.js
export function createValidator({ showOn = "submit" } = {}) {
  let showMsg = showOn === "input"; // se quiser já validar enquanto digita

  function setShowMsg(v) {
    showMsg = !!v;
  }

  function setErr(input, errEl, msg) {
    if (!input) return;
    const hasErr = !!msg;

    // visual do campo
    input.classList.toggle("invalid", hasErr);

    // mensagem (controlada pelo showMsg)
    if (errEl) errEl.textContent = showMsg ? (msg || "") : "";
  }

  function required(input, errEl, msg = "Campo obrigatório") {
    const v = (input?.value || "").trim();
    const ok = !!v;
    setErr(input, errEl, ok ? "" : msg);
    return ok;
  }

  function numberMin(input, errEl, min = 0.01, msg) {
    const n = Number(input?.value || 0);
    const ok = Number.isFinite(n) && n >= min;
    setErr(input, errEl, ok ? "" : (msg || `Informe um valor >= ${min}.`));
    return ok;
  }

  function numberRange(input, errEl, min, max, msg) {
    const n = Number(input?.value || 0);
    const ok = Number.isFinite(n) && n >= min && n <= max;
    setErr(input, errEl, ok ? "" : (msg || `Use ${min} a ${max}.`));
    return ok;
  }

  function validateAll(rules, submitBtn) {
    const ok = rules.map(fn => fn()).every(Boolean);
    if (submitBtn) submitBtn.disabled = !ok;
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
