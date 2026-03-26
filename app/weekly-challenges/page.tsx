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

interface RaceChallenge {
  id: number;
  created_at: string;
  created_by_name: string;
  created_by_email: string;
  title: string;
  goal_number: number;
  goal_unit: string;
  primary_opponent_name: string | null;
  primary_opponent_email: string | null;
  status: "open" | "won";
  winner_name: string | null;
  winner_email: string | null;
  won_at: string | null;
}

interface RaceParticipant {
  id: number;
  created_at: string;
  challenge_id: number;
  full_name: string;
  email: string;
  completed: boolean;
  completed_at: string | null;
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

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Create Challenge Modal ───────────────────────────────────────────────────

function CreateChallengeModal({
  profiles,
  currentUser,
  onClose,
  onCreated,
}: {
  profiles: Profile[];
  currentUser: CurrentUser;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [goalNumber, setGoalNumber] = useState("");
  const [goalUnit, setGoalUnit] = useState("");
  const [opponentEmail, setOpponentEmail] = useState("open");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const others = profiles.filter((p) => p.email !== currentUser.email);

  const handleSubmit = async () => {
    if (!title.trim()) { setError("Please give the challenge a title."); return; }
    if (!goalNumber || isNaN(Number(goalNumber)) || Number(goalNumber) <= 0) {
      setError("Please enter a valid goal number."); return;
    }
    if (!goalUnit.trim()) { setError("Please enter a unit (e.g. pushups, miles)."); return; }

    setSaving(true);
    setError("");

    const opponent = opponentEmail === "open" ? null : profiles.find((p) => p.email === opponentEmail);

    // Insert the challenge
    const { data: challenge, error: insertError } = await supabase
      .from("race_challenges")
      .insert({
        created_by_name: currentUser.full_name,
        created_by_email: currentUser.email,
        title: title.trim(),
        goal_number: parseInt(goalNumber),
        goal_unit: goalUnit.trim(),
        primary_opponent_name: opponent?.full_name ?? null,
        primary_opponent_email: opponent?.email ?? null,
        status: "open",
      })
      .select()
      .single();

    if (insertError || !challenge) {
      setError("Something went wrong. Please try again.");
      setSaving(false);
      return;
    }

    // Auto-join the creator
    await supabase.from("race_participants").insert({
      challenge_id: challenge.id,
      full_name: currentUser.full_name,
      email: currentUser.email,
      completed: false,
    });

    // Auto-join the primary opponent if specified
    if (opponent) {
      await supabase.from("race_participants").insert({
        challenge_id: challenge.id,
        full_name: opponent.full_name,
        email: opponent.email,
        completed: false,
      });
    }

    setSaving(false);
    onCreated();
    onClose();
  };

  const placeholders = [
    "First to 1,000 pushups",
    "First to 100 miles biked",
    "First to run a marathon",
    "First to 500 pages read",
  ];
  const placeholder = placeholders[Math.floor(Math.random() * placeholders.length)];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: "#fff" }}
      >
        {/* Header */}
        <div className="px-7 py-6" style={{ background: "linear-gradient(135deg, #111827, #1f2937)" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-black text-white">🏁 New Race</div>
              <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                Challenge someone — first to finish wins
              </div>
            </div>
            <button onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-lg transition hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.6)" }}>
              &#x2715;
            </button>
          </div>
        </div>

        <div className="px-7 py-6 space-y-5">

          {/* Challenge title */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Challenge Title</div>
            <input
              autoFocus
              type="text"
              placeholder={placeholder}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border-2 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-gray-900 transition"
              style={{ borderColor: "#e5e7eb" }}
            />
          </div>

          {/* Goal */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Goal</div>
            <div className="flex gap-3">
              <input
                type="number"
                min="1"
                placeholder="100"
                value={goalNumber}
                onChange={(e) => setGoalNumber(e.target.value)}
                className="w-28 border-2 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-gray-900 transition text-center"
                style={{ borderColor: "#e5e7eb" }}
              />
              <input
                type="text"
                placeholder="miles, pushups, pages…"
                value={goalUnit}
                onChange={(e) => setGoalUnit(e.target.value)}
                className="flex-1 border-2 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-gray-900 transition"
                style={{ borderColor: "#e5e7eb" }}
              />
            </div>
          </div>

          {/* Opponent */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              Primary Opponent <span className="normal-case font-normal text-gray-300">(others can join too)</span>
            </div>
            <select
              value={opponentEmail}
              onChange={(e) => setOpponentEmail(e.target.value)}
              className="w-full border-2 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-gray-900 transition appearance-none"
              style={{ borderColor: "#e5e7eb" }}
              title="Select an opponent"
            >
              <option value="open">🌍 Open to everyone</option>
              {others.map((p) => (
                <option key={p.email} value={p.email}>⚔️ {p.full_name}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="text-xs font-medium px-4 py-3 rounded-2xl" style={{ background: "#fef2f2", color: "#dc2626" }}>
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-3.5 rounded-2xl text-sm font-bold transition"
              style={{ background: "#f3f4f6", color: "#374151" }}>
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white transition hover:scale-105 active:scale-95"
              style={{
                background: saving ? "#9ca3af" : "linear-gradient(135deg, #f59e0b, #ef4444)",
                boxShadow: saving ? "none" : "0 4px 16px rgba(245,158,11,0.35)",
                cursor: saving ? "wait" : "pointer",
              }}
            >
              {saving ? "Creating…" : "🏁 Start the Race!"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Race Card ────────────────────────────────────────────────────────────────

function RaceCard({
  challenge,
  participants,
  currentUser,
  onRefresh,
}: {
  challenge: RaceChallenge;
  participants: RaceParticipant[];
  currentUser: CurrentUser;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const isWon = challenge.status === "won";
  const myParticipant = participants.find((p) => p.email === currentUser.email);
  const isParticipant = !!myParticipant;
  const hasCompleted = myParticipant?.completed ?? false;
  const isCreator = challenge.created_by_email === currentUser.email;
  const isPrimaryOpponent = challenge.primary_opponent_email === currentUser.email;

  const handleJoin = async () => {
    setBusy(true);
    await supabase.from("race_participants").insert({
      challenge_id: challenge.id,
      full_name: currentUser.full_name,
      email: currentUser.email,
      completed: false,
    });
    await onRefresh();
    setBusy(false);
  };

  const handleComplete = async () => {
    if (!confirm("Confirm you have completed this challenge? 🏆")) return;
    setBusy(true);

    const now = new Date().toISOString();

    // Mark participant as completed
    await supabase
      .from("race_participants")
      .update({ completed: true, completed_at: now })
      .eq("challenge_id", challenge.id)
      .eq("email", currentUser.email);

    // Close the challenge and record winner
    await supabase
      .from("race_challenges")
      .update({
        status: "won",
        winner_name: currentUser.full_name,
        winner_email: currentUser.email,
        won_at: now,
      })
      .eq("id", challenge.id);

    await onRefresh();
    setBusy(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${challenge.title}"? This cannot be undone.`)) return;
    setBusy(true);
    await supabase.from("race_challenges").delete().eq("id", challenge.id);
    await onRefresh();
    setBusy(false);
  };

  // Sort: winner first, then completed, then others
  const sorted = [...participants].sort((a, b) => {
    if (a.email === challenge.winner_email) return -1;
    if (b.email === challenge.winner_email) return 1;
    if (a.completed && !b.completed) return -1;
    if (!a.completed && b.completed) return 1;
    return 0;
  });

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{
        background: isWon ? "#fafaf9" : "white",
        border: `1px solid ${isWon ? "#e5e7eb" : "#f0f0f0"}`,
        boxShadow: isWon ? "none" : "0 2px 12px rgba(0,0,0,0.06)",
        opacity: isWon ? 0.85 : 1,
      }}
    >
      {/* Top bar */}
      <div style={{
        height: 4,
        background: isWon
          ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
          : "linear-gradient(90deg, #ef4444, #f97316)",
      }} />

      <div className="px-5 pt-5 pb-4">
        {/* Status + title */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {isWon && (
              <div className="flex items-center gap-1.5 mb-2">
                <span style={{ fontSize: 14 }}>🏆</span>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#f59e0b" }}>
                  Race Over · Won by {firstName(challenge.winner_name ?? "")}
                </span>
              </div>
            )}
            <h3 className="text-base font-black text-gray-900 leading-tight">{challenge.title}</h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: "#fef3c7", color: "#92400e" }}
              >
                🎯 First to {challenge.goal_number.toLocaleString()} {challenge.goal_unit}
              </span>
              {challenge.primary_opponent_name && (
                <span className="text-xs text-gray-400">
                  ⚔️ <span className="font-semibold text-gray-500">{firstName(challenge.created_by_name)}</span>
                  {" vs "}
                  <span className="font-semibold text-gray-500">{firstName(challenge.primary_opponent_name)}</span>
                </span>
              )}
            </div>
          </div>
          {isCreator && !isWon && (
            <button
              onClick={handleDelete}
              disabled={busy}
              className="text-[10px] text-gray-300 hover:text-red-400 transition font-medium shrink-0"
            >
              delete
            </button>
          )}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 mt-2">
          <img src={getAvatarUrl(challenge.created_by_name)} alt={challenge.created_by_name}
            className="w-4 h-4 rounded-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          <span className="text-[11px] text-gray-400">
            Started by <span className="font-semibold text-gray-500">{firstName(challenge.created_by_name)}</span>
            {" · "}{timeAgo(challenge.created_at)}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "#f3f4f6" }} />

      {/* Participants */}
      <div className="px-5 py-4 space-y-3">
        <div className="text-[11px] font-bold uppercase tracking-widest text-gray-300">
          {participants.length === 0 ? "No participants yet" : `${participants.length} in the race`}
        </div>

        {sorted.map((p) => {
          const isWinner = p.email === challenge.winner_email;
          return (
            <div key={p.id} className="flex items-center gap-3">
              {/* Avatar */}
              <div className="relative shrink-0">
                <img src={getAvatarUrl(p.full_name)} alt={p.full_name}
                  className="w-8 h-8 rounded-full object-cover"
                  style={{ border: isWinner ? "2px solid #f59e0b" : "2px solid #e5e7eb" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/default-avatar.jpg"; }} />
                {isWinner && (
                  <span className="absolute -top-1 -right-1 text-xs">🏆</span>
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-gray-800 truncate">{p.full_name}</span>
                  {p.email === currentUser.email && (
                    <span className="text-[10px] font-bold text-indigo-400">you</span>
                  )}
                  {p.email === challenge.primary_opponent_email && (
                    <span className="text-[10px] font-bold text-orange-400">⚔️</span>
                  )}
                </div>
                {isWinner && (
                  <div className="text-[11px] font-bold" style={{ color: "#f59e0b" }}>
                    Winner! {challenge.won_at ? timeAgo(challenge.won_at) : ""}
                  </div>
                )}
              </div>

              {/* Status */}
              {!isWon && p.email === currentUser.email && !p.completed && (
                <button
                  onClick={handleComplete}
                  disabled={busy}
                  className="text-xs font-bold px-3 py-1.5 rounded-full transition hover:scale-105 active:scale-95"
                  style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}
                >
                  {busy ? "…" : "✓ Mission accomplished!"}
                </button>
              )}
              {p.completed && !isWinner && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "#f3f4f6", color: "#6b7280" }}>
                  Finished
                </span>
              )}
            </div>
          );
        })}

        {/* Join button */}
        {!isWon && !isParticipant && (
          <button
            onClick={handleJoin}
            disabled={busy}
            className="mt-2 w-full py-2.5 rounded-2xl text-sm font-bold transition hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: busy ? "#f3f4f6" : "linear-gradient(135deg, #111827, #374151)",
              color: busy ? "#9ca3af" : "white",
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "Joining…" : "⚔️ Join this race"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

function Leaderboard({ challenges, participants, profiles }: {
  challenges: RaceChallenge[];
  participants: RaceParticipant[];
  profiles: Profile[];
}) {
  const stats = profiles.map((p) => {
    const wins = challenges.filter((c) => c.winner_email === p.email).length;
    const participated = new Set(
      participants.filter((part) => part.email === p.email).map((part) => part.challenge_id)
    ).size;
    return { ...p, wins, participated };
  })
    .filter((p) => p.wins > 0 || p.participated > 0)
    .sort((a, b) => b.wins - a.wins || b.participated - a.participated);

  if (stats.length === 0) return null;

  return (
    <div className="rounded-3xl overflow-hidden"
      style={{ background: "white", border: "1px solid #f0f0f0", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="font-black text-gray-900">🏆 Leaderboard</div>
        <div className="text-xs text-gray-400 mt-0.5">Wins · Races entered</div>
      </div>
      <div className="divide-y divide-gray-50">
        {stats.map((p, i) => {
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
          return (
            <div key={p.email} className="flex items-center gap-4 px-5 py-3.5">
              <div className="w-7 text-center">
                {medal
                  ? <span style={{ fontSize: 20 }}>{medal}</span>
                  : <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                }
              </div>
              <img src={getAvatarUrl(p.full_name)} alt={p.full_name}
                className="w-9 h-9 rounded-full object-cover shrink-0"
                style={{ border: i === 0 ? "2px solid #f59e0b" : "2px solid #e5e7eb" }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/default-avatar.jpg"; }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-900 truncate">{p.full_name}</div>
                <div className="text-xs text-gray-400">{p.participated} race{p.participated !== 1 ? "s" : ""} entered</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-black" style={{ color: i === 0 ? "#f59e0b" : "#111" }}>
                  {p.wins}
                </div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">win{p.wins !== 1 ? "s" : ""}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WeeklyChallengesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [challenges, setChallenges] = useState<RaceChallenge[]>([]);
  const [participants, setParticipants] = useState<RaceParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("email", user.email).single();
      setCurrentUser({ id: user.id, full_name: profile?.full_name ?? "", email: profile?.email ?? user.email ?? "" });
      const { data: allProfiles } = await supabase.from("profiles").select("full_name, email").order("full_name");
      setProfiles((allProfiles ?? []) as Profile[]);
    };
    init();
  }, []);

  const fetchData = useCallback(async () => {
    const { data: challengeData } = await supabase
      .from("race_challenges")
      .select("*")
      .order("created_at", { ascending: false });

    setChallenges((challengeData ?? []) as RaceChallenge[]);

    if (challengeData && challengeData.length > 0) {
      const ids = challengeData.map((c: RaceChallenge) => c.id);
      const { data: partData } = await supabase
        .from("race_participants")
        .select("*")
        .in("challenge_id", ids);
      setParticipants((partData ?? []) as RaceParticipant[]);
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

  const getParticipants = (challengeId: number) =>
    participants.filter((p) => p.challenge_id === challengeId);

  const openChallenges = challenges.filter((c) => c.status === "open");
  const closedChallenges = challenges.filter((c) => c.status === "won");

  return (
    <AuthGuard>
      {showCreateModal && currentUser && (
        <CreateChallengeModal
          profiles={profiles}
          currentUser={currentUser}
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchData}
        />
      )}

      <div className="min-h-screen -mx-6 -my-10" style={{ background: "#f8f7f4" }}>

        {/* Hero */}
        <div
          className="relative px-6 py-16 text-center overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0f0f0f 0%, #1c1c1c 50%, #111827 100%)" }}
        >
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div style={{ position: "absolute", top: "-60px", right: "-60px", width: "320px", height: "320px", borderRadius: "50%", background: "radial-gradient(circle, rgba(239,68,68,0.25) 0%, transparent 70%)" }} />
            <div style={{ position: "absolute", bottom: "-40px", left: "-40px", width: "260px", height: "260px", borderRadius: "50%", background: "radial-gradient(circle, rgba(245,158,11,0.2) 0%, transparent 70%)" }} />
          </div>

          <div className="relative space-y-5">
            <div style={{ fontSize: 52 }}>🏁</div>
            <h1 className="text-5xl sm:text-7xl font-black tracking-tight"
              style={{ color: "#fff", textShadow: "0 2px 20px rgba(0,0,0,0.4)", lineHeight: 1.1 }}>
              Race<span style={{ color: "#f59e0b" }}>s</span>
            </h1>
            <p className="text-sm max-w-xs mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
              Issue a challenge. First one to the finish line wins. If you&rsquo;re not first, you&rsquo;re last.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:scale-105 active:scale-95"
              style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)", boxShadow: "0 4px 24px rgba(245,158,11,0.35)" }}
            >
              🏁 Start a Race
            </button>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-12 space-y-10">

          {loading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => <div key={i} className="h-48 bg-gray-200 rounded-3xl" />)}
            </div>
          ) : (
            <>
              {/* Leaderboard */}
              {challenges.length > 0 && (
                <Leaderboard challenges={challenges} participants={participants} profiles={profiles} />
              )}

              {/* Open races */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-widest text-gray-400">
                    🔴 Open Races · {openChallenges.length}
                  </div>
                </div>

                {openChallenges.length === 0 ? (
                  <div className="rounded-3xl py-14 text-center space-y-3"
                    style={{ border: "2px dashed #e5e7eb" }}>
                    <div style={{ fontSize: 40 }}>🏖️</div>
                    <div className="text-sm font-semibold text-gray-400">No open races right now</div>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="text-xs font-bold text-orange-400 hover:text-orange-500 transition underline underline-offset-2">
                      Start one
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {openChallenges.map((c) => (
                      <RaceCard
                        key={c.id}
                        challenge={c}
                        participants={getParticipants(c.id)}
                        currentUser={currentUser!}
                        onRefresh={fetchData}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Closed races */}
              {closedChallenges.length > 0 && (
                <section className="space-y-4">
                  <button
                    onClick={() => setShowClosed(!showClosed)}
                    className="flex items-center gap-2 text-sm font-bold w-full py-3 px-5 rounded-2xl transition hover:scale-[1.01]"
                    style={{ background: "#fff", border: "1px solid #e5e7eb", color: "#374151" }}>
                    <span>{showClosed ? "▾" : "▸"}</span>
                    <span>Completed Races</span>
                    <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ background: "#f3f4f6", color: "#6b7280" }}>
                      {closedChallenges.length}
                    </span>
                  </button>

                  {showClosed && (
                    <div className="space-y-5">
                      {closedChallenges.map((c) => (
                        <RaceCard
                          key={c.id}
                          challenge={c}
                          participants={getParticipants(c.id)}
                          currentUser={currentUser!}
                          onRefresh={fetchData}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
