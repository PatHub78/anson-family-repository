"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import AuthGuard from "@/app/components/AuthGuard";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

interface Challenge {
  id: number;
  week_start: string;
  challenge: string;
  bonus: string | null;
}

interface Engagement {
  id: number;
  challenge_id: number;
  user_id: string;
  full_name: string;
  status: "accepted" | "completed";
  created_at: string;
}

interface CurrentUser {
  id: string;
  full_name: string;
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

/** Get Monday of the current week in UTC to avoid timezone drift */
function getCurrentWeekMonday(): string {
  const now = new Date();
  const utcDay = now.getUTCDay(); // 0 = Sunday
  const diff = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff));
  return monday.toISOString().split("T")[0];
}

/** Days remaining until next Monday 3 PM CET (UTC+1/UTC+2) */
function getTimeRemaining(): { days: number; hours: number; minutes: number; seconds: number } {
  const now = new Date();

  // Next Monday at 15:00 CET (UTC+1 in winter, UTC+2 in summer)
  // We'll approximate CET as UTC+1 for simplicity
  const CET_OFFSET = 1 * 60 * 60 * 1000;
  const nowCET = new Date(now.getTime() + CET_OFFSET);

  const dayOfWeek = nowCET.getUTCDay(); // 0=Sun, 1=Mon...
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek;

  const nextMonday = new Date(
    Date.UTC(nowCET.getUTCFullYear(), nowCET.getUTCMonth(), nowCET.getUTCDate() + daysUntilMonday, 15, 0, 0)
  );
  const nextMondayLocal = new Date(nextMonday.getTime() - CET_OFFSET);

  const diff = nextMondayLocal.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

  const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours   = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
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
    { label: "Days",    value: time.days },
    { label: "Hours",   value: time.hours },
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
                width: "64px",
                height: "64px",
                color: "#fff",
                fontVariantNumeric: "tabular-nums",
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
// Avatar Row
// ────────────────────────────────────────────────────────────────────

function EngagementRow({
  label,
  emoji,
  people,
  color,
}: {
  label: string;
  emoji: string;
  people: Engagement[];
  color: string;
}) {
  if (people.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 20 }}>{emoji}</span>
        <span className="text-sm font-bold uppercase tracking-wider" style={{ color }}>
          {label}
        </span>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: color + "22", color }}
        >
          {people.length}
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        {people.map((e) => (
          <div key={e.user_id} className="flex flex-col items-center gap-1.5">
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                width: 52,
                height: 52,
                border: `3px solid ${color}`,
                boxShadow: `0 0 0 1px ${color}44, 0 4px 12px ${color}33`,
              }}
            >
              <img
                src={getAvatarUrl(e.full_name)}
                alt={e.full_name}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-xs font-semibold" style={{ color: "#374151" }}>
              {firstName(e.full_name)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────────────

export default function WeeklyChallengesPage() {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [engagement, setEngagement] = useState<Engagement[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // Load current user
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("email", user.email)
        .single();

      setCurrentUser({ id: user.id, full_name: profile?.full_name ?? "" });
    };
    init();
  }, []);

  // fetchData is a plain async function — not a hook, not a dependency
  async function fetchData() {
    const mondayStr = getCurrentWeekMonday();
    const { data: challengeData } = await supabase
      .from("weekly_challenges")
      .select("*")
      .eq("week_start", mondayStr)
      .single();

    setChallenge(challengeData ?? null);

    if (challengeData) {
      const { data: engData } = await supabase
        .from("challenge_engagement")
        .select("*")
        .eq("challenge_id", challengeData.id);
      setEngagement((engData ?? []) as Engagement[]);
    }
  }

  // Stable ref so handleAccept/handleComplete can call refresh without deps
  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  const load = useCallback(() => fetchDataRef.current(), []);

  // Initial load — empty deps, no setState called directly in effect body
  useEffect(() => {
    setLoading(true);
    fetchDataRef.current().finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive myStatus directly — no setState in useEffect
  const myStatus: "none" | "accepted" | "completed" = (() => {
    if (!currentUser) return "none";
    const mine = engagement.find((e) => e.user_id === currentUser.id);
    return mine ? (mine.status as "accepted" | "completed") : "none";
  })();

  const handleAccept = async () => {
    if (!challenge || !currentUser || acting) return;
    setActing(true);

    const { error } = await supabase
      .from("challenge_engagement")
      .upsert({
        challenge_id: challenge.id,
        user_id: currentUser.id,
        full_name: currentUser.full_name,
        status: "accepted",
      }, { onConflict: "challenge_id,user_id" });

    if (!error) {
      // Optimistic update
      setEngagement((prev) => {
        const exists = prev.find((e) => e.user_id === currentUser.id);
        if (exists) return prev.map((e) => e.user_id === currentUser.id ? { ...e, status: "accepted" } : e);
        return [...prev, {
          id: Date.now(),
          challenge_id: challenge.id,
          user_id: currentUser.id,
          full_name: currentUser.full_name,
          status: "accepted",
          created_at: new Date().toISOString(),
        }];
      });
    }

    setActing(false);
  };

  const handleComplete = async () => {
    if (!challenge || !currentUser || acting) return;
    setActing(true);

    const { error } = await supabase
      .from("challenge_engagement")
      .upsert({
        challenge_id: challenge.id,
        user_id: currentUser.id,
        full_name: currentUser.full_name,
        status: "completed",
      }, { onConflict: "challenge_id,user_id" });

    if (!error) {
      setEngagement((prev) =>
        prev.map((e) =>
          e.user_id === currentUser.id ? { ...e, status: "completed" } : e
        )
      );
    }

    setActing(false);
  };

  const accepted  = engagement.filter((e) => e.status === "accepted");
  const completed = engagement.filter((e) => e.status === "completed");

  const weekLabel = challenge?.week_start
    ? new Date(challenge.week_start + "T12:00:00Z").toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      })
    : null;

  return (
    <AuthGuard>
      <div className="min-h-screen -mx-6 -my-10" style={{ background: "#f8f7f4" }}>

        {/* ── Hero banner ── */}
        <div
          className="relative px-6 py-16 text-center overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
          }}
        >
          {/* Decorative blobs */}
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
            {/* Week label */}
            {weekLabel && (
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase"
                style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                📅 Week of {weekLabel}
              </div>
            )}

            <h1
              className="text-5xl sm:text-7xl font-black tracking-tight"
              style={{
                color: "#fff",
                textShadow: "0 2px 20px rgba(0,0,0,0.3)",
                lineHeight: 1.1,
              }}
            >
              Weekly<br />
              <span style={{ color: "#a78bfa" }}>Challenge</span>
            </h1>

            {/* Countdown */}
            <div className="space-y-2">
              <div className="text-xs font-semibold tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>
                Resets Monday at 3 PM CET
              </div>
              <Countdown />
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="max-w-2xl mx-auto px-6 py-12 space-y-10">

          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-8 bg-gray-200 rounded-xl w-3/4 mx-auto" />
              <div className="h-5 bg-gray-200 rounded-xl w-1/2 mx-auto" />
            </div>
          ) : !challenge ? (
            <div className="text-center py-16 space-y-3">
              <div style={{ fontSize: 56 }}>🏖️</div>
              <div className="text-xl font-bold text-gray-700">No challenge this week</div>
              <div className="text-gray-400 text-sm">Check back soon — one is coming!</div>
            </div>
          ) : (
            <>
              {/* ── Challenge card ── */}
              <div
                className="rounded-3xl p-8 space-y-6 text-center shadow-lg"
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 40px rgba(0,0,0,0.06)",
                }}
              >
                <div style={{ fontSize: 52 }}>🏆</div>

                <div
                  className="text-2xl sm:text-3xl font-bold leading-snug"
                  style={{ color: "#111" }}
                >
                  {challenge.challenge}
                </div>

                {challenge.bonus && (
                  <div
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold"
                    style={{ background: "#fef3c7", color: "#92400e" }}
                  >
                    ⭐ Bonus: {challenge.bonus}
                  </div>
                )}

                {/* ── CTA buttons ── */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  {myStatus === "none" && (
                    <button
                      onClick={handleAccept}
                      disabled={acting}
                      className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition hover:scale-105 active:scale-95"
                      style={{
                        background: acting ? "#9ca3af" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                        boxShadow: "0 4px 15px rgba(99,102,241,0.4)",
                        cursor: acting ? "wait" : "pointer",
                      }}
                    >
                      {acting ? "Saving…" : "✋ I accept this challenge!"}
                    </button>
                  )}

                  {myStatus === "accepted" && (
                    <>
                      <div
                        className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold"
                        style={{ background: "#ede9fe", color: "#6d28d9" }}
                      >
                        ✋ Challenge accepted!
                      </div>
                      <button
                        onClick={handleComplete}
                        disabled={acting}
                        className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-bold text-white transition hover:scale-105 active:scale-95"
                        style={{
                          background: acting ? "#9ca3af" : "linear-gradient(135deg, #10b981, #059669)",
                          boxShadow: "0 4px 15px rgba(16,185,129,0.35)",
                          cursor: acting ? "wait" : "pointer",
                        }}
                      >
                        {acting ? "Saving…" : "🏅 Mark as completed!"}
                      </button>
                    </>
                  )}

                  {myStatus === "completed" && (
                    <div
                      className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold"
                      style={{
                        background: "linear-gradient(135deg, #d1fae5, #a7f3d0)",
                        color: "#065f46",
                        boxShadow: "0 4px 15px rgba(16,185,129,0.2)",
                      }}
                    >
                      🏅 You completed this challenge!
                    </div>
                  )}
                </div>
              </div>

              {/* ── Engagement board ── */}
              {(accepted.length > 0 || completed.length > 0) && (
                <div
                  className="rounded-3xl p-8 space-y-8"
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 40px rgba(0,0,0,0.06)",
                  }}
                >
                  <div className="text-lg font-bold" style={{ color: "#111" }}>
                    Family Scoreboard
                  </div>

                  <EngagementRow
                    label="Completed"
                    emoji="🏅"
                    people={completed}
                    color="#059669"
                  />

                  <EngagementRow
                    label="Accepted"
                    emoji="✋"
                    people={accepted}
                    color="#6366f1"
                  />
                </div>
              )}

              {/* ── Nudge if nobody has engaged ── */}
              {engagement.length === 0 && (
                <div className="text-center py-6 space-y-2">
                  <div style={{ fontSize: 40 }}>👀</div>
                  <div className="text-gray-500 text-sm font-medium">
                    Nobody has accepted yet — be the first!
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
