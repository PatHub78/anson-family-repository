"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import AuthGuard from "@/app/components/AuthGuard";
import { createClient } from "@supabase/supabase-js";
import { Alfa_Slab_One } from "next/font/google";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const alfaSlab = Alfa_Slab_One({ weight: "400", subsets: ["latin"] });

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

interface GameState {
  current_word: string;
  played_words: string[];
  last_player_email: string | null;
  updated_at: string;
}

interface ScoreRow {
  email: string;
  full_name: string;
  points: number;
  last_word: string | null;
  words_played: string[];
}

interface Winner {
  id: number;
  full_name: string;
  email: string;
  points: number;
  winning_word: string | null;
  week_start: string;
}

interface FloatingPoint {
  id: number;
  points: number;
  type: string;
  x: number;
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

/** Current week's Monday in UTC */
function getCurrentWeekMonday(): string {
  const now = new Date();
  const utcDay = now.getUTCDay();
  const diff = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff
  ));
  return monday.toISOString().split("T")[0];
}

/** Next Monday 15:00 CET (UTC+1) */
function getNextResetDate(): Date {
  const now = new Date();
  const CET = 1 * 60 * 60 * 1000;
  const nowCET = new Date(now.getTime() + CET);
  const utcDay = nowCET.getUTCDay();
  // Days until next Monday (always at least 1 if it's Monday and past 15:00)
  let daysUntil = utcDay === 1
    ? (nowCET.getUTCHours() >= 15 ? 7 : 0)
    : utcDay === 0 ? 1 : (8 - utcDay) % 7;

  const nextMonday = new Date(Date.UTC(
    nowCET.getUTCFullYear(),
    nowCET.getUTCMonth(),
    nowCET.getUTCDate() + daysUntil,
    14, 0, 0 // 15:00 CET = 14:00 UTC
  ));
  return nextMonday;
}

function getTimeRemaining() {
  const diff = getNextResetDate().getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

function pad(n: number) { return String(n).padStart(2, "0"); }

// ────────────────────────────────────────────────────────────────────
// Move Engine (unchanged logic, cleaner structure)
// ────────────────────────────────────────────────────────────────────

function isDropOneLetter(a: string, b: string) {
  if (a.length !== b.length + 1) return false;
  for (let i = 0; i < a.length; i++)
    if (a.slice(0, i) + a.slice(i + 1) === b) return true;
  return false;
}

function isRearrange(a: string, b: string) {
  if (a.length !== b.length || a === b) return false;
  return a.split("").sort().join("") === b.split("").sort().join("");
}

function isChangeTwoLetters(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diffs = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++diffs > 2) return false;
  return diffs === 2;
}

function isAddThreeLetters(a: string, b: string) {
  if (b.length !== a.length + 3) return false;
  if (b.startsWith(a) || b.endsWith(a)) return false;
  let i = 0;
  for (let j = 0; j < b.length; j++) if (b[j] === a[i]) { i++; if (i === a.length) break; }
  return i === a.length;
}

const MOVES = [
  { check: isDropOneLetter,    points: 3, type: "DROP",      label: "Drop a letter",    color: "#f59e0b" },
  { check: isChangeTwoLetters, points: 2, type: "CHANGE",    label: "Change 2 letters", color: "#3b82f6" },
  { check: isRearrange,        points: 5, type: "REARRANGE", label: "Rearrange",        color: "#8b5cf6" },
  { check: isAddThreeLetters,  points: 7, type: "ADD",       label: "Add 3 letters",    color: "#10b981" },
];

function classifyMove(a: string, b: string) {
  for (const move of MOVES)
    if (move.check(a, b)) return { valid: true, ...move };
  return { valid: false, points: 0, type: "", label: "", color: "" };
}

// ────────────────────────────────────────────────────────────────────
// Word Tile
// ────────────────────────────────────────────────────────────────────

function WordTile({ letter, delay = 0, big = false }: { letter: string; delay?: number; big?: boolean }) {
  return (
    <div
      className={`${alfaSlab.className} inline-flex items-center justify-center rounded-xl font-black select-none`}
      style={{
        width: big ? 56 : 40,
        height: big ? 64 : 48,
        background: "linear-gradient(145deg, #fff 0%, #f3f4f6 100%)",
        boxShadow: "0 2px 0 #d1d5db, 0 4px 8px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.8)",
        fontSize: big ? 28 : 20,
        color: "#1f2937",
        border: "1px solid #e5e7eb",
        animation: `tileIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both`,
        animationDelay: `${delay}ms`,
      }}
    >
      {letter.toUpperCase()}
    </div>
  );
}

