"use client";

import { SiteHeader } from "@/components/SiteHeader";
import { DEFAULT_SCHOOL_ID, schoolIdToLabel, type SchoolId } from "@/lib/schools";
import { supabase } from "@/lib/supabaseClient";
import { isValidUuid } from "@/lib/security";
import { toJpeg } from "html-to-image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const CARD_WIDTH = 900;
const CARD_HEIGHT = 900;

function fontSizeFor(text: string) {
  const len = text.trim().length;
  if (len > 420) return 36;
  if (len > 320) return 40;
  if (len > 240) return 46;
  if (len > 160) return 52;
  return 58;
}

type Confession = {
  id: string;
  createdAt: number;
  text: string;
  schoolId?: SchoolId;
  views?: number;
  likes?: number;
  liked?: boolean;
};

const LIKED_KEY = "ucr_confessions_liked_v1";
const STORAGE_KEY = "ucr_confessions_v7";

function loadLikedSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(LIKED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function saveLikedSet(set: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LIKED_KEY, JSON.stringify([...set]));
}

function loadFromStorage(): Confession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Confession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatCount(n: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact" }).format(n);
}

export function ConfessionPageClient({ id }: { id: string }) {
  const [confession, setConfession] = useState<Confession | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const imageTemplateRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!id || !isValidUuid(id)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    if (supabase) {
      type Row = {
        id: string;
        created_at: string;
        body: string;
        school_id: SchoolId;
        views_count: number;
        likes_count?: number;
      };
      const { data, error } = await supabase
        .from("confessions")
        .select("id, created_at, body, school_id, views_count, likes_count")
        .eq("id", id)
        .single();

      if (error || !data) {
        const fromStorage = loadFromStorage().find((c) => c.id === id);
        if (fromStorage) {
          const likedSet = loadLikedSet();
          setConfession({
            ...fromStorage,
            liked: likedSet.has(fromStorage.id),
            schoolId: fromStorage.schoolId ?? DEFAULT_SCHOOL_ID,
          });
        } else {
          setNotFound(true);
        }
        setLoading(false);
        return;
      }

      const row = data as unknown as Row;
      const likedSet = loadLikedSet();
      setConfession({
        id: row.id,
        createdAt: Date.parse(row.created_at),
        text: row.body,
        schoolId: row.school_id ?? DEFAULT_SCHOOL_ID,
        views: row.views_count ?? 0,
        likes: row.likes_count ?? 0,
        liked: likedSet.has(row.id),
      });

      await supabase.rpc("increment_confession_views", { p_confession_id: id }).then(() => {
        setConfession((prev) =>
          prev ? { ...prev, views: (prev.views ?? 0) + 1 } : prev,
        );
      });
    } else {
      const fromStorage = loadFromStorage().find((c) => c.id === id);
      if (fromStorage) {
        const likedSet = loadLikedSet();
        setConfession({
          ...fromStorage,
          liked: likedSet.has(fromStorage.id),
          schoolId: fromStorage.schoolId ?? DEFAULT_SCHOOL_ID,
        });
      } else {
        setNotFound(true);
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Optional: try to generate card image in background (homepage does this; single-post shows text if it fails)
  useEffect(() => {
    if (!confession) return;
    let cancelled = false;
    const TIMEOUT_MS = 10000;
    (async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      await new Promise<void>((r) => setTimeout(r, 200));
      if (cancelled) return;
      const node = imageTemplateRef.current;
      if (!node) return;
      try {
        const dataUrl = await Promise.race([
          toJpeg(node, { quality: 0.85, cacheBust: true, pixelRatio: 1.5, backgroundColor: "#ffffff" }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
        ]);
        if (!cancelled) setImageDataUrl(dataUrl);
      } catch {
        // keep showing text card
      }
    })();
    return () => { cancelled = true; };
  }, [confession?.id, confession?.text, confession?.schoolId]);

  async function toggleLike() {
    if (!confession) return;
    const c = confession;
    if (!supabase) {
      const likedSet = loadLikedSet();
      if (c.liked) likedSet.delete(c.id);
      else likedSet.add(c.id);
      saveLikedSet(likedSet);
      setConfession((prev) =>
        prev
          ? {
              ...prev,
              liked: !prev.liked,
              likes: Math.max(0, (prev.likes ?? 0) + (prev.liked ? -1 : 1)),
            }
          : prev,
      );
      return;
    }
    const delta = c.liked ? -1 : 1;
    const likedSet = loadLikedSet();
    if (c.liked) likedSet.delete(c.id);
    else likedSet.add(c.id);
    saveLikedSet(likedSet);
    setConfession((prev) =>
      prev
        ? { ...prev, liked: !prev.liked, likes: Math.max(0, (prev.likes ?? 0) + delta) }
        : prev,
    );
    const rpc = await supabase.rpc("increment_confession_likes", {
      p_confession_id: c.id,
      p_delta: delta,
    });
    if (rpc.error) {
      await supabase
        .from("confessions")
        .update({ likes_count: Math.max(0, (c.likes ?? 0) + delta) })
        .eq("id", c.id);
    }
  }

  if (loading) {
    return (
      <>
        <SiteHeader />
        <div
          className="flex min-h-[60vh] items-center justify-center bg-[#e9eaed] text-[#65676b]"
          style={{ fontFamily: '"Lucida Grande", "Helvetica Neue", Helvetica, Arial, sans-serif' }}
        >
          Loading…
        </div>
      </>
    );
  }

  if (notFound || !confession) {
    return (
      <>
        <SiteHeader />
        <div
          className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-[#e9eaed] px-4"
          style={{ fontFamily: '"Lucida Grande", "Helvetica Neue", Helvetica, Arial, sans-serif' }}
        >
          <p className="text-[#1c1e21]">Post not found.</p>
          <Link
            href="/"
            className="text-[#3b5998] hover:underline"
          >
            ← Back to feed
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <div
        className="min-h-dvh bg-[#e9eaed] px-4 py-8"
        style={{ fontFamily: '"Lucida Grande", "Helvetica Neue", Helvetica, Arial, sans-serif' }}
      >
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
              {schoolIdToLabel(confession.schoolId ?? DEFAULT_SCHOOL_ID)}
            </div>
            <div className="flex h-full w-full items-center justify-center px-20 py-20">
              <div className="w-full max-w-[780px]">
                <p
                  className="whitespace-pre-wrap text-center font-normal leading-[1.26] text-black"
                  style={{ fontSize: fontSizeFor(confession.text) }}
                >
                  {confession.text}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[420px]">
          <Link
            href="/"
            className="mb-4 inline-block text-[13px] text-[#3b5998] hover:underline"
          >
            ← Back to feed
          </Link>
          <div className="overflow-hidden rounded border border-[#dddfe2] bg-white shadow-sm">
            {imageDataUrl ? (
              <img
                src={imageDataUrl}
                alt="Confession"
                className="block w-full bg-white"
                style={{ aspectRatio: `${CARD_WIDTH} / ${CARD_HEIGHT}` }}
              />
            ) : (
              <div className="border-b border-[#dddfe2] bg-white px-4 py-3">
                <div className="mb-2 flex items-center justify-between text-[12px] text-[#65676b]">
                  <span>uc-confessions</span>
                  <span>{schoolIdToLabel(confession.schoolId ?? DEFAULT_SCHOOL_ID)}</span>
                </div>
                <div className="min-h-[200px] whitespace-pre-wrap text-[15px] leading-relaxed text-[#1c1e21]">
                  {confession.text}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-[#dddfe2] bg-[#f0f2f5] px-4 py-2 text-[12px] text-[#65676b]">
              <button
                type="button"
                onClick={() => void toggleLike()}
                className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[#1c1e21] hover:bg-[#e4e6eb]"
              >
                <span className="font-medium">{confession.liked ? "Unlike" : "Like"}</span>
                <span className="tabular-nums">{formatCount(confession.likes ?? 0)}</span>
              </button>
              <span className="tabular-nums">{formatCount(confession.views ?? 0)} views</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
