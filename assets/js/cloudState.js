// assets/js/cloudState.js
import { supabase } from "./supabaseClient.js";

const TABLE = "finance_state";

// Busca o state do usuário logado
export async function pullStateFromCloud() {
  const { data: sess } = await supabase.auth.getSession();
  const user = sess?.session?.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select("state")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("pullStateFromCloud error:", error);
    return null;
  }

  return data?.state || null;
}

// Salva (upsert) o state do usuário logado
export async function pushStateToCloud(state) {
  const { data: sess } = await supabase.auth.getSession();
  const user = sess?.session?.user;
  if (!user) return;

  const payload = {
    user_id: user.id,
    state,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: "user_id" });

  if (error) console.error("pushStateToCloud error:", error);
}