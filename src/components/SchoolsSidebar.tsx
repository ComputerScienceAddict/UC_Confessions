import { SCHOOL_TAGS, schoolIdToLabel, type SchoolId } from "@/lib/schools";

export function SchoolsSidebar({
  activeTag,
  onSelectTag,
}: {
  activeTag: SchoolId | "all";
  onSelectTag: (tag: SchoolId | "all") => void;
}) {
  return (
    <aside className="hidden w-[220px] shrink-0 lg:block">
      <div
        className="sticky top-[52px] rounded border border-[#dddfe2] bg-white p-3 shadow-sm"
        style={{ fontFamily: '"Lucida Grande", "Helvetica Neue", Helvetica, Arial, sans-serif' }}
      >
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#65676b]">Tags</div>
        <ul className="space-y-0.5 text-[13px]">
          <li>
            <button
              type="button"
              onClick={() => onSelectTag("all")}
              className={`w-full rounded px-2 py-1.5 text-left hover:bg-[#f0f2f5] ${
                activeTag === "all" ? "font-bold text-[#3b5998]" : "text-[#1c1e21]"
              }`}
            >
              All schools
            </button>
          </li>
          {SCHOOL_TAGS.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onSelectTag(t.id)}
                className={`w-full rounded px-2 py-1.5 text-left hover:bg-[#f0f2f5] ${
                  activeTag === t.id ? "font-bold text-[#3b5998]" : "text-[#1c1e21]"
                }`}
              >
                {schoolIdToLabel(t.id)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

