export const SCHOOL_TAGS = [
  { id: "ucr", label: "#ucr" },
  { id: "ucla", label: "#ucla" },
  { id: "ucsd", label: "#ucsd" },
  { id: "uci", label: "#uci" },
  { id: "ucb", label: "#ucb" },
  { id: "ucd", label: "#ucd" },
  { id: "ucsb", label: "#ucsb" },
  { id: "ucsc", label: "#ucsc" },
] as const;

export type SchoolId = (typeof SCHOOL_TAGS)[number]["id"];
export type SchoolLabel = (typeof SCHOOL_TAGS)[number]["label"];

export const DEFAULT_SCHOOL_ID: SchoolId = "ucr";

export function schoolIdToLabel(id: SchoolId): SchoolLabel {
  const hit = SCHOOL_TAGS.find((t) => t.id === id);
  return (hit?.label ?? "#ucr") as SchoolLabel;
}

export function schoolLabelToId(label: SchoolLabel): SchoolId {
  const hit = SCHOOL_TAGS.find((t) => t.label === label);
  return (hit?.id ?? "ucr") as SchoolId;
}

