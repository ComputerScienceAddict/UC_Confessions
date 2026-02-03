"use client";

import { SCHOOL_TAGS, type SchoolId } from "@/lib/schools";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const UCMapLeaflet = dynamic(() => import("./UCMapLeaflet").then((m) => m.UCMapLeaflet), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[300px] w-full flex-1 items-center justify-center rounded border border-[#dddfe2] bg-[#f0f2f5] text-[13px] text-[#65676b]">
      Loading map…
    </div>
  ),
});

export function UCMap() {
  const [counts, setCounts] = useState<Record<SchoolId, number>>({} as Record<SchoolId, number>);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/confession-counts")
      .then((res) => res.json())
      .then((data: Record<string, number>) => {
        if (!cancelled) setCounts((data as Record<SchoolId, number>) ?? {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Ensure all school ids exist in counts
  const fullCounts = {} as Record<SchoolId, number>;
  for (const t of SCHOOL_TAGS) fullCounts[t.id] = counts[t.id] ?? 0;

  return (
    <aside className="hidden w-[320px] shrink-0 lg:block">
      <div
        className="sticky top-[52px] flex h-[calc(100vh-52px)] flex-col rounded-r border-y border-r border-[#dddfe2] bg-white p-3 shadow-sm"
        style={{ fontFamily: '"Lucida Grande", "Helvetica Neue", Helvetica, Arial, sans-serif' }}
      >
        <div className="mb-2 shrink-0 text-[11px] font-bold uppercase tracking-wide text-[#65676b]">UC Campuses</div>
        <div className="min-h-0 flex-1 rounded border border-[#dddfe2]">
          <UCMapLeaflet counts={fullCounts} />
        </div>
      </div>
    </aside>
  );
}
