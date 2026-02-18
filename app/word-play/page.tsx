"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/app/components/AuthGuard";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function getAvatarUrl(name: string) {
  const fileName = name.toLowerCase().replaceAll(" ", "-") + ".jpg";
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`;
}

function getFirstName(fullName: string) {
  return fullName.split(" ")[0];
}

export default function WordPlayPage() {
  const [words, setWords] = useState<Set<string> | null>(null);
  const [nextWord, setNextWord] = useState("");
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const [playedWords, setPlayedWords] = useState<string[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<string | null>(null);

  useEffect(() => {
    const loadWords = async () => {
      // ✅ Load dictionary
      const res = await fetch("/words.txt");
      const text = await res.text();

      const wordSet = new Set(
        text
          .split("\n")
          .map(w => w.trim().toLowerCase())
          .filter(w => w.length >= 4 && w.length <= 9)
      );

      setWords(wordSet);

      const { data: profiles } = await supabase
        .from("active_profiles")
        .select("email, full_name");

      if (profiles) {
        setPlayers(profiles);
      }

      if (profiles?.length) {
        const { data: game } = await supabase
          .from("wordplay_game")
          .select("current_player_email")
          .eq("id", 1)
          .single();

        if (!game?.current_player_email) {
          const firstPlayer = profiles[0].email;

          await supabase
            .from("wordplay_game")
            .update({ current_player_email: firstPlayer })
            .eq("id", 1);

          setCurrentPlayer(firstPlayer);
        } else {
          setCurrentPlayer(game.current_player_email);
        }
      }

      // ✅ Load shared game state
      const { data: game } = await supabase
        .from("wordplay_game")
        .select("*")
        .single();

      if (game) {
        setCurrentWord(game.current_word);
        setPlayedWords(game.played_words ?? []);
        setCurrentPlayer(game.current_player_email);

        return;
      }

      // ✅ Fallback seed only if DB empty
      const resCommon = await fetch("/common-words.txt");
      const textCommon = await resCommon.text();

      const commonWords = textCommon
        .split("\n")
        .map(w => w.trim().toLowerCase());

      const randomWord =
        commonWords[Math.floor(Math.random() * commonWords.length)];

      setCurrentWord(randomWord);
      setPlayedWords([randomWord]);
    };

    loadWords();
  }, []);

  const isOneEditAway = (a: string, b: string) => {
    a = a.trim().toLowerCase();
    b = b.trim().toLowerCase();

    if (a === b) return false;

    const lenDiff = Math.abs(a.length - b.length);
    if (lenDiff > 1) return false;

    let edits = 0;
    let i = 0;
    let j = 0;

    while (i < a.length && j < b.length) {
      if (a[i] !== b[j]) {
        edits++;
        if (edits > 1) return false;

        if (a.length > b.length) i++;
        else if (b.length > a.length) j++;
        else {
          i++;
          j++;
        }
      } else {
        i++;
        j++;
      }
    }

    if (i < a.length || j < b.length) edits++;
    return edits === 1;
  };

  const submitMove = async () => {
    if (!currentWord || !nextWord || !words) return;

    const cleanWord = nextWord.trim().toLowerCase();

    if (playedWords.includes(cleanWord)) {
      alert("Word already used");
      return;
    }

    if (!isOneEditAway(currentWord, cleanWord)) {
      alert("Must be one edit away");
      return;
    }

    if (!words.has(cleanWord)) {
      alert("Not a valid dictionary word");
      return;
    }

    const currentIndex = players.findIndex(p => p.email === currentPlayer);
    const nextIndex = (currentIndex + 1) % players.length;
    const nextPlayer = players[nextIndex]?.email;

    await supabase
      .from("wordplay_game")
      .update({
        current_word: cleanWord,
        played_words: [...playedWords, cleanWord],
        current_player_email: nextPlayer,
        updated_at: new Date().toISOString()
      })
      .eq("id", 1);

    // ✅ Reload canonical state
    const { data: game } = await supabase
      .from("wordplay_game")
      .select("*")
      .single();

    if (game) {
      setCurrentWord(game.current_word);
      setPlayedWords(game.played_words ?? []);
      setCurrentPlayer(game.current_player_email);
    }

    setNextWord("");
  };

  return (
    <AuthGuard>
      <div className="space-y-4">

        <div>
          Dictionary loaded: {words ? "YES" : "NO"}
        </div>

        <div className="text-xl font-semibold">
          Current Word: {currentWord ?? "..."}
        </div>
        {currentPlayer && (
          <div className="text-sm font-semibold bg-black text-white px-3 py-2 rounded-xl inline-block">
            {players.find(p => p.email === currentPlayer)?.full_name.split(" ")[0]}'s Turn
          </div>
        )}
        <div>
          <strong>Players:</strong>

          <div className="flex flex-wrap gap-3">
            {players.map(p => (
              <div
                key={p.email}
                className={`flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-sm ring-1 transition ${
                  currentPlayer === p.email
                    ? "ring-2 ring-black scale-105"
                    : "ring-gray-200"
                }`}
              >
                <div
                  style={{
                    height: 36,
                    width: 36,
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "#111",
                  }}
                >
                  <img
                    src={getAvatarUrl(p.full_name)}
                    alt={p.full_name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>

                <div className="text-sm">
                  {getFirstName(p.full_name)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <input
          value={nextWord}
          onChange={e => setNextWord(e.target.value)}
          placeholder="Type a word"
          className="border rounded-lg px-3 py-2 text-sm"
        />

        <button onClick={submitMove} className="pill pill-active">
          Submit Move
        </button>

        <div>
          Valid move:{" "}
          {currentWord && nextWord ? (
            playedWords.includes(nextWord.trim().toLowerCase()) ? (
              "ALREADY USED"
            ) : isOneEditAway(currentWord, nextWord) ? (
              words?.has(nextWord.trim().toLowerCase()) ? (
                "VALID"
              ) : (
                "NOT A WORD"
              )
            ) : (
              "INVALID EDIT"
            )
          ) : (
            "-"
          )}
        </div>

        <div className="pt-4">
          <strong>Played Words:</strong>
          <div className="text-sm">
            {playedWords.map(word => (
              <div key={word}>{word}</div>
            ))}
          </div>
        </div>

      </div>
    </AuthGuard>
  );
}
