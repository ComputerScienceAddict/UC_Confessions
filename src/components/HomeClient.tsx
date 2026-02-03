"use client";

import { ConfessionsBoard } from "@/components/ConfessionsBoard";
import { SchoolsSidebar } from "@/components/SchoolsSidebar";
import { UCMap } from "@/components/UCMap";
import type { SchoolId } from "@/lib/schools";
import { useState } from "react";

export function HomeClient() {
  const [activeTag, setActiveTag] = useState<SchoolId | "all">("all");

  return (
    <main className="w-full px-0 py-6 sm:px-0">
      <div className="flex w-full items-stretch gap-0">
        <UCMap />
        <div className="relative min-w-0 flex-1 px-4 sm:px-6">
          <div
            className="flex shrink-0 items-start gap-4"
            style={{
              marginLeft: "max(0px, calc(50vw - 320px - 328px))",
            }}
          >
            <SchoolsSidebar activeTag={activeTag} onSelectTag={setActiveTag} />
            <div className="w-[420px]">
              <ConfessionsBoard activeTag={activeTag} onSelectTag={setActiveTag} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

