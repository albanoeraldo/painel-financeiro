import { supabase } from "./supabaseClient.js";

const form = document.getElementById("loginForm");
const email = document.getElementById("email");
const password = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const loginBtnText = document.getElementById("loginBtnText");
const spinner = document.getElementById("spinner");

const emailError = document.getElementById("emailError");
const passError = document.getElementById("passError");
const authError = document.getElementById("authError");

const alreadyBox = document.getElementById("alreadyBox");
const goApp = document.getElementById("goApp");
const switchAccount = document.getElementById("switchAccount");

function setLoading(isLoading){
  if (spinner) spinner.style.display = isLoading ? "block" : "none";
  if (loginBtn) loginBtn.disabled = isLoading;
  if (loginBtnText) loginBtnText.textContent = isLoading ? "Entrando..." : "Entrar";
}

function clearErrors(){
  authError.textContent = "";
  emailError.textContent = "";
  passError.textContent = "";
  email.classList.remove("invalid");
  password.classList.remove("invalid");
}

function validate(){
  clearErrors();
  let ok = true;

  const e = (email.value || "").trim();
  const p = (password.value || "").trim();

  if (!e){
    email.classList.add("invalid");
    emailError.textContent = "Informe seu e-mail.";
    ok = false;
  }
  if (!p){
    password.classList.add("invalid");
    passError.textContent = "Informe sua senha.";
    ok = false;
  }
  return ok;
}

async function checkSession(){
  const { data } = await supabase.auth.getSession();
  const hasSession = !!data.session;

  // ✅ se já logou, não redireciona — só mostra a caixa
  if (alreadyBox) alreadyBox.style.display = hasSession ? "block" : "none";
  if (form) form.style.display = hasSession ? "none" : "grid";
}

goApp?.addEventListener("click", () => {
  window.location.href = "index.html";
});

switchAccount?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  // volta pro form
  await checkSession();
});

form?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!validate()) return;

  setLoading(true);

  const { error } = await supabase.auth.signInWithPassword({
    email: email.value.trim(),
    password: password.value.trim(),
  });

  setLoading(false);

  if (error){
    authError.textContent = error.message || "Não foi possível entrar.";
    return;
  }

  window.location.href = "index.html";
});

checkSession();