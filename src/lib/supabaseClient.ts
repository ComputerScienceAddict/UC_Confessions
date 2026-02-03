import { createClient } from "@supabase/supabase-js";

const url = (typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string"
  ? process.env.NEXT_PUBLIC_SUPABASE_URL.trim()
  : "") || undefined;
const anonKey = (typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string"
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim()
  : "") || undefined;

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;

