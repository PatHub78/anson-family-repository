"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGuard from "../components/AuthGuard";
import { createClient } from "@supabase/supabase-js";
import { Permanent_Marker } from "next/font/google";

const marker = Permanent_Marker({ weight: "400", subsets: ["latin"] });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Moment {
  id: number;
  image_url: string;
  caption: string;
  author?: string;
  created_at: string;
}

function getAvatarUrl(author: string) {
  const fileName = author.toLowerCase().replaceAll(" ", "-") + ".jpg";
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`;
}

function rotationFor(id: number) {
  const values = [-4, -2, -1, 1, 2, 4];
  return values[id % values.length];
}

function colorFor(id: number) {
  const colors = ["#e11d48", "#2563eb", "#16a34a"];
  return colors[id % colors.length];
}

/* ✅ RANDOM DECORATION ENGINE */

function decorationFor(id: number) {
  const variants = ["none", "tape", "pin", "both"];
  return variants[id % variants.length];
}

function formatMonth(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default function AlbumPage() {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  useEffect(() => {
    const fetchMoments = async () => {
      const { data } = await supabase
        .from("home_content")
        .select("*")
        .eq("approved", true)
        .order("created_at", { ascending: false });

      const rows = data || [];

      setMoments(rows);

      const authors = Array.from(
        new Set(rows.map((m) => m.author).filter(Boolean))
      ) as string[];

      setSelectedAuthors(authors);
    };

    fetchMoments();
  }, []);

  const authors = useMemo(() => {
    return Array.from(
      new Set(moments.map((m) => m.author).filter(Boolean))
    ) as string[];
  }, [moments]);

  const months = useMemo(() => {
    const unique = new Set<string>();
    moments.forEach((m) => unique.add(formatMonth(m.created_at)));
    return Array.from(unique);
  }, [moments]);

  const filteredMoments = useMemo(() => {
    return moments.filter((m) => {
      const matchesAuthor =
        m.author && selectedAuthors.includes(m.author);

      const matchesMonth =
        selectedMonth === "all" ||
        formatMonth(m.created_at) === selectedMonth;

      return matchesAuthor && matchesMonth;
    });
  }, [moments, selectedAuthors, selectedMonth]);

  const groupedMoments = useMemo(() => {
    const groups: Record<string, Moment[]> = {};

    filteredMoments.forEach((m) => {
      const month = formatMonth(m.created_at);
      if (!groups[month]) groups[month] = [];
      groups[month].push(m);
    });

    return groups;
  }, [filteredMoments]);

  const toggleAuthor = (author: string) => {
    setSelectedAuthors((prev) =>
      prev.includes(author)
        ? prev.filter((a) => a !== author)
        : [...prev, author]
    );
  };

  return (
    <AuthGuard>
      <div className="min-h-screen -mx-6 -my-10 relative">

        {/* ✅ PAPER TEXTURE NOISE */}
        <div className="absolute inset-0 opacity-[0.035] pointer-events-none">
          <div className="w-full h-full bg-[radial-gradient(circle,black_1px,transparent_1px)] bg-[size:12px_12px]" />
        </div>

        <div className="relative px-6 py-10 space-y-16">

          <h1 className={`${marker.className} text-6xl text-center`}>
            Anson Album
          </h1>

          {/* ✅ MONTH FILTER */}
          <div className="flex justify-center">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white px-4 py-2 rounded-lg shadow"
            >
              <option value="all">All Moments</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* ✅ AVATARS */}
          <div className="flex flex-wrap justify-center gap-10">
            {authors.map((author, i) => {
              const selected = selectedAuthors.includes(author);

              return (
                <div
                  key={author}
                  onClick={() => toggleAuthor(author)}
                  className="cursor-pointer select-none"
                  style={{
                    transform: `rotate(${rotationFor(i)}deg)`,
                  }}
                >
                  <div
                    className={`relative bg-white p-2 pb-6 transition hover:-translate-y-1 ${
                      selected ? "ring-2 ring-black" : ""
                    }`}
                    style={{
                      boxShadow:
                        "0 4px 6px rgba(0,0,0,0.1), 0 10px 25px rgba(0,0,0,0.12)",
                    }}
                  >
                    {/* ✅ SELECTION TICK */}
                    {selected && (
                      <div className="absolute -top-2 -right-2 bg-black text-white text-xs px-2 py-0.5 rounded-full shadow">
                        ✓
                      </div>
                    )}

                    <img
                      src={getAvatarUrl(author)}
                      alt={author}
                      className="h-16 w-16 object-cover"
                    />

                    <div className={`${marker.className} text-xs mt-2`}>
                      {author.split(" ")[0]}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ✅ MONTHLY SECTIONS */}
          {Object.entries(groupedMoments).map(([month, monthMoments]) => (
            <div key={month} className="space-y-6">

              <h2 className={`${marker.className} text-3xl`}>
                {month}
              </h2>

              <div className="flex flex-wrap justify-center gap-16">


                {monthMoments.map((m, index) => {
                  const decor = decorationFor(m.id);

                  return (
                    <div
                      key={m.id}
                      className="relative bg-white p-3 pb-14 transition hover:-translate-y-2"
                      style={{
                        transform: `rotate(${rotationFor(m.id)}deg)`,
                        marginLeft: "-20px",
                        boxShadow:
                          "0 6px 10px rgba(0,0,0,0.12), 0 18px 35px rgba(0,0,0,0.18)",
                      }}
                    >
                      {/* ✅ TAPE */}
                      {(decor === "tape" || decor === "both") && (
                        <div className="absolute -top-2 left-8 w-10 h-4 bg-yellow-200 rotate-[-6deg] opacity-80" />
                      )}

                      {/* ✅ PUSH PIN */}
                      {(decor === "pin" || decor === "both") && (
                        <div className="absolute -top-3 right-6 w-4 h-4 rounded-full bg-red-500 shadow-md" />
                      )}

                      <img
                        src={m.image_url}
                        alt={m.caption}
                        className="w-72 h-72 object-cover"
                      />

                      <div
                        className={`${marker.className} mt-4 text-sm w-72 whitespace-normal break-words`}
                        style={{ color: colorFor(m.id) }}
                      >
                        {m.caption}
                      </div>

                      {m.author && (
                        <div className="text-xs text-gray-400 mt-1">
                          {m.author}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AuthGuard>
  );
}
