"use client";

import { useEffect, useState, useCallback } from "react";
import AuthGuard from "@/app/components/AuthGuard";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  full_name: string;
  email: string;
}

interface Streak {
  id: number;
  created_at: string;
  title: string;
  description: string | null;
  type: "daily" | "weekly";
  created_by_name: string;
  created_by_email: string;
}

interface StreakParticipant {
  id: number;
  created_at: string;
  streak_id: number;
  full_name: string;
  email: string;
}

interface CurrentUser {
  id: string;
  full_name: string;
  email: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAvatarUrl(name: string) {
  const fileName = name.toLowerCase().replaceAll(" ", "-") + ".jpg";
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`;
}

function firstName(name: string) {
  return name?.split(" ")[0] ?? name;
}

function daysRunning(createdAt: string) {
  const diff = Date.now() - new Date(createdAt).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Started today";
  if (days === 1) return "1 day running";
  return `${days} days running`;
}

function weeksRunning(createdAt: string) {
  const diff = Date.now() - new Date(createdAt).getTime();
  const weeks = Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
  if (weeks === 0) return "Started this week";
  if (weeks === 1) return "1 week running";
  return `${weeks} weeks running`;
}

// ─── Create Streak Modal ──────────────────────────────────────────────────────

function CreateStreakModal({
  currentUser,
  onClose,
  onCreated,
}: {
  currentUser: CurrentUser;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"daily" | "weekly">("daily");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!title.trim()) { setError("Please give your streak a title."); return; }
    setSaving(true);
    setError("");

    const { error: insertError } = await supabase
      .from("streaks")
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        type,
        created_by_name: currentUser.full_name,
        created_by_email: currentUser.email,
      });

    setSaving(false);
    if (insertError) { setError("Something went wrong. Please try again."); return; }
    onCreated();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="px-6 py-5" style={{ background: "linear-gradient(135deg, #111827, #1f2937)" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-black text-white">Start a Streak</div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                Anyone can join once it&rsquo;s live
              </div>
            </div>
            <button onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition">
              &#x2715;
            </button>
          </div>
        </div>

        <div className="px-6 py-6 space-y-5">
          {/* Type toggle */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Frequency</div>
            <div className="flex rounded-2xl p-1 gap-1" style={{ background: "#f3f4f6" }}>
              {(["daily", "weekly"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all capitalize"
                  style={{
                    background: type === t ? "#111" : "transparent",
                    color: type === t ? "#fff" : "#6b7280",
                  }}
                >
                  {t === "daily" ? "🔥 Daily" : "📅 Weekly"}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              What&rsquo;s the streak?
            </div>
            <input
              autoFocus
              type="text"
              placeholder={type === "daily" ? "e.g. Walk 10,000 steps a day" : "e.g. Draw one drawing a week"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="w-full border-2 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-900 transition"
              style={{ borderColor: "#e5e7eb" }}
            />
          </div>

          {/* Description */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              Details <span className="normal-case font-normal">(optional)</span>
            </div>
            <textarea
              placeholder="Any extra details or rules..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border-2 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-900 transition resize-none"
              style={{ borderColor: "#e5e7eb" }}
            />
          </div>

          {error && (
            <div className="text-xs text-red-500 font-medium">{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl border-2 text-sm font-bold text-gray-600 hover:border-gray-400 transition"
              style={{ borderColor: "#e5e7eb" }}>
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition"
              style={{ background: saving ? "#9ca3af" : "linear-gradient(135deg, #f59e0b, #ef4444)", cursor: saving ? "wait" : "pointer" }}
            >
              {saving ? "Starting..." : "🔥 Start it!"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Streak Card ──────────────────────────────────────────────────────────────

function StreakCard({
  streak,
  participants,
  currentUser,
  onRefresh,
}: {
  streak: Streak;
  participants: StreakParticipant[];
  currentUser: CurrentUser;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const isParticipant = participants.some((p) => p.email === currentUser.email);
  const isCreator = streak.created_by_email === currentUser.email;
  const runningLabel = streak.type === "daily" ? daysRunning(streak.created_at) : weeksRunning(streak.created_at);

  const handleJoin = async () => {
    setBusy(true);
    await supabase.from("streak_participants").insert({
      streak_id: streak.id,
      full_name: currentUser.full_name,
      email: currentUser.email,
    });
    await onRefresh();
    setBusy(false);
  };

  const handleDead = async () => {
    setBusy(true);
    await supabase
      .from("streak_participants")
      .delete()
      .eq("streak_id", streak.id)
      .eq("email", currentUser.email);
    await onRefresh();
    setBusy(false);
  };

  const handleDeleteStreak = async () => {
    if (!confirm(`Delete "${streak.title}"? This can't be undone.`)) return;
    setBusy(true);
    await supabase.from("streaks").delete().eq("id", streak.id);
    await onRefresh();
    setBusy(false);
  };

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{ background: "white", border: "1px solid #f0f0f0", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
    >
      {/* Card header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black text-gray-900 leading-tight">{streak.title}</h3>
            {streak.description && (
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{streak.description}</p>
            )}
          </div>
          {/* Running counter badge */}
          <div
            className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ background: streak.type === "daily" ? "#fff7ed" : "#f0fdf4", color: streak.type === "daily" ? "#c2410c" : "#15803d" }}
          >
            {streak.type === "daily" ? "🔥" : "📅"} {runningLabel}
          </div>
        </div>

        {/* Started by */}
        <div className="flex items-center gap-1.5 mt-2">
          <img
            src={getAvatarUrl(streak.created_by_name)}
            alt={streak.created_by_name}
            className="w-4 h-4 rounded-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          <span className="text-[11px] text-gray-400">
            Started by <span className="font-semibold text-gray-500">{firstName(streak.created_by_name)}</span>
          </span>
          {isCreator && (
            <button
              onClick={handleDeleteStreak}
              disabled={busy}
              className="ml-auto text-[10px] text-gray-300 hover:text-red-400 transition font-medium"
              title="Delete this streak"
            >
              delete
            </button>
          )}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", background: "#f3f4f6" }} />

      {/* Participants section */}
      <div className="px-5 py-4">
        <div className="text-[11px] font-bold uppercase tracking-widest text-gray-300 mb-3">
          {participants.length === 0 ? "No one yet — be the first!" : `${participants.length} still going`}
        </div>

        <div className="space-y-2">
          {participants.map((p) => {
            const isMe = p.email === currentUser.email;
            return (
              <div key={p.id} className="flex items-center gap-2.5">
                <img
                  src={getAvatarUrl(p.full_name)}
                  alt={p.full_name}
                  className="w-7 h-7 rounded-full object-cover shrink-0"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/default-avatar.jpg"; }}
                />
                <span className="text-sm font-semibold text-gray-700 flex-1">
                  {p.full_name}
                  {isMe && <span className="ml-1.5 text-[10px] font-bold text-indigo-400">you</span>}
                </span>
                {isMe && (
                  <button
                    onClick={handleDead}
                    disabled={busy}
                    className="text-[11px] font-bold px-3 py-1 rounded-full transition-all hover:scale-105 active:scale-95"
                    style={{ background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca" }}
                  >
                    &#128128; streak&rsquo;s dead
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Join button */}
        {!isParticipant && (
          <button
            onClick={handleJoin}
            disabled={busy}
            className="mt-4 w-full py-2.5 rounded-2xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: busy ? "#f3f4f6" : "linear-gradient(135deg, #111827, #374151)",
              color: busy ? "#9ca3af" : "white",
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "Joining..." : "⊕ Join this streak"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StreakersPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [participants, setParticipants] = useState<StreakParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Load current user
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("email", user.email)
        .single();
      setCurrentUser({
        id: user.id,
        full_name: profile?.full_name ?? "",
        email: profile?.email ?? user.email ?? "",
      });
    };
    init();
  }, []);

  const fetchData = useCallback(async () => {
    const { data: streakData } = await supabase
      .from("streaks")
      .select("*")
      .order("created_at", { ascending: false });

    setStreaks((streakData ?? []) as Streak[]);

    if (streakData && streakData.length > 0) {
      const ids = streakData.map((s: Streak) => s.id);
      const { data: partData } = await supabase
        .from("streak_participants")
        .select("*")
        .in("streak_id", ids);
      setParticipants((partData ?? []) as StreakParticipant[]);
    } else {
      setParticipants([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchData().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchData]);

  const dailyStreaks = streaks.filter((s) => s.type === "daily");
  const weeklyStreaks = streaks.filter((s) => s.type === "weekly");

  const getParticipants = (streakId: number) =>
    participants.filter((p) => p.streak_id === streakId);

  return (
    <AuthGuard>
      {showCreateModal && currentUser && (
        <CreateStreakModal
          currentUser={currentUser}
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchData}
        />
      )}

      <div className="min-h-screen -mx-6 -my-10" style={{ background: "#f8f7f4" }}>

        {/* ── Hero ── */}
        <div
          className="relative px-6 py-16 text-center overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 50%, #111827 100%)" }}
        >
          {/* Decorative glows */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div style={{ position: "absolute", top: "-60px", right: "-60px", width: "320px", height: "320px", borderRadius: "50%", background: "radial-gradient(circle, rgba(245,158,11,0.25) 0%, transparent 70%)" }} />
            <div style={{ position: "absolute", bottom: "-40px", left: "-40px", width: "260px", height: "260px", borderRadius: "50%", background: "radial-gradient(circle, rgba(239,68,68,0.2) 0%, transparent 70%)" }} />
          </div>

          <div className="relative space-y-6">
            <div style={{ fontSize: 52 }}>&#127987;&#65039;</div>
            <h1
              className="text-5xl sm:text-7xl font-black tracking-tight"
              style={{ color: "#fff", textShadow: "0 2px 20px rgba(0,0,0,0.4)", lineHeight: 1.1 }}
            >
              Streak<span style={{ color: "#f59e0b" }}>ers</span>
            </h1>
            <p className="text-sm max-w-xs mx-auto" style={{ color: "rgba(255,255,255,0.45)" }}>
              Start a streak. Invite the family. Keep it alive.
            </p>

            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:scale-105 active:scale-95"
              style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)", boxShadow: "0 4px 24px rgba(245,158,11,0.35)" }}
            >
              &#128293; Start a Streak
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="max-w-2xl mx-auto px-6 py-12 space-y-12">

          {loading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-gray-200 rounded-3xl" />
              ))}
            </div>
          ) : (
            <>
              {/* ── Daily Streaks ── */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">&#128293;</div>
                  <div>
                    <div className="text-lg font-black text-gray-900">Daily Streaks</div>
                    <div className="text-xs text-gray-400">Do it every single day</div>
                  </div>
                  <div className="ml-auto text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: "#fff7ed", color: "#c2410c" }}>
                    {dailyStreaks.length} active
                  </div>
                </div>

                {dailyStreaks.length === 0 ? (
                  <div
                    className="rounded-3xl py-12 text-center space-y-3"
                    style={{ border: "2px dashed #e5e7eb" }}
                  >
                    <div style={{ fontSize: 36 }}>&#129354;</div>
                    <div className="text-sm font-semibold text-gray-400">No daily streaks yet</div>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="text-xs font-bold text-orange-400 hover:text-orange-500 transition underline underline-offset-2"
                    >
                      Start one
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dailyStreaks.map((s) => (
                      <StreakCard
                        key={s.id}
                        streak={s}
                        participants={getParticipants(s.id)}
                        currentUser={currentUser!}
                        onRefresh={fetchData}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* ── Weekly Streaks ── */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">&#128197;</div>
                  <div>
                    <div className="text-lg font-black text-gray-900">Weekly Streaks</div>
                    <div className="text-xs text-gray-400">Once a week, every week</div>
                  </div>
                  <div className="ml-auto text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: "#f0fdf4", color: "#15803d" }}>
                    {weeklyStreaks.length} active
                  </div>
                </div>

                {weeklyStreaks.length === 0 ? (
                  <div
                    className="rounded-3xl py-12 text-center space-y-3"
                    style={{ border: "2px dashed #e5e7eb" }}
                  >
                    <div style={{ fontSize: 36 }}>&#128197;</div>
                    <div className="text-sm font-semibold text-gray-400">No weekly streaks yet</div>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="text-xs font-bold text-green-500 hover:text-green-600 transition underline underline-offset-2"
                    >
                      Start one
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {weeklyStreaks.map((s) => (
                      <StreakCard
                        key={s.id}
                        streak={s}
                        participants={getParticipants(s.id)}
                        currentUser={currentUser!}
                        onRefresh={fetchData}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
