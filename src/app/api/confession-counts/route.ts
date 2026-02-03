import { createClient } from "@supabase/supabase-js";
import { SCHOOL_TAGS, type SchoolId } from "@/lib/schools";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Cap rows read to avoid huge responses / DoS. */
const MAX_ROWS_FOR_COUNTS = 100_000;

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const counts: Record<SchoolId, number> = {} as Record<SchoolId, number>;
  for (const t of SCHOOL_TAGS) counts[t.id] = 0;

  if (!url || !anonKey) {
    return NextResponse.json(counts, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  }

  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase
    .from("confessions")
    .select("school_id")
    .limit(MAX_ROWS_FOR_COUNTS);

  if (error || !data) {
    return NextResponse.json(counts, {
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      },
    });
  }

  for (const row of data as { school_id: string }[]) {
    const id = row.school_id as SchoolId;
    if (id in counts) counts[id] = (counts[id] ?? 0) + 1;
  }

  const res = NextResponse.json(counts);
  res.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
  return res;
}
