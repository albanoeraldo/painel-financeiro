import { supabase } from "./supabaseClient.js";

const emailInput = document.getElementById("email");
const passInput  = document.getElementById("password");
const btn        = document.getElementById("loginBtn");
const errorEl    = document.getElementById("loginError");

// Se já estiver logado → dashboard
const { data } = await supabase.auth.getSession();
if (data.session) {
  window.location.href = "index.html";
}

btn.addEventListener("click", async () => {
  errorEl.textContent = "";
  btn.disabled = true;
  btn.textContent = "Entrando...";

  const email = emailInput.value.trim();
  const password = passInput.value;

  if (!email || !password) {
    errorEl.textContent = "Informe e-mail e senha.";
    btn.disabled = false;
    btn.textContent = "Login";
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    errorEl.textContent = "E-mail ou senha inválidos.";
    btn.disabled = false;
    btn.textContent = "Entrar";
    return;
  }

  window.location.href = "index.html";
});