import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    // Strip wrapping quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    const existing = process.env[key];
    if (!existing || String(existing).trim() === "") process.env[key] = value;
  }
}

function fail(step, err) {
  console.error(`❌ ${step}`);
  if (err) console.error(err);
  process.exitCode = 1;
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    console.error("Create .env.local from .env.local.example first.");
    process.exit(1);
  }

  console.log("Supabase env detected:", {
    url: url.replace(/\/+$/, ""),
    anonKeyLength: anonKey.length,
  });

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Can we read something?
  {
    const { error } = await supabase.from("school_tags").select("id").limit(1);
    if (error) return fail("Read school_tags (check schema + RLS select policy)", error);
    console.log("✅ Read school_tags");
  }

  // 2) Sign in anonymously (needed for like/unlike and posting with RLS)
  let uid = null;
  {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      if (error.code === "anonymous_provider_disabled") {
        console.log("⚠️ Anonymous sign-in is disabled (Auth setting).");
        console.log("   - Posting may still work if RLS is OFF and grants allow insert.");
        console.log("   - Likes will NOT work without auth (user_id is required).");
      } else {
        return fail("Anonymous sign-in (enable in Supabase Auth settings)", error);
      }
    } else {
      uid = data?.user?.id ?? null;
      console.log("✅ Anonymous sign-in", { userId: uid });
    }
  }

  if (uid) {
    const { data: userData } = await supabase.auth.getUser();
    uid = userData.user?.id ?? uid;
  }

  // 3) Find a confession to test like/unlike + views
  let confessionId = null;
  {
    const { data, error } = await supabase
      .from("confessions")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return fail("Read confessions (check schema + RLS select policy)", error);
    confessionId = data?.id ?? null;
  }

  if (!confessionId) {
    // No posts yet: create one (this is the only way to test writes).
    const body = "[smoke test] you can delete this post";
    const { data, error } = await supabase
      .from("confessions")
      .insert({ body, school_id: "ucr" })
      .select("id")
      .single();
    if (error) return fail("Insert confession (check RLS insert policy + anon sign-in)", error);
    confessionId = data.id;
    console.log("✅ Inserted a smoke-test confession", { confessionId });
  } else {
    console.log("✅ Found confession for test", { confessionId });
  }

  // 4) Like then unlike (tests insert/delete with RLS + auth)
  if (uid) {
    // Ensure clean state
    await supabase
      .from("confession_likes")
      .delete()
      .eq("confession_id", confessionId)
      .eq("user_id", uid);

    const { error: likeErr } = await supabase
      .from("confession_likes")
      .insert({ confession_id: confessionId, user_id: uid });
    if (likeErr) return fail("Insert like (check RLS insert policy)", likeErr);

    const { error: unlikeErr } = await supabase
      .from("confession_likes")
      .delete()
      .eq("confession_id", confessionId)
      .eq("user_id", uid);
    if (unlikeErr) return fail("Delete like (check RLS delete policy)", unlikeErr);

    console.log("✅ Like/unlike write test passed");
  } else {
    console.log("⚠️ Skipping like/unlike (no authenticated user).");
  }

  // 5) Increment views via RPC
  {
    const { error } = await supabase.rpc("increment_confession_views", {
      p_confession_id: confessionId,
    });
    if (error) return fail("RPC increment_confession_views (create function + grant execute)", error);
    console.log("✅ Views increment RPC passed");
  }

  // 6) Cleanup: try to delete the smoke-test post (optional)
  {
    const { error } = await supabase.from("confessions").delete().eq("id", confessionId);
    if (error) {
      console.log("⚠️ Cleanup delete failed (this is OK).", {
        code: error.code,
        message: error.message,
      });
    } else {
      console.log("✅ Cleanup delete passed");
    }
  }

  console.log("\nAll Supabase checks passed.");
}

await main();

