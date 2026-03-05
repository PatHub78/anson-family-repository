"use client";

import { useEffect, useState, useCallback } from "react";
import AuthGuard from "@/app/components/AuthGuard";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

interface Profile {
  full_name: string;
  email: string;
}

interface PersonalChallenge {
  id: number;
  created_at: string;
  challenger_id: string;
  challenger_name: string;
  target_email: string | null;   // null = open to everyone
  target_name: string | null;
  challenge_text: string;
  is_measurable: boolean;
  goal_number: number | null;
  goal_unit: string | null;
  week_start: string;
  status: "active" | "expired";
}

interface ChallengeEngagement {
  id: number;
  challenge_id: number;
  user_id: string;
  full_name: string;
  status: "accepted" | "completed";
  progress: number | null;
  created_at: string;
}

interface CurrentUser {
  id: string;         // auth.users.id (uuid)
  full_name: string;
  email: string;      // profiles.email (primary key)
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function getAvatarUrl(name: string) {
  const fileName = name.toLowerCase().replaceAll(" ", "-") + ".jpg";
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`;
}

function firstName(name: string) {
  return name?.split(" ")[0] ?? name;
}

function getCurrentWeekMonday(): string {
  const now = new Date();
  const utcDay = now.getUTCDay();
  const diff = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff));
  return monday.toISOString().split("T")[0];
}

function getTimeRemaining() {
  const now = new Date();
  const CET_OFFSET = 1 * 60 * 60 * 1000;
  const nowCET = new Date(now.getTime() + CET_OFFSET);
  const dayOfWeek = nowCET.getUTCDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek;
  const nextMonday = new Date(
    Date.UTC(nowCET.getUTCFullYear(), nowCET.getUTCMonth(), nowCET.getUTCDate() + daysUntilMonday, 15, 0, 0)
  );
  const nextMondayLocal = new Date(nextMonday.getTime() - CET_OFFSET);
  const diff = nextMondayLocal.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ────────────────────────────────────────────────────────────────────
// Countdown
// ────────────────────────────────────────────────────────────────────

function Countdown() {
  const [time, setTime] = useState(getTimeRemaining());
  useEffect(() => {
    const interval = setInterval(() => setTime(getTimeRemaining()), 1000);
    return () => clearInterval(interval);
  }, []);

  const units = [
    { label: "Days", value: time.days },
    { label: "Hours", value: time.hours },
    { label: "Minutes", value: time.minutes },
    { label: "Seconds", value: time.seconds },
  ];

  return (
    <div className="flex justify-center gap-3 sm:gap-4">
      {units.map(({ label, value }, i) => (
        <div key={label} className="flex items-center gap-3 sm:gap-4">
          <div className="flex flex-col items-center">
            <div
              className="text-2xl sm:text-4xl font-black tabular-nums rounded-2xl flex items-center justify-center"
              style={{
                background: "rgba(255,255,255,0.12)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.2)",
                width: "64px", height: "64px",
                color: "#fff",
              }}
            >
              {pad(value)}
            </div>
            <div className="text-[10px] font-semibold mt-1.5 tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.6)" }}>
              {label}
            </div>
          </div>
          {i < units.length - 1 && (
            <div className="text-2xl font-black pb-5" style={{ color: "rgba(255,255,255,0.4)" }}>:</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Progress Bar
// ────────────────────────────────────────────────────────────────────

function ProgressBar({ current, goal, color = "#6366f1" }: { current: number; goal: number; color?: string }) {
  const pct = Math.min(100, Math.round((current / goal) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-semibold" style={{ color: "#6b7280" }}>
        <span>{current.toLocaleString()} / {goal.toLocaleString()}</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <div className="rounded-full overflow-hidden" style={{ height: 8, background: "#e5e7eb" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }}
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Create Challenge Modal
// ────────────────────────────────────────────────────────────────────

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
  const [challengeText, setChallengeText] = useState("");
  const [targetUserId, setTargetUserId] = useState<string>("everyone");
  const [isMeasurable, setIsMeasurable] = useState(false);
  const [goalNumber, setGoalNumber] = useState("");
  const [goalUnit, setGoalUnit] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const others = profiles.filter((p) => p.email !== currentUser.email);

  const handleSubmit = async () => {
    if (!challengeText.trim()) { setError("Please describe the challenge."); return; }
    if (isMeasurable && (!goalNumber || !goalUnit.trim())) {
      setError("Please enter a goal number and unit."); return;
    }
    setSaving(true);
    setError("");

    const targetProfile = targetUserId === "everyone" ? null : profiles.find((p) => p.email === targetUserId);

    const { data: newChallenge, error: insertError } = await supabase
      .from("personal_challenges")
      .insert({
        challenger_id: currentUser.id,
        challenger_name: currentUser.full_name,
        target_email: targetProfile?.email ?? null,
        target_name: targetProfile?.full_name ?? null,
        challenge_text: challengeText.trim(),
        is_measurable: isMeasurable,
        goal_number: isMeasurable ? parseInt(goalNumber) : null,
        goal_unit: isMeasurable ? goalUnit.trim() : null,
        week_start: getCurrentWeekMonday(),
        status: "active",
      })
      .select()
      .single();

    if (insertError) {
      setError("Something went wrong. Please try again.");
      setSaving(false);
      return;
    }

    // Trigger email notification via Edge Function
    if (newChallenge) {
      try {
        await fetch(`/api/notify-challenge`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            challengeId: newChallenge.id,
            challengerName: currentUser.full_name,
            challengerEmail: currentUser.email,
            challengeText: challengeText.trim(),
            targetEmail: targetProfile?.email ?? null,
            targetName: targetProfile?.full_name ?? null,
          }),
        });
      } catch {
        // Notification failure is non-blocking
      }
    }

    setSaving(false);
    onCreated();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-3xl p-8 space-y-6"
        style={{ background: "#fff", boxShadow: "0 25px 60px rgba(0,0,0,0.2)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black" style={{ color: "#111" }}>Throw Down a Challenge</h2>
            <p className="text-sm mt-1" style={{ color: "#6b7280" }}>Pick someone and dare them to do something!</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-lg transition hover:scale-110"
            style={{ background: "#f3f4f6", color: "#374151" }}
          >
            ✕
          </button>
        </div>

        {/* Challenge target */}
        <div className="space-y-2">
          <label className="text-sm font-bold uppercase tracking-wider" style={{ color: "#374151" }}>
            Challenge who?
          </label>
          <select
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            className="w-full rounded-2xl px-4 py-3 text-sm font-medium appearance-none"
            style={{
              background: "#f9fafb",
              border: "2px solid #e5e7eb",
              color: "#111",
              outline: "none",
            }}
          >
            <option value="everyone">🌍 Everyone — open challenge!</option>
            {others.map((p) => (
              <option key={p.email} value={p.email}>👤 {p.full_name}</option>
            ))}
          </select>
        </div>

        {/* Challenge description */}
        <div className="space-y-2">
          <label className="text-sm font-bold uppercase tracking-wider" style={{ color: "#374151" }}>
            The Challenge
          </label>
          <textarea
            value={challengeText}
            onChange={(e) => setChallengeText(e.target.value)}
            placeholder="e.g. Walk 2,000 steps every day this week…"
            rows={3}
            className="w-full rounded-2xl px-4 py-3 text-sm resize-none"
            style={{
              background: "#f9fafb",
              border: "2px solid #e5e7eb",
              color: "#111",
              outline: "none",
            }}
          />
        </div>

        {/* Measurable toggle */}
        <div
          className="flex items-center justify-between rounded-2xl px-4 py-3"
          style={{ background: "#f9fafb", border: "2px solid #e5e7eb" }}
        >
          <div>
            <div className="text-sm font-bold" style={{ color: "#111" }}>Measurable goal?</div>
            <div className="text-xs" style={{ color: "#6b7280" }}>Track progress with a number</div>
          </div>
          <button
            onClick={() => setIsMeasurable(!isMeasurable)}
            className="relative rounded-full transition-all duration-300"
            style={{
              width: 48, height: 28,
              background: isMeasurable ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#d1d5db",
            }}
          >
            <div
              className="absolute top-1 rounded-full transition-all duration-300"
              style={{
                width: 20, height: 20,
                background: "#fff",
                left: isMeasurable ? 24 : 4,
                boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
              }}
            />
          </button>
        </div>

        {/* Measurable fields */}
        {isMeasurable && (
          <div className="flex gap-3">
            <div className="flex-1 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "#374151" }}>Goal Number</label>
              <input
                type="number"
                value={goalNumber}
                onChange={(e) => setGoalNumber(e.target.value)}
                placeholder="e.g. 1000"
                className="w-full rounded-2xl px-4 py-3 text-sm"
                style={{ background: "#f9fafb", border: "2px solid #e5e7eb", color: "#111", outline: "none" }}
              />
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "#374151" }}>Unit</label>
              <input
                type="text"
                value={goalUnit}
                onChange={(e) => setGoalUnit(e.target.value)}
                placeholder="e.g. pushups, steps"
                className="w-full rounded-2xl px-4 py-3 text-sm"
                style={{ background: "#f9fafb", border: "2px solid #e5e7eb", color: "#111", outline: "none" }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm font-medium px-4 py-3 rounded-2xl" style={{ background: "#fef2f2", color: "#dc2626" }}>
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl text-sm font-bold transition hover:scale-105"
            style={{ background: "#f3f4f6", color: "#374151" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-2 py-3.5 px-8 rounded-2xl text-sm font-bold text-white transition hover:scale-105 active:scale-95"
            style={{
              background: saving ? "#9ca3af" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              boxShadow: saving ? "none" : "0 4px 15px rgba(99,102,241,0.4)",
              cursor: saving ? "wait" : "pointer",
              flex: 2,
            }}
          >
            {saving ? "Sending…" : "🚀 Launch Challenge!"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Log Progress Modal
// ────────────────────────────────────────────────────────────────────

function LogProgressModal({
  challenge,
  engagement,
  onClose,
  onSaved,
}: {
  challenge: PersonalChallenge;
  engagement: ChallengeEngagement;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(String(engagement.progress ?? 0));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const newProgress = parseInt(value) || 0;
    const isComplete = challenge.goal_number !== null && newProgress >= challenge.goal_number;

    await supabase
      .from("personal_challenge_engagements")
      .update({
        progress: newProgress,
        status: isComplete ? "completed" : "accepted",
      })
      .eq("id", engagement.id);

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-8 space-y-6"
        style={{ background: "#fff", boxShadow: "0 25px 60px rgba(0,0,0,0.2)" }}
      >
        <h2 className="text-xl font-black" style={{ color: "#111" }}>Log Your Progress</h2>

        <div className="space-y-2">
          <label className="text-sm font-bold" style={{ color: "#374151" }}>
            How many {challenge.goal_unit} so far?
          </label>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-2xl px-4 py-3 text-2xl font-black text-center"
            style={{ background: "#f9fafb", border: "2px solid #e5e7eb", color: "#111", outline: "none" }}
          />
          {challenge.goal_number && (
            <div className="text-xs text-center" style={{ color: "#6b7280" }}>
              Goal: {challenge.goal_number.toLocaleString()} {challenge.goal_unit}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-sm font-bold"
            style={{ background: "#f3f4f6", color: "#374151" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-2xl text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            {saving ? "Saving…" : "💾 Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Challenge Card
// ────────────────────────────────────────────────────────────────────

function ChallengeCard({
  challenge,
  engagements,
  currentUser,
  onRefresh,
}: {
  challenge: PersonalChallenge;
  engagements: ChallengeEngagement[];
  currentUser: CurrentUser;
  onRefresh: () => void;
}) {
  const [acting, setActing] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);

  const myEngagement = engagements.find((e) => e.user_id === currentUser.id);
  const myStatus = myEngagement?.status ?? "none";
  const accepted = engagements.filter((e) => e.status === "accepted");
  const completed = engagements.filter((e) => e.status === "completed");

  // Best progress among all engagements
  const bestProgress = challenge.is_measurable
    ? Math.max(0, ...engagements.map((e) => e.progress ?? 0))
    : 0;

  const isTargetedAtMe = challenge.target_email === currentUser.email;
  const isOpen = !challenge.target_email;
  const isMyChallenge = challenge.challenger_id === currentUser.id;
  const canEngage = !isMyChallenge && (isOpen || isTargetedAtMe || myStatus !== "none");

  const handleAccept = async () => {
    if (acting) return;
    setActing(true);
    await supabase.from("personal_challenge_engagements").upsert({
      challenge_id: challenge.id,
      user_id: currentUser.id,
      full_name: currentUser.full_name,
      status: "accepted",
      progress: 0,
    }, { onConflict: "challenge_id,user_id" });
    setActing(false);
    onRefresh();
  };

  const handleComplete = async () => {
    if (acting) return;
    setActing(true);
    await supabase.from("personal_challenge_engagements").upsert({
      challenge_id: challenge.id,
      user_id: currentUser.id,
      full_name: currentUser.full_name,
      status: "completed",
      progress: challenge.goal_number ?? null,
    }, { onConflict: "challenge_id,user_id" });
    setActing(false);
    onRefresh();
  };

  // Card accent color — targeted challenges get indigo, open get amber
  const accentColor = isTargetedAtMe ? "#6366f1" : isOpen ? "#f59e0b" : "#6b7280";

  return (
    <>
      {showProgressModal && myEngagement && (
        <LogProgressModal
          challenge={challenge}
          engagement={myEngagement}
          onClose={() => setShowProgressModal(false)}
          onSaved={onRefresh}
        />
      )}

      <div
        className="rounded-3xl overflow-hidden"
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 12px 30px rgba(0,0,0,0.06)",
        }}
      >
        {/* Top accent bar */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)` }} />

        <div className="p-6 space-y-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="rounded-2xl overflow-hidden flex-shrink-0"
                style={{ width: 40, height: 40, border: `2px solid ${accentColor}44` }}
              >
                <img
                  src={getAvatarUrl(challenge.challenger_name)}
                  alt={challenge.challenger_name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold truncate" style={{ color: "#111" }}>
                  {firstName(challenge.challenger_name)}
                  <span style={{ color: "#9ca3af", fontWeight: 400 }}> challenges </span>
                  {challenge.target_name ? (
                    <span style={{ color: accentColor }}>{firstName(challenge.target_name)}</span>
                  ) : (
                    <span style={{ color: "#f59e0b" }}>everyone</span>
                  )}
                </div>
                <div className="text-xs" style={{ color: "#9ca3af" }}>{timeAgo(challenge.created_at)}</div>
              </div>
            </div>

            {/* Badges */}
            <div className="flex gap-1.5 flex-shrink-0">
              {isTargetedAtMe && (
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "#ede9fe", color: "#6d28d9" }}
                >
                  You!
                </span>
              )}
              {isOpen && (
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "#fef3c7", color: "#92400e" }}
                >
                  Open
                </span>
              )}
              {challenge.is_measurable && (
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "#ecfdf5", color: "#065f46" }}
                >
                  📊 Tracked
                </span>
              )}
            </div>
          </div>

          {/* Challenge text */}
          <div
            className="text-base sm:text-lg font-semibold leading-snug rounded-2xl px-5 py-4"
            style={{ background: "#f9fafb", color: "#111", border: "1px solid #f3f4f6" }}
          >
            {challenge.challenge_text}
          </div>

          {/* Progress bar (measurable) */}
          {challenge.is_measurable && challenge.goal_number && engagements.length > 0 && (
            <ProgressBar
              current={bestProgress}
              goal={challenge.goal_number}
              color={accentColor}
            />
          )}

          {/* Goal pill */}
          {challenge.is_measurable && challenge.goal_number && (
            <div
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: "#ecfdf5", color: "#065f46" }}
            >
              🎯 Goal: {challenge.goal_number.toLocaleString()} {challenge.goal_unit}
            </div>
          )}

          {/* Engagement avatars */}
          {engagements.length > 0 && (
            <div className="flex flex-wrap gap-4">
              {completed.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#059669" }}>
                    🏅 Done ({completed.length})
                  </div>
                  <div className="flex gap-2">
                    {completed.map((e) => (
                      <div key={e.user_id} className="flex flex-col items-center gap-1">
                        <div
                          className="rounded-xl overflow-hidden"
                          style={{ width: 36, height: 36, border: "2px solid #059669" }}
                        >
                          <img src={getAvatarUrl(e.full_name)} alt={e.full_name} className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[10px] font-semibold" style={{ color: "#374151" }}>{firstName(e.full_name)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {accepted.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#6366f1" }}>
                    ✋ In ({accepted.length})
                  </div>
                  <div className="flex gap-2">
                    {accepted.map((e) => (
                      <div key={e.user_id} className="flex flex-col items-center gap-1">
                        <div
                          className="rounded-xl overflow-hidden"
                          style={{ width: 36, height: 36, border: "2px solid #6366f1" }}
                        >
                          <img src={getAvatarUrl(e.full_name)} alt={e.full_name} className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[10px] font-semibold" style={{ color: "#374151" }}>{firstName(e.full_name)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CTA buttons */}
          {canEngage && (
            <div className="flex flex-wrap gap-2 pt-1">
              {myStatus === "none" && (
                <button
                  onClick={handleAccept}
                  disabled={acting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white transition hover:scale-105 active:scale-95"
                  style={{
                    background: acting ? "#9ca3af" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    boxShadow: "0 4px 12px rgba(99,102,241,0.35)",
                  }}
                >
                  {acting ? "Saving…" : "✋ Accept Challenge"}
                </button>
              )}
              {myStatus === "accepted" && (
                <>
                  <div
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold"
                    style={{ background: "#ede9fe", color: "#6d28d9" }}
                  >
                    ✋ You&apos;re in!
                  </div>
                  {challenge.is_measurable && (
                    <button
                      onClick={() => setShowProgressModal(true)}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold transition hover:scale-105"
                      style={{ background: "#ecfdf5", color: "#065f46" }}
                    >
                      📊 Log Progress
                    </button>
                  )}
                  <button
                    onClick={handleComplete}
                    disabled={acting}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold text-white transition hover:scale-105"
                    style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
                  >
                    {acting ? "Saving…" : "🏅 Mark Done!"}
                  </button>
                </>
              )}
              {myStatus === "completed" && (
                <div
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold"
                  style={{ background: "linear-gradient(135deg, #d1fae5, #a7f3d0)", color: "#065f46" }}
                >
                  🏅 You completed this!
                </div>
              )}
            </div>
          )}

          {isMyChallenge && (
            <div className="text-xs font-medium" style={{ color: "#9ca3af" }}>
              You created this challenge
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────────────

export default function WeeklyChallengesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [challenges, setChallenges] = useState<PersonalChallenge[]>([]);
  const [engagements, setEngagements] = useState<ChallengeEngagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Load current user + profiles
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

      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("full_name, email")
        .order("full_name");

      setProfiles((allProfiles ?? []) as Profile[]);
    };
    init();
  }, []);

  const fetchChallenges = useCallback(async () => {
    const mondayStr = getCurrentWeekMonday();

    const { data: challengeData } = await supabase
      .from("personal_challenges")
      .select("*")
      .order("created_at", { ascending: false });

    setChallenges((challengeData ?? []) as PersonalChallenge[]);

    if (challengeData && challengeData.length > 0) {
      const ids = challengeData.map((c: PersonalChallenge) => c.id);
      const { data: engData } = await supabase
        .from("personal_challenge_engagements")
        .select("*")
        .in("challenge_id", ids);
      setEngagements((engData ?? []) as ChallengeEngagement[]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchChallenges().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [fetchChallenges]);

  const mondayStr = getCurrentWeekMonday();
  const activeChallenges = challenges.filter((c) => c.week_start === mondayStr && c.status === "active");
  const pastChallenges = challenges.filter((c) => c.week_start !== mondayStr || c.status === "expired");

  const getEngagementsForChallenge = (challengeId: number) =>
    engagements.filter((e) => e.challenge_id === challengeId);

  return (
    <AuthGuard>
      {showCreateModal && currentUser && (
        <CreateChallengeModal
          profiles={profiles}
          currentUser={currentUser}
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchChallenges}
        />
      )}

      <div className="min-h-screen -mx-6 -my-10" style={{ background: "#f8f7f4" }}>

        {/* ── Hero banner ── */}
        <div
          className="relative px-6 py-16 text-center overflow-hidden"
          style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)" }}
        >
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div style={{
              position: "absolute", top: "-80px", right: "-80px",
              width: "360px", height: "360px", borderRadius: "50%",
              background: "radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)",
            }} />
            <div style={{
              position: "absolute", bottom: "-60px", left: "-60px",
              width: "280px", height: "280px", borderRadius: "50%",
              background: "radial-gradient(circle, rgba(236,72,153,0.25) 0%, transparent 70%)",
            }} />
          </div>

          <div className="relative space-y-6">
            <h1
              className="text-5xl sm:text-7xl font-black tracking-tight"
              style={{ color: "#fff", textShadow: "0 2px 20px rgba(0,0,0,0.3)", lineHeight: 1.1 }}
            >
              Weekly<br />
              <span style={{ color: "#a78bfa" }}>Challenges</span>
            </h1>

            <div className="space-y-2">
              <div className="text-xs font-semibold tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>
                Resets Monday at 3 PM CET
              </div>
              <Countdown />
            </div>

            {/* Create challenge button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:scale-105 active:scale-95 mt-2"
              style={{
                background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                boxShadow: "0 4px 20px rgba(245,158,11,0.4)",
              }}
            >
              🔥 Throw a Challenge!
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="max-w-2xl mx-auto px-6 py-12 space-y-10">

          {loading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2].map((i) => (
                <div key={i} className="h-48 bg-gray-200 rounded-3xl" />
              ))}
            </div>
          ) : activeChallenges.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div style={{ fontSize: 56 }}>🏖️</div>
              <div className="text-xl font-bold text-gray-700">No challenges yet this week</div>
              <div className="text-gray-400 text-sm">Be the first — dare someone to do something!</div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white mt-2"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
              >
                🚀 Create the first challenge
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#9ca3af" }}>
                  This week · {activeChallenges.length} challenge{activeChallenges.length !== 1 ? "s" : ""}
                </div>
                <div className="space-y-5">
                  {activeChallenges.map((c) => (
                    <ChallengeCard
                      key={c.id}
                      challenge={c}
                      engagements={getEngagementsForChallenge(c.id)}
                      currentUser={currentUser!}
                      onRefresh={fetchChallenges}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Past challenges ── */}
          {pastChallenges.length > 0 && (
            <div className="space-y-4">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2 text-sm font-bold w-full py-3 px-5 rounded-2xl transition hover:scale-[1.01]"
                style={{ background: "#fff", border: "1px solid #e5e7eb", color: "#374151" }}
              >
                <span>{showHistory ? "▾" : "▸"}</span>
                <span>Past Challenges</span>
                <span
                  className="ml-auto text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: "#f3f4f6", color: "#6b7280" }}
                >
                  {pastChallenges.length}
                </span>
              </button>

              {showHistory && (
                <div className="space-y-5 opacity-75">
                  {pastChallenges.map((c) => (
                    <ChallengeCard
                      key={c.id}
                      challenge={c}
                      engagements={getEngagementsForChallenge(c.id)}
                      currentUser={currentUser!}
                      onRefresh={fetchChallenges}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
