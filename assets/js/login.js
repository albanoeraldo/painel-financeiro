import { supabase } from "./supabaseClient.js";

const email = document.getElementById("email");
const password = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const msg = document.getElementById("msg");

async function refreshUI(){
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if(session){
    msg.textContent = `Logado como: ${session.user.email}`;
    logoutBtn.style.display = "inline-block";
    loginBtn.textContent = "Ir para o app";
  } else {
    msg.textContent = "";
    logoutBtn.style.display = "none";
    loginBtn.textContent = "Entrar";
  }
}

loginBtn.addEventListener("click", async () => {
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if(session){
    window.location.href = "index.html";
    return;
  }

  msg.textContent = "Entrando...";
  const { error } = await supabase.auth.signInWithPassword({
    email: email.value.trim(),
    password: password.value,
  });

  if(error){
    msg.textContent = error.message;
    return;
  }

  msg.textContent = "Logado! Indo para o app...";
  window.location.href = "index.html";
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  await refreshUI();
});

refreshUI();