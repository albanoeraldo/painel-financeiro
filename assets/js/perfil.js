import { supabase } from "./supabaseClient.js";
import { initHeader, renderUserName } from "./ui.js";

import {
  loadState,
  saveState,
  normalizeState,
} from "./storage.js";

const PROFILE_KEY = "profile_v1";

/* =========================
   Perfil local
========================= */
function getUserIdFromSession(sessionData) {
  return sessionData?.session?.user?.id || null;
}

function getStoredProfile(userId) {
  try {
    const all = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
    return all[userId] || null;
  } catch {
    return null;
  }
}

function setStoredProfile(userId, profile) {
  const all = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");

  all[userId] = {
    name: String(profile?.name || "").trim() || "Usuário",
    photo: profile?.photo || null,
  };

  localStorage.setItem(PROFILE_KEY, JSON.stringify(all));
}

function removeStoredProfile(userId) {
  const all = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
  delete all[userId];

  localStorage.setItem(PROFILE_KEY, JSON.stringify(all));
}

function firstLetter(name) {
  const text = String(name || "").trim();

  return text ? text[0].toUpperCase() : "U";
}

function showMsg(text) {
  const el = document.getElementById("profileMsg");

  if (el) {
    el.textContent = text || "";
  }
}

function showBackupMsg(text) {
  const el = document.getElementById("backupMsg");

  if (el) {
    el.textContent = text || "";
  }
}

function renderPreview(name, photoDataUrl) {
  const nameEl = document.getElementById("avatarName");
  const letterEl = document.getElementById("avatarLetter");

  if (nameEl) {
    nameEl.textContent = name || "Usuário";
  }

  if (!letterEl) return;

  letterEl.innerHTML = "";

  if (photoDataUrl) {
    const img = document.createElement("img");

    img.src = photoDataUrl;
    img.alt = "avatar";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.borderRadius = "999px";

    letterEl.appendChild(img);
  } else {
    letterEl.textContent = firstLetter(name);
  }
}

