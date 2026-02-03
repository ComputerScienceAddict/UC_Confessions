"use client";

import { toJpeg } from "html-to-image";
import {
  DEFAULT_SCHOOL_ID,
  SCHOOL_TAGS,
  schoolIdToLabel,
  type SchoolId,
} from "@/lib/schools";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Confession = {
  id: string;
  createdAt: number;
  text: string;
  imageDataUrl?: string;
  schoolId?: SchoolId;
  views?: number;
  likes?: number;
  liked?: boolean;
};

const STORAGE_KEY = "ucr_confessions_v7";
const LIKED_KEY = "ucr_confessions_liked_v1";
const MAX_CHARS = 560;
const PAGE_SIZE = 10;
const MAX_CONFESSIONS_IN_MEMORY = 500;
// Generate a high-quality, square "story" style image,
// then display it smaller in the feed.
const CARD_WIDTH = 900;
const CARD_HEIGHT = 900;

function normalizeConfession(c: Confession): Confession {
  const views = typeof c.views === "number" ? c.views : 0;
  const likes = typeof c.likes === "number" ? c.likes : 0;
  const liked = typeof c.liked === "boolean" ? c.liked : false;
  const schoolId = c.schoolId ?? DEFAULT_SCHOOL_ID;
  return { ...c, schoolId, views, likes, liked };
}

function formatCount(n: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact" }).format(n);
}

function loadLikedSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(LIKED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x) => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveLikedSet(set: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LIKED_KEY, JSON.stringify([...set]));
}

function fontSizeFor(text: string) {
  const len = text.trim().length;
  // Keep longer posts from feeling cramped.
  if (len > 420) return 36;
  if (len > 320) return 40;
  if (len > 240) return 46;
  if (len > 160) return 52;
  return 58;
}

function loadFromStorage(): Confession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Confession[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x === "object")
      .filter((x) => typeof x.id === "string" && typeof x.createdAt === "number")
      .filter((x) => typeof x.text === "string");
  } catch {
    return [];
  }
}

function saveToStorage(confessions: Confession[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(confessions));
}

