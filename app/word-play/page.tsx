"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/app/components/AuthGuard";
import { createClient } from "@supabase/supabase-js";
import { Alfa_Slab_One } from "next/font/google";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const alfaSlab = Alfa_Slab_One({
  weight: "400",
  subsets: ["latin"],
});

/* -----------------------------
   Helpers
----------------------------- */

function getAvatarUrl(name: string) {
  const fileName = name.toLowerCase().replaceAll(" ", "-") + ".jpg";
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`;
}

function getFirstName(fullName: string) {
  return fullName.split(" ")[0];
}

/* -----------------------------
   Reset Clock Logic
----------------------------- */

function getNextResetDate() {
  const now = new Date();
  const day = now.getUTCDay(); // Monday = 1
  const diff = (8 - day) % 7;

  const nextMonday = new Date(now);
  nextMonday.setUTCDate(now.getUTCDate() + diff);
  nextMonday.setUTCHours(20, 0, 0, 0); // 3PM Central ≈ 20:00 UTC

  return nextMonday;
}

/* -----------------------------
   Move Engine
----------------------------- */

function isDropOneLetter(a: string, b: string) {
  if (a.length !== b.length + 1) return false;

  for (let i = 0; i < a.length; i++) {
    if (a.slice(0, i) + a.slice(i + 1) === b) return true;
  }

  return false;
}

function isRearrange(a: string, b: string) {
  if (a.length !== b.length) return false;
  if (a === b) return false;

  const sortA = a.split("").sort().join("");
  const sortB = b.split("").sort().join("");

  return sortA === sortB;
}

function isChangeTwoLetters(a: string, b: string) {
  if (a.length !== b.length) return false;

  let diffs = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diffs++;
    if (diffs > 2) return false;
  }

  return diffs === 2;
}

function isAddThreeLetters(a: string, b: string) {
  if (b.length !== a.length + 3) return false;

  if (b.startsWith(a)) return false; // prefix
  if (b.endsWith(a)) return false;   // suffix

  return b.includes(a);
}

function classifyMove(a: string, b: string) {
  if (isDropOneLetter(a, b)) return { valid: true, points: 3, type: "DROP" };
  if (isChangeTwoLetters(a, b)) return { valid: true, points: 2, type: "CHANGE" };
  if (isRearrange(a, b)) return { valid: true, points: 5, type: "REARRANGE" };
  if (isAddThreeLetters(a, b)) return { valid: true, points: 7, type: "ADD" };

  return { valid: false };
}

/* -----------------------------
   Banner
----------------------------- */

const WordSmithBanner = () => {
  const letters = "WordSmith".split("");

  return (
    <div className={`${alfaSlab.className} text-4xl sm:text-6xl tracking-widest select-none`}>
      {letters.map((l, i) => {
        const rotation = [-2, 1, -1.5, 0.5, -0.8, 1.2, -1.1, 0.7, -0.6][i] || 0;

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              transform: `rotate(${rotation}deg) scale(0.6)`,
              animation: `type-stamp 420ms cubic-bezier(.2,.7,.3,1) forwards`,
              animationDelay: `${i * 140}ms`   // ← BIG change (slower)
            }}
            className="px-2"
          >
            {l}
          </span>
        );
      })}
    </div>
  );
};

/* -----------------------------
   Page
----------------------------- */

export default function WordSmithPage() {
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const [playedWords, setPlayedWords] = useState<string[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [dictionary, setDictionary] = useState<Set<string> | null>(null);
  const [nextWord, setNextWord] = useState("");
  const [timeLeft, setTimeLeft] = useState("");

  const loadAll = async () => {
    const { data: game } = await supabase
      .from("wordplay_game")
      .select("*")
      .single();

    if (game) {
      setCurrentWord(game.current_word);
      setPlayedWords(game.played_words ?? []);
    }

    const { data: activePlayers } = await supabase
      .from("active_profiles")
      .select("email, full_name");

    const { data: scoreRows } = await supabase
      .from("wordsmith_scores")
      .select("*")
      .order("points", { ascending: false });

    if (activePlayers) {
      const merged = activePlayers.map(player => {
        const playerHistory: Record<string, string[]> = {};

        (game.played_words ?? []).forEach((word: string) => {
          const scorer = scoreRows?.find(s => s.last_word === word);
          if (!scorer) return;

          if (!playerHistory[scorer.email]) {
            playerHistory[scorer.email] = [];
          }

          playerHistory[scorer.email].push(word);
        });
        const score = scoreRows?.find(s => s.email === player.email);

        return {
          email: player.email,
          full_name: player.full_name,
          points: score?.points ?? 0,
          last_word: score?.last_word ?? null,
          history: playerHistory[player.email] ?? []
        };
      });

      merged.sort((a, b) => b.points - a.points);

      setScores(merged);
    }

  };

  useEffect(() => {
    loadAll();

    fetch("/words.txt")
      .then(r => r.text())
      .then(text => {
        const words = text.split("\n").map(w => w.trim().toLowerCase());
        setDictionary(new Set(words));
      });

    const timer = setInterval(() => {
      const diff = getNextResetDate().getTime() - Date.now();

      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);

      setTimeLeft(`${hours}h ${mins}m`);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const submitMove = async () => {
    if (!currentWord || !nextWord) return;

    const cleanWord = nextWord
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "");
    if (!dictionary) {
      alert("Dictionary not loaded yet");
      return;
    }

    if (!dictionary.has(cleanWord)) {
      alert("Not in dictionary");
      return;
    }

    if (playedWords.includes(cleanWord)) {
      alert("Already used");
      return;
    }

    if (cleanWord === currentWord) {
      alert("Word must change");
      return;
    }

    const move = classifyMove(currentWord, cleanWord);
    if (!move.valid) {
      alert(`Invalid move.\n\nAllowed:\n• Drop 1 letter\n• Change 2 letters\n• Rearrange letters\n• Add 3 letters (not prefix/suffix)`);
      return;
    }

    const playerEmail = "local_player";
    const existing = scores.find(s => s.email === playerEmail);

    if (playerEmail === (await supabase
      .from("wordplay_game")
      .select("last_player_email")
      .single()).data?.last_player_email) {
      alert("Cannot play twice in a row");
      return;
    }

    await supabase.from("wordplay_game").update({
      current_word: cleanWord,
      played_words: [...playedWords, cleanWord],
      last_player_email: playerEmail,
      updated_at: new Date().toISOString()
    }).eq("id", 1);

    await supabase.from("wordsmith_scores").upsert({
      email: playerEmail,
      full_name: existing?.full_name ?? "Local Player",
      points: (existing?.points ?? 0) + move.points,
      last_word: cleanWord,
      updated_at: new Date().toISOString()
    });

    setNextWord("");
    loadAll();
  };

  const resetGame = async () => {
    const seed = "planet";

    await supabase.from("wordplay_game").update({
      current_word: seed,
      played_words: [seed],
      last_player_email: null,
      updated_at: new Date().toISOString()
    }).eq("id", 1);

    await supabase.from("wordsmith_scores").delete().neq("email", "");

    loadAll();
  };

  const preview =
    currentWord && nextWord
      ? classifyMove(currentWord, nextWord.trim().toLowerCase().replace(/[^a-z]/g, ""))
      : null;

  return (
    <AuthGuard>
      <div className="space-y-6">

        <WordSmithBanner />

        <div className="text-sm text-gray-500">
          Next Reset: {timeLeft}
        </div>

        <div className="text-xl font-semibold">
          Current Word: {currentWord}
        </div>

        <div className="text-sm bg-white rounded-xl p-3 ring-1 ring-gray-200">
          <strong>R U L E S:</strong>
          <div className="mt-4">Game play starts every Monday at 3 PM Central European Time.</div>
          <div className="mt-4">Game play ends every Monday at 2:59 PM Central European Time.</div>
          <div className="mt-4">During that time players can earn points by creating a new word from the current word.</div>
          <div className="mt-4">Players can create new words from the current word in 1 of 4 ways : </div>
          <div className="mt-4">Change two letters → 2 pts (alarm → alert)</div>
          <div className="mt-4">Drop one letter → 3 pts (agent → gent)</div>
          <div className="mt-4">Rearrange the letters → 5 pts (latent → talent)</div>
          <div className="mt-4">Add 3 letters - CANNOT BE PREFIX or SUFFIX → 7 pts (tile → tensile)</div>
          <div className="mt-4">Cannot use a word that has already been played during current game.</div>
          <div className="mt-4">No player can play two words in a row. </div>
        </div>

        <div className="flex flex-wrap gap-6">
          {scores.map((player, index) => {
            const scale = 1 + player.points / 100;

            const isLeader = index === 0;
            const isActiveLeader = index === 0 && player.points > 0;

            return (
            <div
              key={player.email}
              className="flex flex-col items-center hover:scale-105 transition-transform"
            >
              <div className="text-xs font-bold text-gray-400">
                #{index + 1}
              </div>

              {isActiveLeader && (
                <div className="text-lg -mb-1 animate-[crown-pop_180ms_ease-out]">👑</div>
              )}

              <div
                style={{
                  transform: `scale(${scale})`,
                  transition: "0.3s ease"
                }}
                className={`h-20 w-20 rounded-2xl overflow-hidden ring-2 transition-all
                  ${isActiveLeader
                    ? "ring-yellow-400 shadow-lg"
                    : isLeader
                    ? "ring-gray-300"
                    : "ring-transparent"}
                `}
              >
                  <img
                    src={getAvatarUrl(player.full_name)}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="text-sm font-semibold">
                  {getFirstName(player.full_name)}
                </div>

                <div className="text-xs text-gray-500">
                  {player.points} pts
                </div>

                <div className="text-xs">
                  {player.last_word}
                </div>
                <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                  {player.history?.map((word: string) => (
                    <div key={word}>{word}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <input
          value={nextWord}
          onChange={e => setNextWord(e.target.value)}
          placeholder="Enter word"
          className="border rounded-lg px-3 py-2"
        />

        <button onClick={submitMove} className="pill pill-active">
          Submit
        </button>

        <div className="text-sm">
          {preview?.valid
            ? `VALID (${preview.type} → ${preview.points} pts)`
            : nextWord
            ? "INVALID"
            : "-"}
        </div>

        <button onClick={resetGame} className="text-xs underline">
          Reset Game
        </button>

      </div>
    </AuthGuard>
  );
}
