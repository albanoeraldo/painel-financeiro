import { supabase } from "./supabaseClient.js";

const TABLE = "finance_state";

export async function pullStateFromCloud() {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return null;

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

export async function pushStateToCloud(state) {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return false;

  const payload = {
    user_id: user.id,
    state,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    console.error("pushStateToCloud error:", error);
    return false;
  }

  return true;
}