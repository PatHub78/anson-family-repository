"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import AuthGuard from "../components/AuthGuard";
import { createClient } from "@supabase/supabase-js";
import { Permanent_Marker } from "next/font/google";

const marker = Permanent_Marker({ weight: "400", subsets: ["latin"] });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PAGE_SIZE = 20;

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

function decorationFor(id: number) {
  const variants = ["none", "tape", "pin", "both"] as const;
  return variants[id % variants.length];
}

function formatMonth(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

// Tape colors for variety
const tapeColors = [
  "rgba(255,235,150,0.85)",
  "rgba(200,230,255,0.85)",
  "rgba(255,200,200,0.85)",
  "rgba(200,255,210,0.85)",
];
function tapeColorFor(id: number) {
  return tapeColors[id % tapeColors.length];
}

// Pin colors
const pinColors = ["#e11d48", "#2563eb", "#16a34a", "#f59e0b", "#8b5cf6"];
function pinColorFor(id: number) {
  return pinColors[id % pinColors.length];
}

/* ── Lazy Image ─────────────────────────────────────────────── */
function LazyImage({
  src,
  alt,
  className,
  style,
  onClick,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && ref.current) {
          ref.current.src = src;
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [src]);

  return (
    <img
      ref={ref}
      alt={alt}
      data-src={src}
      className={className}
      style={{
        ...style,
        opacity: loaded ? 1 : 0,
        transition: "opacity 0.4s ease",
      }}
      onLoad={() => setLoaded(true)}
      onClick={onClick}
    />
  );
}

/* ── Lightbox ───────────────────────────────────────────────── */
function Lightbox({
  moment,
  onClose,
}: {
  moment: Moment;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative bg-white p-4 pb-16 max-w-2xl w-full"
        style={{
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          transform: `rotate(${rotationFor(moment.id)}deg)`,
          animation: "popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Push pin */}
        <div
          className="absolute -top-4 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full shadow-lg flex items-center justify-center"
          style={{
            background: pinColorFor(moment.id),
            boxShadow: `0 2px 8px rgba(0,0,0,0.4), inset 0 -2px 4px rgba(0,0,0,0.2)`,
          }}
        >
          <div className="w-2 h-2 rounded-full bg-white/40" />
        </div>

        <img
          src={moment.image_url}
          alt={moment.caption}
          className="w-full object-cover"
          style={{ maxHeight: "60vh" }}
        />

        <div
          className={`${marker.className} mt-4 text-lg text-center w-full`}
          style={{ color: colorFor(moment.id) }}
        >
          {moment.caption}
        </div>

        {moment.author && (
          <div className="text-xs text-gray-400 text-center mt-1">
            — {moment.author} &middot;{" "}
            {new Date(moment.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        )}

        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-gray-400 hover:text-black text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <style>{`
        @keyframes popIn {
          from { transform: scale(0.85) rotate(${rotationFor(moment.id)}deg); opacity: 0; }
          to   { transform: scale(1)    rotate(${rotationFor(moment.id)}deg); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ── Polaroid Card ──────────────────────────────────────────── */
function PolaroidCard({
  moment,
  index,
  onClick,
}: {
  moment: Moment;
  index: number;
  onClick: () => void;
}) {
  const decor = decorationFor(moment.id);
  const rotation = rotationFor(moment.id);

  return (
    <div
      className="relative bg-white cursor-pointer group"
      style={{
        padding: "10px",
        paddingBottom: "52px",
        transform: `rotate(${rotation}deg)`,
        boxShadow:
          "0 2px 4px rgba(0,0,0,0.08), 0 8px 20px rgba(0,0,0,0.14), 0 20px 40px rgba(0,0,0,0.08)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        animation: `dropIn 0.4s ease both`,
        animationDelay: `${(index % PAGE_SIZE) * 40}ms`,
        willChange: "transform",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = `rotate(${rotation}deg) translateY(-8px) scale(1.03)`;
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0 4px 8px rgba(0,0,0,0.1), 0 16px 40px rgba(0,0,0,0.2), 0 32px 64px rgba(0,0,0,0.12)";
        (e.currentTarget as HTMLDivElement).style.zIndex = "10";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = `rotate(${rotation}deg)`;
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0 2px 4px rgba(0,0,0,0.08), 0 8px 20px rgba(0,0,0,0.14), 0 20px 40px rgba(0,0,0,0.08)";
        (e.currentTarget as HTMLDivElement).style.zIndex = "auto";
      }}
      onClick={onClick}
    >
      {/* Tape */}
      {(decor === "tape" || decor === "both") && (
        <div
          className="absolute -top-3 left-6 w-12 h-5"
          style={{
            background: tapeColorFor(moment.id),
            transform: "rotate(-5deg)",
            borderRadius: "1px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        />
      )}

      {/* Push pin */}
      {(decor === "pin" || decor === "both") && (
        <div
          className="absolute -top-4 right-5 w-6 h-6 rounded-full flex items-center justify-center"
          style={{
            background: pinColorFor(moment.id),
            boxShadow: `0 2px 6px rgba(0,0,0,0.35), inset 0 -1px 3px rgba(0,0,0,0.2)`,
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
        </div>
      )}

      {/* Photo */}
      <LazyImage
        src={moment.image_url}
        alt={moment.caption}
        style={{ width: "224px", height: "224px", objectFit: "cover", display: "block" }}
      />

      {/* Caption */}
      <div
        className={`${marker.className} mt-3 text-sm px-1`}
        style={{
          color: colorFor(moment.id),
          width: "224px",
          whiteSpace: "normal",
          wordBreak: "break-word",
          lineHeight: 1.3,
        }}
      >
        {moment.caption}
      </div>

      {moment.author && (
        <div className="text-[10px] text-gray-400 mt-1 px-1">
          {moment.author}
        </div>
      )}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function AlbumPage() {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [lightboxMoment, setLightboxMoment] = useState<Moment | null>(null);
  const [authors, setAuthors] = useState<string[]>([]);

  // Fetch a page of moments
  const fetchMoments = useCallback(
    async (pageIndex: number, reset = false) => {
      setLoading(true);

      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, count, error } = await supabase
        .from("home_content")
        .select("*", { count: "exact" })
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      const rows = (data || []) as Moment[];

      if (reset) {
        setMoments(rows);
      } else {
        setMoments((prev) => [...prev, ...rows]);
      }

      if (count !== null) {
        setTotalCount(count);
        setHasMore(from + rows.length < count);
      }

      // Build author list from first load
      if (pageIndex === 0) {
        const { data: allAuthors } = await supabase
          .from("home_content")
          .select("author")
          .eq("approved", true);

        const unique = Array.from(
          new Set((allAuthors || []).map((r: any) => r.author).filter(Boolean))
        ) as string[];

        setAuthors(unique);
        setSelectedAuthors(unique);
      }

      setLoading(false);
    },
    []
  );

  useEffect(() => {
    setPage(0);
    fetchMoments(0, true);
  }, [fetchMoments]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchMoments(nextPage);
  };

  const months = useMemo(() => {
    const unique = new Set<string>();
    moments.forEach((m) => unique.add(formatMonth(m.created_at)));
    return Array.from(unique);
  }, [moments]);

  const filteredMoments = useMemo(() => {
    return moments.filter((m) => {
      const matchesAuthor = m.author && selectedAuthors.includes(m.author);
      const matchesMonth =
        selectedMonth === "all" || formatMonth(m.created_at) === selectedMonth;
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
      prev.includes(author) ? prev.filter((a) => a !== author) : [...prev, author]
    );
  };

  return (
    <AuthGuard>
      {/* Lightbox */}
      {lightboxMoment && (
        <Lightbox moment={lightboxMoment} onClose={() => setLightboxMoment(null)} />
      )}

      <div
        className="min-h-screen -mx-6 -my-10 relative"
        style={{ background: "#c8a96e" }}
      >
        {/* Corkboard texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              repeating-linear-gradient(
                0deg,
                transparent,
                transparent 3px,
                rgba(0,0,0,0.03) 3px,
                rgba(0,0,0,0.03) 4px
              ),
              repeating-linear-gradient(
                90deg,
                transparent,
                transparent 3px,
                rgba(0,0,0,0.03) 3px,
                rgba(0,0,0,0.03) 4px
              )
            `,
            backgroundSize: "4px 4px",
          }}
        />

        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.25) 100%)",
          }}
        />

        <div className="relative px-6 py-12 space-y-14">
          {/* Title */}
          <div className="text-center">
            <h1
              className={`${marker.className} text-7xl`}
              style={{
                color: "#1a0a00",
                textShadow: "2px 3px 0px rgba(0,0,0,0.2)",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))",
              }}
            >
              Anson Album
            </h1>
            {totalCount !== null && (
              <p
                className={`${marker.className} text-lg mt-2`}
                style={{ color: "rgba(30,10,0,0.6)" }}
              >
                {totalCount} memories & counting
              </p>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap justify-center items-center gap-4">
            {/* Month filter */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className={`${marker.className} px-5 py-2 rounded-lg shadow-md text-base border-0 cursor-pointer`}
              style={{ background: "rgba(255,255,255,0.92)", color: "#1a0a00" }}
            >
              <option value="all">All Memories</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Author avatars */}
          <div className="flex flex-wrap justify-center gap-8">
            {authors.map((author, i) => {
              const selected = selectedAuthors.includes(author);
              return (
                <div
                  key={author}
                  onClick={() => toggleAuthor(author)}
                  className="cursor-pointer select-none"
                  style={{ transform: `rotate(${rotationFor(i)}deg)` }}
                >
                  <div
                    className="relative bg-white p-2 pb-7 transition-transform"
                    style={{
                      boxShadow: selected
                        ? "0 0 0 3px #1a0a00, 0 6px 16px rgba(0,0,0,0.2)"
                        : "0 4px 6px rgba(0,0,0,0.12), 0 10px 25px rgba(0,0,0,0.1)",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLDivElement).style.transform = "")
                    }
                  >
                    {selected && (
                      <div
                        className="absolute -top-2 -right-2 text-white text-xs px-2 py-0.5 rounded-full shadow font-bold"
                        style={{ background: "#1a0a00" }}
                      >
                        ✓
                      </div>
                    )}
                    <img
                      src={getAvatarUrl(author)}
                      alt={author}
                      className="h-16 w-16 object-cover"
                    />
                    <div
                      className={`${marker.className} text-xs mt-2 text-center`}
                      style={{ color: "#1a0a00" }}
                    >
                      {author.split(" ")[0]}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Monthly sections */}
          {Object.entries(groupedMoments).map(([month, monthMoments]) => (
            <div key={month} className="space-y-8">
              {/* Month heading on a "paper strip" */}
              <div className="flex items-center gap-4">
                <div
                  className={`${marker.className} text-2xl px-6 py-2 rounded-sm shadow-md`}
                  style={{
                    background: "rgba(255,255,255,0.88)",
                    color: "#1a0a00",
                    transform: "rotate(-1deg)",
                    boxShadow: "2px 3px 8px rgba(0,0,0,0.15)",
                  }}
                >
                  {month}
                </div>
                <div
                  style={{
                    flex: 1,
                    height: "2px",
                    background: "rgba(0,0,0,0.1)",
                    borderRadius: "1px",
                  }}
                />
                <span
                  className={`${marker.className} text-sm`}
                  style={{ color: "rgba(30,10,0,0.5)" }}
                >
                  {monthMoments.length} photo{monthMoments.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Polaroid grid */}
              <div
                className="flex flex-wrap justify-center"
                style={{ gap: "48px 40px" }}
              >
                {monthMoments.map((m, index) => (
                  <PolaroidCard
                    key={m.id}
                    moment={m}
                    index={index}
                    onClick={() => setLightboxMoment(m)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-4 pb-8">
              <button
                onClick={loadMore}
                disabled={loading}
                className={`${marker.className} px-10 py-3 rounded-full text-lg shadow-lg transition`}
                style={{
                  background: loading ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.9)",
                  color: "#1a0a00",
                  cursor: loading ? "wait" : "pointer",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                }}
                onMouseEnter={(e) =>
                  !loading &&
                  ((e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.transform = "")
                }
              >
                {loading ? "Loading…" : "Show More Photos"}
              </button>
            </div>
          )}

          {!hasMore && moments.length > 0 && (
            <div
              className={`${marker.className} text-center text-lg pb-8`}
              style={{ color: "rgba(30,10,0,0.5)" }}
            >
              You've seen them all! 📸
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes dropIn {
          from {
            opacity: 0;
            transform: rotate(var(--rot, 2deg)) translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: rotate(var(--rot, 2deg)) translateY(0) scale(1);
          }
        }
      `}</style>
    </AuthGuard>
  );
}
