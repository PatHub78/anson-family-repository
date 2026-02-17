"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/app/components/AuthGuard";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function WordPlayPage() {
  const [words, setWords] = useState<Set<string> | null>(null);
  const [nextWord, setNextWord] = useState("");
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const [playedWords, setPlayedWords] = useState<string[]>([]);

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

      // ✅ Load shared game state
      const { data: game } = await supabase
        .from("wordplay_game")
        .select("*")
        .single();

      if (game) {
        setCurrentWord(game.current_word);
        setPlayedWords(game.played_words ?? []);
        return; // IMPORTANT → do not generate random word
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

    return true;
  };

  const submitMove = async () => {
    if (!currentWord || !nextWord || !words) return;

    const cleanWord = nextWord.trim().toLowerCase();

    if (playedWords.includes(cleanWord)) return;
    if (!isOneEditAway(currentWord, cleanWord)) return;
    if (!words.has(cleanWord)) return;

    // ✅ Update database
    await supabase
      .from("wordplay_game")
      .update({
        current_word: cleanWord,
        played_words: [...playedWords, cleanWord],
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

      </div>
    </AuthGuard>
  );
}