/* =========================
   Backup JSON
========================= */
function downloadJson(filename, data) {
  const content = JSON.stringify(data, null, 2);
  const blob = new Blob([content], {
    type: "application/json;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function buildBackupPayload(userId) {
  const financeState = normalizeState(loadState());
  const profile = getStoredProfile(userId);

  return {
    app: "controle-financeiro-pessoal",
    type: "finance_backup",
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    financeState,
    profile,
  };
}

function resolveBackupState(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Arquivo inválido.");
  }

  // Novo formato do backup
  if (payload.financeState && typeof payload.financeState === "object") {
    return normalizeState(payload.financeState);
  }

  // Compatibilidade: caso algum dia você exporte diretamente o state bruto
  if (payload.months && typeof payload.months === "object") {
    return normalizeState(payload);
  }

  throw new Error("Não encontrei dados financeiros válidos nesse backup.");
}

function getBackupMonthCount(state) {
  return Object.keys(state?.months || {}).length;
}

async function importBackupFile(file, userId) {
  if (!file) return;

  try {
    const text = await file.text();
    const payload = JSON.parse(text);

    const importedState = resolveBackupState(payload);
    const monthCount = getBackupMonthCount(importedState);

    const exportedAt = payload.exportedAt
      ? new Date(payload.exportedAt).toLocaleString("pt-BR")
      : "data não informada";

    const confirmed = window.confirm(
      `Importar backup?\n\n` +
      `Meses encontrados: ${monthCount}\n` +
      `Exportado em: ${exportedAt}\n\n` +
      `Atenção: isso vai substituir os dados financeiros atuais deste navegador e sincronizar com a nuvem.`
    );

    if (!confirmed) {
      showBackupMsg("Importação cancelada.");
      return;
    }

    saveState(importedState);

    if (payload.profile && typeof payload.profile === "object") {
      setStoredProfile(userId, payload.profile);
    }

    showBackupMsg("✅ Backup importado com sucesso. Recarregando...");

    setTimeout(() => {
      window.location.reload();
    }, 900);
  } catch (error) {
    console.error("Erro ao importar backup:", error);
    showBackupMsg("❌ Não foi possível importar o backup. Verifique se o arquivo JSON é válido.");
  }
}

function setupBackupActions(userId) {
  const exportBtn = document.getElementById("exportBackup");
  const importBtn = document.getElementById("chooseBackup");
  const importInput = document.getElementById("importBackupFile");

  exportBtn?.addEventListener("click", () => {
    try {
      const payload = buildBackupPayload(userId);
      const date = new Date().toISOString().slice(0, 10);

      downloadJson(`backup-financeiro-${date}.json`, payload);

      showBackupMsg("✅ Backup exportado com sucesso.");
    } catch (error) {
      console.error("Erro ao exportar backup:", error);
      showBackupMsg("❌ Não foi possível exportar o backup.");
    }
  });

  importBtn?.addEventListener("click", () => {
    importInput?.click();
  });

  importInput?.addEventListener("change", async () => {
    const file = importInput.files?.[0];

    await importBackupFile(file, userId);

    importInput.value = "";
  });
}

/* =========================
   Main
========================= */
async function main() {
  await initHeader("perfil", { syncCloud: true });
  await renderUserName();

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = getUserIdFromSession(sessionData);

  if (!userId) {
    showMsg("Você precisa estar logado para editar o perfil.");
    return;
  }

  const inputName = document.getElementById("profileName");
  const inputPhoto = document.getElementById("profilePhoto");
  const saveProfileBtn = document.getElementById("saveProfile");

  const user = sessionData?.session?.user;

  const fallbackName =
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Usuário";

  const saved = getStoredProfile(userId);

  let currentName = saved?.name || fallbackName;
  let currentPhoto = saved?.photo || null;
  let selectedPhoto = currentPhoto;

  if (inputName) {
    inputName.value = currentName;
  }

  renderPreview(currentName, selectedPhoto);

  inputName?.addEventListener("input", () => {
    currentName = inputName.value || fallbackName;
    renderPreview(currentName, selectedPhoto);
  });

  inputPhoto?.addEventListener("change", () => {
    const file = inputPhoto.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showMsg("❌ Selecione um arquivo de imagem válido.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      selectedPhoto = String(reader.result || "");
      renderPreview(inputName?.value || fallbackName, selectedPhoto);
      showMsg("Imagem carregada. Clique em Salvar para aplicar.");
    };

    reader.readAsDataURL(file);
  });

  saveProfileBtn?.addEventListener("click", async () => {
    const name = (inputName?.value || "").trim() || fallbackName;
    const photo = selectedPhoto || null;

    setStoredProfile(userId, {
      name,
      photo,
    });

    showMsg("✅ Perfil salvo!");
    renderPreview(name, photo);

    await renderUserName();
  });

  document.getElementById("removePhoto")?.addEventListener("click", async () => {
    const name = (inputName?.value || "").trim() || fallbackName;

    selectedPhoto = null;
    currentPhoto = null;

    if (inputPhoto) {
      inputPhoto.value = "";
    }

    setStoredProfile(userId, {
      name,
      photo: null,
    });

    showMsg("🧹 Foto removida.");
    renderPreview(name, null);

    await renderUserName();
  });

  document.getElementById("resetProfile")?.addEventListener("click", async () => {
    const confirmed = window.confirm(
      "Deseja resetar o perfil?\n\nIsso vai remover nome personalizado e foto salvos neste navegador."
    );

    if (!confirmed) return;

    removeStoredProfile(userId);

    selectedPhoto = null;
    currentPhoto = null;

    if (inputPhoto) {
      inputPhoto.value = "";
    }

    if (inputName) {
      inputName.value = fallbackName;
    }

    showMsg("♻️ Perfil resetado para o padrão.");
    renderPreview(fallbackName, null);

    await renderUserName();
  });

  setupBackupActions(userId);
}

main();