export function ConfessionsBoard({
  activeTag,
  onSelectTag,
}: {
  activeTag: SchoolId | "all";
  onSelectTag: (tag: SchoolId | "all") => void;
}) {
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [schoolId, setSchoolId] = useState<SchoolId>(
    activeTag === "all" ? DEFAULT_SCHOOL_ID : activeTag,
  );
  const [renderJob, setRenderJob] = useState<{
    id: string;
    createdAt: number;
    text: string;
    schoolId: SchoolId;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageTemplateRef = useRef<HTMLDivElement | null>(null);
  const viewedRef = useRef<Set<string>>(new Set());

  const [paginationOffset, setPaginationOffset] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!supabase) {
        const loaded = loadFromStorage();
        const normalized = loaded.map(normalizeConfession);
        const likedSet = loadLikedSet();
        for (const c of normalized) c.liked = likedSet.has(c.id);
        setConfessions(normalized);
        saveToStorage(normalized);
        return;
      }

      type Row = {
        id: string;
        created_at: string;
        body: string;
        school_id: SchoolId;
        views_count: number;
        likes_count?: number;
      };

      // Try the newer schema first (with likes_count), fall back if your table
      // doesn't have it yet.
      let data: unknown = null;
      let error: unknown = null;
      {
        const res = await supabase
        .from("confessions")
        .select("id, created_at, body, school_id, views_count, likes_count")
        .order("created_at", { ascending: false })
          .range(0, PAGE_SIZE);
        data = res.data;
        error = res.error;
      }

      const errorMessage =
        typeof error === "object" && error && "message" in error
          ? String((error as { message?: unknown }).message ?? "")
          : "";

      if (error && errorMessage.includes("likes_count")) {
        const res = await supabase
          .from("confessions")
          .select("id, created_at, body, school_id, views_count")
          .order("created_at", { ascending: false })
          .range(0, PAGE_SIZE);
        data = res.data;
        error = res.error;
      }

      if (cancelled) return;
      if (error || !data) {
        setError("Couldn’t load posts from the server.");
        return;
      }

      const rows = data as unknown as Row[];
      setHasMore(rows.length > PAGE_SIZE);
      const take = rows.slice(0, PAGE_SIZE);
      const likedSet = loadLikedSet();
      const mapped: Confession[] = take.map((r) => ({
        id: r.id,
        createdAt: Date.parse(r.created_at),
        text: r.body,
        schoolId: r.school_id ?? DEFAULT_SCHOOL_ID,
        views: typeof r.views_count === "number" ? r.views_count : 0,
        likes: typeof r.likes_count === "number" ? r.likes_count : 0,
        liked: likedSet.has(r.id),
      }));

      setConfessions((prev) => {
        const prevImages = new Map(prev.map((p) => [p.id, p.imageDataUrl]));
        return mapped.map((m) => ({
          ...normalizeConfession(m),
          imageDataUrl: prevImages.get(m.id),
        }));
      });
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeTag !== "all") setSchoolId(activeTag);
  }, [activeTag]);

  const canPost = text.trim().length >= 3 && text.trim().length <= MAX_CHARS;

  type FeedSort = "new" | "old" | "top";
  const [feedSort, setFeedSort] = useState<FeedSort>("new");

  const sorted = useMemo(() => {
    const list = [...confessions];
    if (feedSort === "new") return list.sort((a, b) => b.createdAt - a.createdAt);
    if (feedSort === "old") return list.sort((a, b) => a.createdAt - b.createdAt);
    if (feedSort === "top") {
      return list.sort((a, b) => {
        const likesA = typeof a.likes === "number" ? a.likes : 0;
        const likesB = typeof b.likes === "number" ? b.likes : 0;
        if (likesB !== likesA) return likesB - likesA;
        return b.createdAt - a.createdAt;
      });
    }
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }, [confessions, feedSort]);

  const visible = useMemo(() => {
    if (activeTag === "all") return sorted;
    return sorted.filter((c) => (c.schoolId ?? DEFAULT_SCHOOL_ID) === activeTag);
  }, [activeTag, sorted]);

  const displayedVisible = useMemo(() => {
    if (supabase) return visible;
    return visible.slice(0, displayCount);
  }, [supabase, visible, displayCount]);

  async function loadMore() {
    if (supabase) {
      setLoadingMore(true);
      type Row = {
        id: string;
        created_at: string;
        body: string;
        school_id: SchoolId;
        views_count: number;
        likes_count?: number;
      };
      const res = await supabase
        .from("confessions")
        .select("id, created_at, body, school_id, views_count, likes_count")
        .order("created_at", { ascending: false })
        .range(paginationOffset, paginationOffset + PAGE_SIZE);
      const rows = (res.data ?? []) as unknown as Row[];
      setHasMore(rows.length > PAGE_SIZE);
      const take = rows.slice(0, PAGE_SIZE);
      const likedSet = loadLikedSet();
      const mapped: Confession[] = take.map((r) => ({
        id: r.id,
        createdAt: Date.parse(r.created_at),
        text: r.body,
        schoolId: r.school_id ?? DEFAULT_SCHOOL_ID,
        views: typeof r.views_count === "number" ? r.views_count : 0,
        likes: typeof r.likes_count === "number" ? r.likes_count : 0,
        liked: likedSet.has(r.id),
      }));
      setConfessions((prev) => {
        const prevImages = new Map(prev.map((p) => [p.id, p.imageDataUrl]));
        return [...prev, ...mapped.map((m) => ({
          ...normalizeConfession(m),
          imageDataUrl: prevImages.get(m.id),
        }))];
      });
      setPaginationOffset((o) => o + PAGE_SIZE);
      setLoadingMore(false);
    } else {
      setDisplayCount((c) => c + PAGE_SIZE);
    }
  }

  // Increment views once per session per post (Supabase mode only).
  useEffect(() => {
    if (!supabase) return;
    for (const c of displayedVisible) {
      if (viewedRef.current.has(c.id)) continue;
      viewedRef.current.add(c.id);
      void supabase
        .rpc("increment_confession_views", { p_confession_id: c.id })
        .then(
          () => {
            setConfessions((prev) =>
              prev.map((p) => (p.id === c.id ? { ...p, views: (p.views ?? 0) + 1 } : p)),
            );
          },
          () => {
            // ignore
          },
        );
    }
  }, [displayedVisible]);

  useEffect(() => {
    if (renderJob) return;
    const next = sorted.find((c) => !c.imageDataUrl);
    if (!next) return;
    setRenderJob({
      id: next.id,
      createdAt: next.createdAt,
      text: next.text,
      schoolId: next.schoolId ?? DEFAULT_SCHOOL_ID,
    });
  }, [renderJob, sorted]);

  useEffect(() => {
    let cancelled = false;
    const TIMEOUT_MS = 8000;

    async function run() {
      if (!renderJob) return;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (cancelled) return;
      const node = imageTemplateRef.current;
      if (!node) {
        if (!cancelled) setRenderJob(null);
        return;
      }

      try {
        const dataUrl = await Promise.race([
          toJpeg(node, {
            quality: 0.85,
            cacheBust: true,
            pixelRatio: 1.5,
            backgroundColor: "#ffffff",
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS),
          ),
        ]);
        if (cancelled) return;
        setConfessions((prev) => {
          const updated = prev.map((c) =>
            c.id === renderJob.id ? { ...c, imageDataUrl: dataUrl } : c,
          );
          if (!supabase) saveToStorage(updated);
          return updated;
        });
      } catch {
        // Timeout or render failed: skip image so user still sees "Rendering…" / link
      } finally {
        if (!cancelled) setRenderJob(null);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [renderJob]);

  async function submit() {
    setError(null);
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      setError("Write at least a couple words.");
      textareaRef.current?.focus();
      return;
    }
    if (trimmed.length > MAX_CHARS) {
      setError("That confession is a bit long. Try trimming it down.");
      textareaRef.current?.focus();
      return;
    }

    if (!supabase) {
      const next: Confession = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        text: trimmed,
        schoolId,
        views: 0,
        likes: 0,
        liked: false,
      };
      setConfessions((prev) => {
        const updated = [next, ...prev].slice(0, MAX_CONFESSIONS_IN_MEMORY);
        saveToStorage(updated);
        return updated;
      });
      setText("");
      textareaRef.current?.focus();
      document.getElementById("feed")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    setIsPosting(true);
    try {
      type InsertRow = {
        id: string;
        created_at: string;
        body: string;
        school_id: SchoolId;
        views_count: number;
        likes_count?: number;
      };

      const { data, error } = await supabase
        .from("confessions")
        .insert({ body: trimmed, school_id: schoolId })
        .select("id, created_at, body, school_id, views_count, likes_count")
        .single();
      if (error || !data) {
        setError("Couldn’t post right now. Try again.");
        return;
      }

      const row = data as unknown as InsertRow;
      const created: Confession = normalizeConfession({
        id: row.id,
        createdAt: Date.parse(row.created_at),
        text: row.body,
        schoolId: row.school_id,
        views: row.views_count,
        likes: row.likes_count ?? 0,
        liked: false,
      });

      setConfessions((prev) => [created, ...prev].slice(0, MAX_CONFESSIONS_IN_MEMORY));
      setText("");
      textareaRef.current?.focus();
      document.getElementById("feed")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      setIsPosting(false);
    }
  }

  async function toggleLike(id: string) {
    if (!supabase) {
      setConfessions((prev) => {
        const updated = prev.map((c) => {
          if (c.id !== id) return c;
          const likes = typeof c.likes === "number" ? c.likes : 0;
          const liked = Boolean(c.liked);
          return liked
            ? { ...c, liked: false, likes: Math.max(0, likes - 1) }
            : { ...c, liked: true, likes: likes + 1 };
        });
        saveToStorage(updated);
        return updated;
      });
      return;
    }
    const currentlyLiked = Boolean(confessions.find((c) => c.id === id)?.liked);
    const delta = currentlyLiked ? -1 : 1;

    // Update local "liked" set (anonymous, per-browser).
    const likedSet = loadLikedSet();
    if (currentlyLiked) likedSet.delete(id);
    else likedSet.add(id);
    saveLikedSet(likedSet);

    // Optimistic UI update (keep imageDataUrl intact).
    setConfessions((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const likes = typeof c.likes === "number" ? c.likes : 0;
        return {
          ...c,
          liked: !currentlyLiked,
          likes: Math.max(0, likes + delta),
        };
      }),
    );

    // Server update: prefer RPC if you added it, else fall back to non-atomic update.
    const rpc = await supabase.rpc("increment_confession_likes", {
      p_confession_id: id,
      p_delta: delta,
    });
    if (rpc.error) {
      const currentLikes = confessions.find((c) => c.id === id)?.likes ?? 0;
      const nextLikes = Math.max(0, currentLikes + delta);
      const upd = await supabase.from("confessions").update({ likes_count: nextLikes }).eq("id", id);
      if (upd.error) {
        setError("Likes need a small DB update. I’ll send you the SQL to add likes_count + RPC.");
      }
    }
  }

  return (
    <div className="space-y-8">
      {/* Hidden template used to render a confession into an image */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-[-10000px] top-0"
      >
        <div
          ref={imageTemplateRef}
          className="relative bg-white"
          style={{
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            fontFamily: '"Lucida Grande", "Helvetica Neue", Helvetica, Arial, sans-serif',
          }}
        >
          <div className="absolute left-8 top-7 font-medium tracking-tight text-black/50" style={{ fontSize: 28 }}>
            uc-confessions
          </div>
          <div className="absolute right-8 top-7 font-medium tracking-tight text-black/50" style={{ fontSize: 28 }}>
            {renderJob?.schoolId ? schoolIdToLabel(renderJob.schoolId) : schoolIdToLabel(DEFAULT_SCHOOL_ID)}
          </div>

          <div className="flex h-full w-full items-center justify-center px-20 py-20">
            <div className="w-full max-w-[780px]">
              <p
                className="whitespace-pre-wrap text-center font-normal leading-[1.26] text-black"
                style={{ fontSize: fontSizeFor(renderJob?.text ?? "") }}
              >
                {renderJob?.text ?? ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      <section
        id="post"
        className="w-full overflow-hidden rounded border border-[#dddfe2] bg-white shadow-sm"
        style={{ fontFamily: '"Lucida Grande", "Helvetica Neue", Helvetica, Arial, sans-serif' }}
      >
        <textarea
          ref={textareaRef}
          aria-label="Write a confession"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canPost) void submit();
          }}
          rows={3}
          placeholder="What's on your mind?"
          className="w-full resize-none bg-white px-3 py-2.5 text-[13px] leading-5 text-[#1c1e21] outline-none placeholder:text-[#65676b]"
        />

        <div className="flex items-center justify-between gap-3 border-t border-[#dddfe2] bg-[#f0f2f5] px-3 py-2">
          <div className="flex items-center gap-3">
            <div className="text-[12px] tabular-nums text-[#65676b]">
              {text.length}/{MAX_CHARS}
            </div>
            <label className="flex items-center gap-2 text-[12px] text-[#65676b]">
              <span>Tag</span>
              <select
                value={schoolId}
                onChange={(e) => {
                  const next = e.target.value as SchoolId;
                  setSchoolId(next);
                  onSelectTag(next);
                }}
                className="h-7 rounded border border-[#dddfe2] bg-white px-2 text-[12px] text-[#1c1e21] outline-none focus:border-[#3b5998] focus:ring-1 focus:ring-[#3b5998]"
              >
                {SCHOOL_TAGS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canPost || isPosting}
            className="inline-flex h-8 items-center justify-center rounded bg-[#3b5998] px-4 text-[13px] font-bold text-white hover:bg-[#2d4373] active:bg-[#2d4373] focus:outline-none focus:ring-2 focus:ring-[#3b5998] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPosting ? "Posting…" : "Share"}
          </button>
        </div>

        {error ? (
          <div className="border-t border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        ) : null}
      </section>

      <section id="feed" className="space-y-3">
        <div
          className="rounded border border-[#dddfe2] bg-white px-3 py-2.5 shadow-sm"
          style={{ fontFamily: '"Lucida Grande", "Helvetica Neue", Helvetica, Arial, sans-serif' }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-[14px] font-bold text-[#1c1e21]">Confessions</h2>
              <p className="text-[12px] text-[#65676b]">
                {displayedVisible.length} confession{displayedVisible.length === 1 ? "" : "s"}
                {activeTag === "all" ? "" : ` · ${schoolIdToLabel(activeTag)}`}
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 border-t border-[#e4e6eb] pt-2 text-[12px]">
            {(["new", "old", "top"] as const).map((sort, i) => (
              <span key={sort} className="flex items-center gap-2">
                {i > 0 ? <span className="text-[#bcc0c4]">|</span> : null}
                <button
                  type="button"
                  onClick={() => setFeedSort(sort)}
                  className={`capitalize ${
                    feedSort === sort
                      ? "font-bold text-[#1c1e21] underline"
                      : "text-[#65676b] hover:text-[#1c1e21] hover:underline"
                  }`}
                >
                  {sort}
                </button>
              </span>
            ))}
          </div>
        </div>

        {displayedVisible.length === 0 ? (
          <div className="rounded border border-[#dddfe2] border-dashed bg-white p-6 text-[13px] text-[#65676b] shadow-sm">
            {sorted.length === 0 ? (
              <>No confessions yet. Be the first to share.</>
            ) : (
              <div className="space-y-2">
                <div>No posts for {activeTag}. Try another school.</div>
                <button
                  type="button"
                  onClick={() => onSelectTag("all")}
                  className="text-[12px] font-bold text-[#3b5998] hover:underline"
                >
                  Show all
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
          <ul className="space-y-4">
            {displayedVisible.map((c) => (
              <li
                key={c.id}
                className="mx-auto w-full max-w-[340px] overflow-hidden sm:max-w-[360px]"
              >
                <div
                  className="overflow-hidden rounded border border-[#dddfe2] bg-white shadow-sm"
                  style={{ fontFamily: '"Lucida Grande", "Helvetica Neue", Helvetica, Arial, sans-serif' }}
                >
                  {c.imageDataUrl ? (
                    <>
                      <Link
                        href={`/confession/${c.id}`}
                        className="block cursor-pointer"
                      >
                        <img
                          src={c.imageDataUrl}
                          alt="Confession"
                          className="block w-full bg-white"
                          style={{ aspectRatio: `${CARD_WIDTH} / ${CARD_HEIGHT}` }}
                        />
                      </Link>

                      <div className="flex items-center justify-between border-t border-[#dddfe2] bg-[#f0f2f5] px-3 py-2 text-[12px] text-[#65676b]">
                        <button
                          type="button"
                          onClick={() => void toggleLike(c.id)}
                          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[#1c1e21] hover:bg-[#e4e6eb]"
                          aria-pressed={Boolean(c.liked)}
                        >
                          <span className="font-medium text-[#1c1e21]">{c.liked ? "Unlike" : "Like"}</span>
                          <span className="tabular-nums text-[#65676b]">
                            {formatCount(typeof c.likes === "number" ? c.likes : 0)}
                          </span>
                        </button>

                        <div className="flex items-center gap-2 pr-1 tabular-nums text-[#65676b]">
                          <span>·</span>
                          <span>{formatCount(typeof c.views === "number" ? c.views : 0)} views</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <Link href={`/confession/${c.id}`} className="block p-3 text-[13px] text-[#65676b] hover:bg-[#f0f2f5]">
                      Rendering image…
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {((supabase && hasMore) || (!supabase && displayCount < visible.length)) ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="rounded border border-[#dddfe2] bg-white px-4 py-2 text-[13px] font-medium text-[#1c1e21] shadow-sm hover:bg-[#f0f2f5] disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
          </>
        )}
      </section>
    </div>
  );
}

