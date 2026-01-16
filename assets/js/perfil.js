import { supabase } from "./supabaseClient.js";

const KEY = "profile_v1";

function getUserIdFromSession(sess){
  return sess?.session?.user?.id || null;
}

function getStoredProfile(userId){
  try{
    const all = JSON.parse(localStorage.getItem(KEY) || "{}");
    return all[userId] || null;
  }catch{
    return null;
  }
}

function setStoredProfile(userId, profile){
  const all = JSON.parse(localStorage.getItem(KEY) || "{}");
  all[userId] = profile;
  localStorage.setItem(KEY, JSON.stringify(all));
}

function removeStoredProfile(userId){
  const all = JSON.parse(localStorage.getItem(KEY) || "{}");
  delete all[userId];
  localStorage.setItem(KEY, JSON.stringify(all));
}

function firstLetter(name){
  const t = (name || "").trim();
  return t ? t[0].toUpperCase() : "U";
}

function showMsg(text){
  const el = document.getElementById("profileMsg");
  if(el) el.textContent = text || "";
}

function renderPreview(name, photoDataUrl){
  const nameEl = document.getElementById("avatarName");
  const letterEl = document.getElementById("avatarLetter");

  if(nameEl) nameEl.textContent = name || "Usuário";

  if(photoDataUrl){
    // troca o “A” por uma imagem
    if(letterEl){
      letterEl.innerHTML = `<img src="${photoDataUrl}" alt="avatar" style="width:100%; height:100%; object-fit:cover; border-radius:999px;" />`;
    }
  }else{
    if(letterEl){
      letterEl.textContent = firstLetter(name);
    }
  }
}

async function main(){
  const { data: sess } = await supabase.auth.getSession();
  const userId = getUserIdFromSession(sess);

  if(!userId){
    showMsg("Você precisa estar logado para editar o perfil.");
    return;
  }

  const inputName = document.getElementById("profileName");
  const inputPhoto = document.getElementById("profilePhoto");

  // default: tenta pegar nome do supabase ou do email
  const user = sess?.session?.user;
  const fallbackName =
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Usuário";

  const saved = getStoredProfile(userId);
  const currentName = saved?.name || fallbackName;
  const currentPhoto = saved?.photo || null;

  if(inputName) inputName.value = currentName;
  renderPreview(currentName, currentPhoto);

  // preview ao digitar
  inputName?.addEventListener("input", () => {
    renderPreview(inputName.value, currentPhoto);
  });

  // preview ao escolher imagem
  inputPhoto?.addEventListener("change", () => {
    const file = inputPhoto.files?.[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      renderPreview(inputName.value, dataUrl);
      // guarda temporariamente no dataset do botão salvar
      document.getElementById("saveProfile")?.setAttribute("data-photo", dataUrl);
    };
    reader.readAsDataURL(file);
  });

  // salvar
  document.getElementById("saveProfile")?.addEventListener("click", () => {
    const name = (inputName?.value || "").trim() || fallbackName;
    const photo = document.getElementById("saveProfile")?.getAttribute("data-photo") || currentPhoto || null;

    setStoredProfile(userId, { name, photo });
    showMsg("✅ Perfil salvo! Volte para o Dashboard para ver no topo.");
    renderPreview(name, photo);
  });

  // remover foto
  document.getElementById("removePhoto")?.addEventListener("click", () => {
    const name = (inputName?.value || "").trim() || fallbackName;
    setStoredProfile(userId, { name, photo: null });
    document.getElementById("saveProfile")?.removeAttribute("data-photo");
    showMsg("🧹 Foto removida.");
    renderPreview(name, null);
  });

  // reset total
  document.getElementById("resetProfile")?.addEventListener("click", () => {
    removeStoredProfile(userId);
    document.getElementById("saveProfile")?.removeAttribute("data-photo");
    if(inputName) inputName.value = fallbackName;
    showMsg("♻️ Perfil resetado para o padrão.");
    renderPreview(fallbackName, null);
  });
}

main();