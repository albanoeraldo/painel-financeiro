import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://yqoasibfrzfnxaozrekv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlxb2FzaWJmcnpmbnhhb3pyZWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMjk2NTksImV4cCI6MjA4MjYwNTY1OX0._qsjenJ3APMPsRG76qScN--e-cpkje6nR_UVOUSwUgE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