function WordDisplay({ word, big = false }: { word: string; big?: boolean }) {
  return (
    <div className="flex gap-1.5 justify-center flex-wrap">
      {word.split("").map((l, i) => (
        <WordTile key={`${word}-${i}`} letter={l} delay={i * 60} big={big} />
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Countdown
// ────────────────────────────────────────────────────────────────────

function Countdown() {
  const [time, setTime] = useState(getTimeRemaining());
  useEffect(() => {
    const t = setInterval(() => setTime(getTimeRemaining()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex items-center justify-center gap-2 text-sm">
      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
        Next reset
      </span>
      <span style={{ color: "rgba(255,255,255,0.85)", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
        {time.days > 0 && `${time.days}d `}{pad(time.hours)}h {pad(time.minutes)}m {pad(time.seconds)}s
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Move Rules Card
// ────────────────────────────────────────────────────────────────────

function RulesCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-gray-700 hover:bg-gray-50 transition"
      >
        <span>📖 How to Play</span>
        <span style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "0.2s" }}>▾</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100">
          <p className="text-sm text-gray-500 pt-3">
            Each week starts with a seed word. Transform it by one of four moves, earn points, climb the leaderboard. You <strong>cannot play twice in a row</strong>.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {MOVES.map((m) => (
              <div
                key={m.type}
                className="rounded-xl p-3 space-y-1"
                style={{ background: m.color + "14", border: `1px solid ${m.color}33` }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: m.color }}>
                    {m.label}
                  </span>
                  <span
                    className="text-xs font-black px-2 py-0.5 rounded-full"
                    style={{ background: m.color, color: "#fff" }}
                  >
                    +{m.points}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {m.type === "DROP"      && "alarm → larm"}
                  {m.type === "CHANGE"    && "alarm → alert"}
                  {m.type === "REARRANGE" && "latent → talent"}
                  {m.type === "ADD"       && "tile → tensile"}
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400">
            Add 3 letters cannot be a simple prefix or suffix. Words must be in the dictionary. No repeats.
          </p>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────────────

export default function WordSmithPage() {
  const [game, setGame]           = useState<GameState | null>(null);
  const [scores, setScores]       = useState<ScoreRow[]>([]);
  const [winners, setWinners]     = useState<Winner[]>([]);
  const [dictionary, setDictionary] = useState<Set<string> | null>(null);
  const [nextWord, setNextWord]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [myEmail, setMyEmail]     = useState<string | null>(null);
  const [myName, setMyName]       = useState<string>("");
  const [error, setError]         = useState<string | null>(null);
  const [floaters, setFloaters]   = useState<FloatingPoint[]>([]);
  const [justPlayed, setJustPlayed] = useState<string | null>(null);
  const floaterIdRef = useRef(0);

  // Load dictionary
  useEffect(() => {
    fetch("/words.txt")
      .then((r) => r.text())
      .then((text) => {
        setDictionary(new Set(text.split("\n").map((w) => w.trim().toLowerCase()).filter(Boolean)));
      });
  }, []);

  // Load current user
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      setMyEmail(user.email);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("email", user.email)
        .single();
      setMyName(profile?.full_name ?? "");
    };
    init();
  }, []);

  // Load game state + scores + winners
  const loadAll = useCallback(async () => {
    const [{ data: gameData }, { data: scoreData }, { data: winnerData }, { data: activePlayers }] =
      await Promise.all([
        supabase.from("wordsmith_game").select("*").single(),
        supabase.from("wordsmith_scores").select("*").order("points", { ascending: false }),
        supabase.from("wordsmith_winners").select("*").order("week_start", { ascending: false }).limit(10),
        supabase.from("profiles").select("email, full_name"),
      ]);

    if (gameData) setGame(gameData);

    // Build per-player word history from played_words + scores
    const playedWords: string[] = gameData?.played_words ?? [];
    const scoreMap = new Map((scoreData ?? []).map((s: any) => [s.email, s]));

    const merged: ScoreRow[] = (activePlayers ?? []).map((p: any) => {
      const s: any = scoreMap.get(p.email);
      // words_played is stored in wordsmith_scores if you add the column,
      // otherwise we fall back to last_word only
      return {
        email: p.email,
        full_name: p.full_name,
        points: s?.points ?? 0,
        last_word: s?.last_word ?? null,
        words_played: s?.words_played ?? [],
      };
    });

    merged.sort((a, b) => b.points - a.points);
    setScores(merged);
    setWinners((winnerData ?? []) as Winner[]);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Check if reset is needed when page loads or tab regains focus
  useEffect(() => {
    const checkReset = async () => {
      const { data: gameData } = await supabase.from("wordsmith_game").select("updated_at").single();
      if (!gameData) return;

      const lastUpdate = new Date(gameData.updated_at).getTime();
      const resetTime  = getNextResetDate().getTime() - 7 * 24 * 60 * 60 * 1000; // last reset

      // If last update was before most recent reset window, auto-reset
      if (lastUpdate < resetTime) {
        await handleAutoReset();
      }
    };
    checkReset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAutoReset = async () => {
    // Save winner before clearing
    const { data: topScore } = await supabase
      .from("wordsmith_scores")
      .select("*")
      .order("points", { ascending: false })
      .limit(1)
      .single();

    if (topScore && topScore.points > 0) {
      await supabase.from("wordsmith_winners").insert({
        full_name:    topScore.full_name,
        email:        topScore.email,
        points:       topScore.points,
        winning_word: topScore.last_word,
        week_start:   getCurrentWeekMonday(),
      });
    }

    const seeds = ["planet", "bridge", "flame", "storm", "silver", "forest", "shadow", "anchor"];
    const seed = seeds[Math.floor(Math.random() * seeds.length)];

    await supabase.from("wordsmith_game").update({
      current_word:       seed,
      played_words:       [seed],
      last_player_email:  null,
      updated_at:         new Date().toISOString(),
    }).eq("id", 1);

    await supabase.from("wordsmith_scores").delete().neq("email", "");
    loadAll();
  };

  const addFloater = (points: number, type: string) => {
    const id = ++floaterIdRef.current;
    const x = 40 + Math.random() * 20;
    setFloaters((prev) => [...prev, { id, points, type, x }]);
    setTimeout(() => setFloaters((prev) => prev.filter((f) => f.id !== id)), 1500);
  };

  const submitMove = async () => {
    if (!game || !nextWord || submitting) return;
    setError(null);

    const clean = nextWord.trim().toLowerCase().replace(/[^a-z]/g, "");

    if (clean.length < 3) return setError("Word must be at least 3 letters.");
    if (!dictionary)      return setError("Dictionary still loading…");
    if (!dictionary.has(clean)) return setError(`"${clean}" is not in the dictionary.`);
    if (game.played_words.includes(clean)) return setError(`"${clean}" has already been played this round.`);
    if (clean === game.current_word)       return setError("Word must change.");
    if (myEmail && myEmail === game.last_player_email) return setError("You can't play two words in a row — let someone else go!");

    const move = classifyMove(game.current_word, clean);
    if (!move.valid) return setError("Invalid move. Check the rules below for allowed transformations.");

    setSubmitting(true);

    // Update game state
    const newPlayedWords = [...game.played_words, clean];
    await supabase.from("wordsmith_game").update({
      current_word:      clean,
      played_words:      newPlayedWords,
      last_player_email: myEmail,
      updated_at:        new Date().toISOString(),
    }).eq("id", 1);

    // Update score
    const { data: existing } = await supabase
      .from("wordsmith_scores")
      .select("points, full_name")
      .eq("email", myEmail)
      .single();

    const newPoints = (existing?.points ?? 0) + move.points;

    await supabase.from("wordsmith_scores").upsert({
      email:      myEmail,
      full_name:  myName || existing?.full_name || "Player",
      points:     newPoints,
      last_word:  clean,
      updated_at: new Date().toISOString(),
    });

    addFloater(move.points, move.type);
    setJustPlayed(clean);
    setTimeout(() => setJustPlayed(null), 2000);
    setNextWord("");
    setSubmitting(false);
    loadAll();
  };

  const currentWord = game?.current_word ?? "";
  const clean = nextWord.trim().toLowerCase().replace(/[^a-z]/g, "");
  const preview = currentWord && clean ? classifyMove(currentWord, clean) : null;
  const isMyTurn = myEmail !== game?.last_player_email;

  return (
    <AuthGuard>
      <div className="min-h-screen -mx-6 -my-10" style={{ background: "#f8f7f4" }}>

        {/* ── Hero ── */}
        <div
          className="relative px-6 py-12 text-center overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}
        >
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div style={{ position:"absolute", top:"-60px", right:"-60px", width:"300px", height:"300px", borderRadius:"50%", background:"radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)" }} />
            <div style={{ position:"absolute", bottom:"-40px", left:"-40px", width:"240px", height:"240px", borderRadius:"50%", background:"radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)" }} />
          </div>

          <div className="relative space-y-4">
            <h1
              className={`${alfaSlab.className} text-6xl sm:text-8xl tracking-widest`}
              style={{ color: "#fff", textShadow: "0 0 40px rgba(139,92,246,0.6), 0 4px 0 rgba(0,0,0,0.3)" }}
            >
              WordSmith
            </h1>
            <Countdown />
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">

          {/* ── Current word ── */}
          <div
            className="rounded-3xl p-8 text-center space-y-4 relative overflow-hidden"
            style={{ background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 40px rgba(0,0,0,0.06)" }}
          >
            {/* Floating point notifications */}
            {floaters.map((f) => (
              <div
                key={f.id}
                className="absolute pointer-events-none font-black text-2xl"
                style={{
                  left: `${f.x}%`,
                  top: "20%",
                  color: MOVES.find((m) => m.type === f.type)?.color ?? "#111",
                  animation: "floatUp 1.5s ease-out forwards",
                  textShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  zIndex: 10,
                }}
              >
                +{f.points}
              </div>
            ))}

            <div className="text-xs font-bold uppercase tracking-widest text-gray-400">Current Word</div>

            {currentWord ? (
              <WordDisplay word={currentWord} big />
            ) : (
              <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            )}

            {game?.last_player_email && (
              <div className="text-xs text-gray-400">
                Last played by{" "}
                <span className="font-semibold text-gray-600">
                  {firstName(scores.find((s) => s.email === game.last_player_email)?.full_name ?? game.last_player_email)}
                </span>
              </div>
            )}
          </div>
          
          {/* ── Rules ── */}
          <RulesCard />

          {/* ── Input ── */}
          <div
            className="rounded-3xl p-6 space-y-4"
            style={{ background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 40px rgba(0,0,0,0.06)" }}
          >
            {!isMyTurn && (
              <div
                className="text-center text-sm font-semibold px-4 py-3 rounded-2xl"
                style={{ background: "#fef3c7", color: "#92400e" }}
              >
                ⏳ You just played — wait for someone else to go before playing again.
              </div>
            )}

            <div className="flex gap-3">
              <input
                value={nextWord}
                onChange={(e) => { setNextWord(e.target.value); setError(null); }}
                onKeyDown={(e) => e.key === "Enter" && submitMove()}
                placeholder="Your word…"
                disabled={!isMyTurn || submitting}
                className="flex-1 rounded-2xl px-4 py-3 text-base font-semibold focus:outline-none transition"
                style={{
                  border: error ? "2px solid #ef4444" : preview?.valid ? `2px solid ${preview.color}` : "2px solid #e5e7eb",
                  background: !isMyTurn ? "#f9fafb" : "#fff",
                  color: "#111",
                }}
              />
              <button
                onClick={submitMove}
                disabled={!isMyTurn || submitting || !nextWord}
                className="px-6 py-3 rounded-2xl font-bold text-white transition hover:scale-105 active:scale-95"
                style={{
                  background: (!isMyTurn || !nextWord) ? "#d1d5db" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  cursor: (!isMyTurn || !nextWord) ? "default" : "pointer",
                  boxShadow: (!isMyTurn || !nextWord) ? "none" : "0 4px 15px rgba(99,102,241,0.4)",
                }}
              >
                {submitting ? "…" : "Play →"}
              </button>
            </div>

            {/* Preview */}
            {clean && !error && (
              <div
                className="flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl"
                style={{
                  background: preview?.valid ? (preview.color + "14") : "#fef2f2",
                  color: preview?.valid ? preview.color : "#ef4444",
                }}
              >
                {preview?.valid
                  ? <><span>✓</span><span>{preview.label}</span><span className="ml-auto font-black">+{preview.points} pts</span></>
                  : <><span>✗</span><span>Invalid move</span></>
                }
              </div>
            )}

            {error && (
              <div className="text-sm font-medium text-red-500 px-1">{error}</div>
            )}
          </div>

          {/* ── Leaderboard ── */}
          <div
            className="rounded-3xl overflow-hidden"
            style={{ background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 40px rgba(0,0,0,0.06)" }}
          >
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="font-bold text-gray-900">🏆 This Week's Standings</div>
            </div>

            {scores.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-400">
                No scores yet — be the first to play!
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {scores.map((player, i) => {
                  const isMe = player.email === myEmail;
                  const isLeader = i === 0 && player.points > 0;
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;

                  return (
                    <div
                      key={player.email}
                      className="flex items-center gap-4 px-6 py-4 transition"
                      style={{ background: isMe ? "#f5f3ff" : "transparent" }}
                    >
                      {/* Rank */}
                      <div className="w-8 text-center">
                        {medal
                          ? <span style={{ fontSize: 22 }}>{medal}</span>
                          : <span className="text-sm font-bold text-gray-400">#{i + 1}</span>
                        }
                      </div>

                      {/* Avatar */}
                      <div
                        className="rounded-2xl overflow-hidden shrink-0"
                        style={{
                          width: 48, height: 48,
                          border: `3px solid ${isLeader ? "#f59e0b" : isMe ? "#8b5cf6" : "#e5e7eb"}`,
                          boxShadow: isLeader ? "0 0 12px rgba(245,158,11,0.4)" : "none",
                        }}
                      >
                        <img src={getAvatarUrl(player.full_name)} alt={player.full_name} className="w-full h-full object-cover" />
                      </div>

                      {/* Name + last word */}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-gray-900 flex items-center gap-1">
                          {firstName(player.full_name)}
                          {isMe && <span className="text-xs font-normal text-purple-500">(you)</span>}
                          {isLeader && <span className="text-base">👑</span>}
                        </div>
                        {player.last_word && (
                          <div className="text-xs text-gray-400 truncate">
                            last: <span className="font-semibold text-gray-600">{player.last_word}</span>
                          </div>
                        )}
                      </div>

                      {/* Points */}
                      <div className="text-right shrink-0">
                        <div
                          className="text-lg font-black"
                          style={{ color: isLeader ? "#f59e0b" : isMe ? "#8b5cf6" : "#111" }}
                        >
                          {player.points}
                        </div>
                        <div className="text-xs text-gray-400">pts</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Played words this round ── */}
          {game?.played_words && game.played_words.length > 1 && (
            <div
              className="rounded-3xl p-6 space-y-4"
              style={{ background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 40px rgba(0,0,0,0.06)" }}
            >
              <div className="font-bold text-gray-900 text-sm">📝 Word Chain This Round</div>
              <div className="flex flex-wrap gap-2">
                {game.played_words.map((word, i) => (
                  <div key={word} className="flex items-center gap-1">
                    {i > 0 && <span className="text-gray-300 text-xs">→</span>}
                    <span
                      className="px-3 py-1 rounded-full text-xs font-bold"
                      style={{
                        background: word === currentWord ? "#1f2937" : "#f3f4f6",
                        color: word === currentWord ? "#fff" : "#6b7280",
                      }}
                    >
                      {word}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Hall of Fame ── */}
          {winners.length > 0 && (
            <div
              className="rounded-3xl overflow-hidden"
              style={{ background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 40px rgba(0,0,0,0.06)" }}
            >
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="font-bold text-gray-900">🏅 Hall of Fame</div>
                <div className="text-xs text-gray-400 mt-0.5">Past weekly winners</div>
              </div>
              <div className="divide-y divide-gray-50">
                {winners.map((w) => (
                  <div key={w.id} className="flex items-center gap-4 px-6 py-3">
                    <div
                      className="rounded-xl overflow-hidden shrink-0"
                      style={{ width: 40, height: 40, border: "2px solid #fde68a" }}
                    >
                      <img src={getAvatarUrl(w.full_name)} alt={w.full_name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-gray-900">{firstName(w.full_name)}</div>
                      <div className="text-xs text-gray-400">
                        Week of{" "}
                        {new Date(w.week_start + "T12:00:00Z").toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                        {w.winning_word && <> · last word: <span className="font-semibold text-gray-600">{w.winning_word}</span></>}
                      </div>
                    </div>
                    <div className="text-sm font-black text-amber-500">{w.points} pts</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes tileIn {
          from { opacity: 0; transform: translateY(-12px) scale(0.8); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes floatUp {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-80px) scale(1.3); }
        }
      `}</style>
    </AuthGuard>
  );
}
