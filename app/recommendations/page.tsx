"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import AuthGuard from "@/app/components/AuthGuard";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Put your TMDB API key in .env.local as NEXT_PUBLIC_TMDB_KEY ───
// Get one free at: https://www.themoviedb.org/settings/api
const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_KEY ?? "";

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

interface Recommendation {
  id: number;
  full_name: string;
  type: string;
  title: string | null;
  creator: string | null;
  image_url: string;
  created_at?: string;
  likes: number;       // flattened from recommendation_likes
  liked_by_me: boolean; // optimistic like state
}

interface SearchResult {
  title: string;
  creator: string;
  image_url: string;
}

type MediaType = "book" | "movie" | "song";
type SortMode = "new" | "popular";
type WizardStep = "type" | "search" | "confirm";

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function getAvatarUrl(name?: string | null) {
  if (!name) return "/default-avatar.jpg";
  const fileName = name.toLowerCase().replaceAll(" ", "-") + ".jpg";
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`;
}

function firstName(name?: string | null) {
  if (!name) return "?";
  return name.split(" ")[0];
}

const TYPE_CONFIG: Record<MediaType, { label: string; emoji: string; color: string; bg: string }> = {
  book:  { label: "Book",  emoji: "📖", color: "#92400e", bg: "#fef3c7" },
  movie: { label: "Movie", emoji: "🎞️", color: "#1e3a8a", bg: "#dbeafe" },
  song:  { label: "Song",  emoji: "🎵", color: "#065f46", bg: "#d1fae5" },
};

// ────────────────────────────────────────────────────────────────────
// API Search Functions
// ────────────────────────────────────────────────────────────────────

async function searchBooks(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const res = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=12&fields=key,title,author_name,cover_i`
  );
  const json = await res.json();
  return (json.docs || [])
    .filter((d: any) => d.cover_i)
    .slice(0, 9)
    .map((d: any) => ({
      title: d.title,
      creator: d.author_name?.[0] ?? "Unknown Author",
      image_url: `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`,
    }));
}

async function searchMovies(query: string): Promise<SearchResult[]> {
  if (!query.trim() || !TMDB_KEY) return [];
  const res = await fetch(
    `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&page=1`
  );
  const json = await res.json();
  return (json.results || [])
    .filter((d: any) => d.poster_path)
    .slice(0, 9)
    .map((d: any) => ({
      title: d.title,
      creator: d.release_date?.split("-")[0] ?? "",
      image_url: `https://image.tmdb.org/t/p/w300${d.poster_path}`,
    }));
}

async function searchSongs(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const res = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=12&entity=song`
  );
  const json = await res.json();
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const d of json.results || []) {
    const key = `${d.trackName}__${d.artistName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      title: d.trackName,
      creator: d.artistName,
      image_url: d.artworkUrl100.replace("100x100", "300x300"),
    });
    if (results.length >= 9) break;
  }
  return results;
}

async function searchMedia(type: MediaType, query: string): Promise<SearchResult[]> {
  if (type === "book")  return searchBooks(query);
  if (type === "movie") return searchMovies(query);
  return searchSongs(query);
}

// ────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type as MediaType] ?? { emoji: "?", color: "#666", bg: "#eee" };
  return (
    <span
      className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.emoji}
    </span>
  );
}

function HeartButton({
  liked,
  count,
  onClick,
}: {
  liked: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-xs transition-all duration-150 select-none"
      style={{
        color: liked ? "#e11d48" : "#9ca3af",
        fontWeight: liked ? 700 : 400,
        transform: liked ? "scale(1.1)" : "scale(1)",
      }}
      aria-label={liked ? "Unlike" : "Like"}
    >
      <span style={{ fontSize: "15px" }}>{liked ? "❤️" : "🤍"}</span>
      <span>{count}</span>
    </button>
  );
}

function RecommendationCard({
  rec,
  onLike,
}: {
  rec: Recommendation;
  onLike: (id: number) => void;
}) {
  const cfg = TYPE_CONFIG[rec.type as MediaType] ?? { bg: "#f3f4f6", color: "#111" };

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col"
      style={{ border: "1px solid #f0f0f0" }}
    >
      {/* Cover art */}
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        <img
          src={rec.image_url}
          alt={rec.title ?? "cover"}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='300' height='300' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='48'%3E📷%3C/text%3E%3C/svg%3E";
          }}
        />
        <TypeBadge type={rec.type} />
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        {rec.title && (
          <div className="text-xs font-semibold leading-tight line-clamp-2" style={{ color: "#111" }}>
            {rec.title}
          </div>
        )}
        {rec.creator && (
          <div className="text-xs text-gray-400 leading-tight line-clamp-1">
            {rec.creator}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-2">
          <div className="flex items-center gap-1.5">
            <img
              src={getAvatarUrl(rec.full_name)}
              alt={rec.full_name}
              className="w-5 h-5 rounded-full object-cover"
            />
            <span className="text-[10px] text-gray-400">{firstName(rec.full_name)}</span>
          </div>
          <HeartButton
            liked={rec.liked_by_me}
            count={rec.likes}
            onClick={() => onLike(rec.id)}
          />
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Add Recommendation Wizard
// ────────────────────────────────────────────────────────────────────

function AddWizard({
  onClose,
  onSaved,
  currentUserId,
  currentUserName,
}: {
  onClose: () => void;
  onSaved: (rec: Recommendation) => void;
  currentUserId: string;
  currentUserName: string;
}) {
  const [step, setStep] = useState<WizardStep>("type");
  const [mediaType, setMediaType] = useState<MediaType>("book");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [noKey, setNoKey] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Warn if TMDB key missing when movie selected
  useEffect(() => {
    setNoKey(mediaType === "movie" && !TMDB_KEY);
  }, [mediaType]);

  // Debounced search
  useEffect(() => {
    if (step !== "search") return;
    if (!query.trim()) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const res = await searchMedia(mediaType, query);
      setResults(res);
      setSearching(false);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, mediaType, step]);

  const handleSelect = (result: SearchResult) => {
    setSelected(result);
    setStep("confirm");
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", currentUserId)
      .single();

    const fullName = profile?.full_name ?? currentUserName;

    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email ?? "";

    const { data, error } = await supabase
      .from("recommendations")
      .insert({
        type: mediaType,
        title: selected.title,
        creator: selected.creator || null,
        image_url: selected.image_url,
        approved: true,
        full_name: fullName,
        email,
        submission_date: new Date().toISOString().split("T")[0],
      })
      .select()
      .single();

    setSaving(false);

    if (error || !data) {
      alert("Something went wrong saving your recommendation. Please try again.");
      return;
    }

    onSaved({
      ...data,
      likes: 0,
      liked_by_me: false,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
        style={{ maxHeight: "85vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div>
            <div className="text-lg font-bold text-gray-900">
              {step === "type"    && "What are you sharing?"}
              {step === "search"  && `Search for a ${TYPE_CONFIG[mediaType].label}`}
              {step === "confirm" && "Looks good?"}
            </div>
            {/* Step dots */}
            <div className="flex gap-1.5 mt-2">
              {(["type", "search", "confirm"] as WizardStep[]).map((s, i) => (
                <div
                  key={s}
                  className="rounded-full transition-all"
                  style={{
                    width: step === s ? 20 : 6,
                    height: 6,
                    background: step === s ? "#111" : "#d1d5db",
                  }}
                />
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">

          {/* STEP 1 — Type */}
          {step === "type" && (
            <div className="grid grid-cols-3 gap-3 pt-2">
              {(Object.entries(TYPE_CONFIG) as [MediaType, typeof TYPE_CONFIG[MediaType]][]).map(
                ([type, cfg]) => (
                  <button
                    key={type}
                    onClick={() => { setMediaType(type); setQuery(""); setResults([]); setStep("search"); }}
                    className="flex flex-col items-center gap-3 py-8 rounded-2xl border-2 transition-all hover:scale-105"
                    style={{
                      borderColor: cfg.bg,
                      background: cfg.bg,
                    }}
                  >
                    <span style={{ fontSize: 40 }}>{cfg.emoji}</span>
                    <span className="text-sm font-semibold" style={{ color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </button>
                )
              )}
            </div>
          )}

          {/* STEP 2 — Search */}
          {step === "search" && (
            <div className="space-y-4 pt-2">
              {noKey && (
                <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3">
                  ⚠️ <strong>TMDB API key missing.</strong> Add <code>NEXT_PUBLIC_TMDB_KEY</code> to your{" "}
                  <code>.env.local</code> file. Get a free key at{" "}
                  <a
                    href="https://www.themoviedb.org/settings/api"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    themoviedb.org
                  </a>
                  .
                </div>
              )}

              <div className="relative">
                <input
                  autoFocus
                  type="text"
                  placeholder={`Type a ${TYPE_CONFIG[mediaType].label.toLowerCase()} title…`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-900 transition"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm animate-pulse">
                    Searching…
                  </div>
                )}
              </div>

              {results.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {results.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelect(r)}
                      className="group relative rounded-xl overflow-hidden aspect-square bg-gray-100 hover:ring-2 hover:ring-gray-900 transition-all"
                      title={`${r.title} — ${r.creator}`}
                    >
                      <img
                        src={r.image_url}
                        alt={r.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                        <div className="text-white text-[10px] font-semibold leading-tight line-clamp-2">
                          {r.title}
                        </div>
                        <div className="text-white/70 text-[9px] line-clamp-1">{r.creator}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {query.trim() && !searching && results.length === 0 && (
                <div className="text-center text-sm text-gray-400 py-6">
                  No results found. Try a different search.
                </div>
              )}

              <button
                onClick={() => setStep("type")}
                className="text-sm text-gray-400 hover:text-gray-700 transition"
              >
                ← Back
              </button>
            </div>
          )}

          {/* STEP 3 — Confirm */}
          {step === "confirm" && selected && (
            <div className="space-y-5 pt-2">
              <div className="flex gap-4 items-start">
                <img
                  src={selected.image_url}
                  alt={selected.title}
                  className="w-24 h-24 object-cover rounded-xl shadow"
                />
                <div className="flex-1 pt-1 space-y-1">
                  <div className="font-semibold text-gray-900 leading-tight">
                    {selected.title}
                  </div>
                  <div className="text-sm text-gray-500">{selected.creator}</div>
                  <div
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium mt-1"
                    style={{
                      background: TYPE_CONFIG[mediaType].bg,
                      color: TYPE_CONFIG[mediaType].color,
                    }}
                  >
                    {TYPE_CONFIG[mediaType].emoji} {TYPE_CONFIG[mediaType].label}
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-500">
                This will appear in the Recommendations board for your whole family to see.
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("search")}
                  className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:border-gray-400 transition"
                >
                  ← Change
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-2 flex-1 py-3 rounded-xl text-sm font-bold text-white transition"
                  style={{ background: saving ? "#9ca3af" : "#111", cursor: saving ? "wait" : "pointer" }}
                >
                  {saving ? "Saving…" : "Share it! 🎉"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────────────

export default function RecommendationsPage() {
  const [rows, setRows] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [sortMode, setSortMode] = useState<SortMode>("new");
  const [showWizard, setShowWizard] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());

  // Load current user + their likes
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("email", user.email)
        .single();

      setCurrentUser({ id: user.id, name: profile?.full_name ?? "" });

      // Load this user's likes
      const { data: myLikes } = await supabase
        .from("recommendation_likes")
        .select("recommendation_id")
        .eq("user_id", user.id);

      setLikedIds(new Set((myLikes ?? []).map((l: any) => l.recommendation_id)));
    };
    init();
  }, []);

  // Load recommendations
  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("recommendations")
      .select(`id, full_name, type, title, creator, image_url, created_at, recommendation_likes(count)`)
      .eq("approved", true)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const mapped: Recommendation[] = data.map((r: any) => ({
        ...r,
        likes: r.recommendation_likes?.[0]?.count ?? 0,
        liked_by_me: likedIds.has(r.id),
      }));
      setRows(mapped);
    }
    setLoading(false);
  }, [likedIds]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  // Optimistic like toggle
  const handleLike = async (recId: number) => {
    if (!currentUser) return;

    const alreadyLiked = likedIds.has(recId);

    // Optimistic update
    setLikedIds((prev) => {
      const next = new Set(prev);
      alreadyLiked ? next.delete(recId) : next.add(recId);
      return next;
    });

    setRows((prev) =>
      prev.map((r) =>
        r.id === recId
          ? { ...r, liked_by_me: !alreadyLiked, likes: r.likes + (alreadyLiked ? -1 : 1) }
          : r
      )
    );

    // Sync with DB
    if (alreadyLiked) {
      await supabase
        .from("recommendation_likes")
        .delete()
        .eq("user_id", currentUser.id)
        .eq("recommendation_id", recId);
    } else {
      await supabase
        .from("recommendation_likes")
        .insert({ user_id: currentUser.id, recommendation_id: recId });
    }
  };

  const handleSaved = (rec: Recommendation) => {
    setRows((prev) => [rec, ...prev]);
  };

  const users = useMemo(() => Array.from(new Set(rows.map((r) => r.full_name))), [rows]);

  const filtered = useMemo(() => {
    let result = rows.filter((r) => {
      if (selectedType !== "all" && r.type !== selectedType) return false;
      if (selectedUser !== "all" && r.full_name !== selectedUser) return false;
      return true;
    });
    if (sortMode === "popular") {
      result = [...result].sort((a, b) => b.likes - a.likes);
    }
    return result;
  }, [rows, selectedType, selectedUser, sortMode]);

  // Stats for the header
  const stats = useMemo(() => ({
    books:  rows.filter((r) => r.type === "book").length,
    movies: rows.filter((r) => r.type === "movie").length,
    songs:  rows.filter((r) => r.type === "song").length,
    total:  rows.length,
  }), [rows]);

  return (
    <AuthGuard>
      {showWizard && currentUser && (
        <AddWizard
          onClose={() => setShowWizard(false)}
          onSaved={handleSaved}
          currentUserId={currentUser.id}
          currentUserName={currentUser.name}
        />
      )}

      <div className="max-w-6xl mx-auto py-12 px-4 space-y-10">

        {/* ── Header ── */}
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold tracking-tight" style={{ color: "#111" }}>
            Recommendations
          </h1>
          <p className="text-gray-400 text-sm">
            {stats.total} picks from the family
            {stats.total > 0 && ` · ${stats.books} books · ${stats.movies} movies · ${stats.songs} songs`}
          </p>
        </div>

        {/* ── Add button ── */}
        <div className="flex justify-center">
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-white shadow-lg transition hover:scale-105 active:scale-95"
            style={{ background: "#111" }}
          >
            <span style={{ fontSize: 18 }}>+</span> Share a recommendation
          </button>
        </div>

        {/* ── Sort + Type filter ── */}
        <div className="flex flex-wrap justify-center gap-3">
          {/* Sort */}
          <div
            className="flex rounded-full p-1"
            style={{ background: "#f3f4f6" }}
          >
            {(["new", "popular"] as SortMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
                style={{
                  background: sortMode === mode ? "#111" : "transparent",
                  color: sortMode === mode ? "#fff" : "#6b7280",
                }}
              >
                {mode === "new" ? "✨ New" : "❤️ Most Loved"}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <div
            className="flex rounded-full p-1"
            style={{ background: "#f3f4f6" }}
          >
            <button
              onClick={() => setSelectedType("all")}
              className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
              style={{
                background: selectedType === "all" ? "#111" : "transparent",
                color: selectedType === "all" ? "#fff" : "#6b7280",
              }}
            >
              All
            </button>
            {(Object.entries(TYPE_CONFIG) as [MediaType, typeof TYPE_CONFIG[MediaType]][]).map(
              ([type, cfg]) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
                  style={{
                    background: selectedType === type ? "#111" : "transparent",
                    color: selectedType === type ? "#fff" : "#6b7280",
                  }}
                >
                  {cfg.emoji} {cfg.label}s
                </button>
              )
            )}
          </div>
        </div>

        {/* ── User filter ── */}
        <div className="flex flex-wrap justify-center gap-3 items-center">
          <button
            onClick={() => setSelectedUser("all")}
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all border-2"
            style={{
              borderColor: selectedUser === "all" ? "#111" : "#e5e7eb",
              background: selectedUser === "all" ? "#111" : "white",
              color: selectedUser === "all" ? "#fff" : "#374151",
            }}
          >
            Everyone
          </button>
          {users.map((user) => (
            <button
              key={user}
              onClick={() => setSelectedUser(user)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-all border-2"
              style={{
                borderColor: selectedUser === user ? "#111" : "#e5e7eb",
                background: selectedUser === user ? "#111" : "white",
                color: selectedUser === user ? "#fff" : "#374151",
              }}
            >
              <img
                src={getAvatarUrl(user)}
                alt={user}
                className="w-5 h-5 rounded-full object-cover"
              />
              {firstName(user)}
            </button>
          ))}
        </div>

        {/* ── Grid ── */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl bg-gray-100 animate-pulse"
                style={{ aspectRatio: "1 / 1.4" }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-gray-400 space-y-2">
            <div style={{ fontSize: 48 }}>🔍</div>
            <div className="text-lg font-medium">Nothing here yet</div>
            <div className="text-sm">Be the first to share a recommendation!</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filtered.map((rec, i) => (
              <div
                key={rec.id}
                style={{
                  animation: "fadeUp 0.3s ease both",
                  animationDelay: `${Math.min(i, 18) * 35}ms`,
                }}
              >
                <RecommendationCard rec={rec} onLike={handleLike} />
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </AuthGuard>
  );
}
