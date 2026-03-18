"use client";

import { useEffect, useState, useMemo } from "react";
import AuthGuard from "@/app/components/AuthGuard";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Types ───────────────────────────────────────────────────────────────────

interface Profile {
  email: string;
  full_name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  birthday: string | null;
  description: string | null;
}

interface Submission {
  id: number;
  full_name: string;
  event_of_the_day: string | null;
  submission_date: string;
}

interface HomeContent {
  id: number;
  author: string;
  image_url: string;
  caption: string | null;
  created_at: string;
}

interface PersonCard {
  profile: Profile;
  submissions: Submission[];
  photos: HomeContent[];
}

// ─── Time filter options ──────────────────────────────────────────────────────

const TIME_OPTIONS = [
  { label: "January", value: "2026-01" },
  { label: "February", value: "2026-02" },
  { label: "March", value: "2026-03" },
  { label: "April", value: "2026-04" },
  { label: "May", value: "2026-05" },
  { label: "June", value: "2026-06" },
  { label: "July", value: "2026-07" },
  { label: "August", value: "2026-08" },
  { label: "September", value: "2026-09" },
  { label: "October", value: "2026-10" },
  { label: "November", value: "2026-11" },
  { label: "December", value: "2026-12" },
  { label: "All of 2026", value: "all" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatBirthdate(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function formatLocation(profile: Profile) {
  const parts = [profile.city, profile.state, profile.country].filter(Boolean);
  return parts.join(", ") || "Location unknown";
}

function getAvatarUrl(name: string) {
  const fileName = name.toLowerCase().replaceAll(" ", "-") + ".jpg";
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`;
}

function firstName(name: string) {
  return name.split(" ")[0];
}

function getLocationPin(profile: Profile): { x: number; y: number } | null {
  const country = profile.country?.toLowerCase() ?? "";
  const city = profile.city?.toLowerCase() ?? "";
  const state = profile.state?.toLowerCase() ?? "";

  if (country.includes("united states") || country.includes("usa") || country === "us") {
    if (city.includes("new york")) return { x: 232, y: 142 };
    if (city.includes("los angeles")) return { x: 108, y: 158 };
    if (city.includes("chicago")) return { x: 198, y: 130 };
    if (city.includes("houston")) return { x: 172, y: 185 };
    if (city.includes("phoenix")) return { x: 120, y: 163 };
    if (city.includes("philadelphia")) return { x: 228, y: 144 };
    if (city.includes("san antonio")) return { x: 166, y: 188 };
    if (city.includes("san diego")) return { x: 107, y: 162 };
    if (city.includes("dallas")) return { x: 173, y: 178 };
    if (city.includes("seattle")) return { x: 106, y: 117 };
    if (city.includes("denver")) return { x: 148, y: 148 };
    if (city.includes("boston")) return { x: 238, y: 133 };
    if (city.includes("miami")) return { x: 218, y: 198 };
    if (city.includes("atlanta")) return { x: 210, y: 172 };
    if (city.includes("minneapolis")) return { x: 182, y: 120 };
    if (city.includes("portland")) return { x: 106, y: 117 };
    if (city.includes("las vegas")) return { x: 113, y: 155 };
    if (city.includes("nashville")) return { x: 207, y: 162 };
    if (city.includes("austin")) return { x: 168, y: 186 };
    if (state.includes("california")) return { x: 108, y: 155 };
    if (state.includes("texas")) return { x: 170, y: 182 };
    if (state.includes("florida")) return { x: 216, y: 195 };
    if (state.includes("new york")) return { x: 232, y: 138 };
    return { x: 175, y: 155 };
  }
  if (city.includes("london")) return { x: 455, y: 118 };
  if (city.includes("paris")) return { x: 462, y: 128 };
  if (city.includes("berlin")) return { x: 474, y: 112 };
  if (city.includes("madrid")) return { x: 452, y: 142 };
  if (city.includes("rome")) return { x: 472, y: 142 };
  if (city.includes("amsterdam")) return { x: 463, y: 112 };
  if (city.includes("warsaw") || city.includes("warszawa")) return { x: 484, y: 113 };
  if (city.includes("krakow") || city.includes("krak\u00f3w")) return { x: 482, y: 118 };
  if (city.includes("prague")) return { x: 474, y: 116 };
  if (city.includes("vienna")) return { x: 476, y: 122 };
  if (city.includes("budapest")) return { x: 479, y: 125 };
  if (city.includes("barcelona")) return { x: 456, y: 138 };
  if (city.includes("lisbon")) return { x: 444, y: 142 };
  if (city.includes("dublin")) return { x: 447, y: 113 };
  if (city.includes("stockholm")) return { x: 474, y: 100 };
  if (city.includes("oslo")) return { x: 464, y: 97 };
  if (city.includes("copenhagen")) return { x: 468, y: 105 };
  if (country.includes("poland")) return { x: 483, y: 115 };
  if (country.includes("france")) return { x: 460, y: 130 };
  if (country.includes("germany")) return { x: 470, y: 116 };
  if (country.includes("uk") || country.includes("united kingdom")) return { x: 453, y: 116 };
  if (country.includes("italy")) return { x: 471, y: 138 };
  if (country.includes("spain")) return { x: 453, y: 140 };
  return null;
}

const ITEMS_PER_PAGE = 3;

// ─── World Map ────────────────────────────────────────────────────────────────

function WorldMap({ pins }: {
  pins: Array<{ x: number; y: number; name: string; active: boolean; avatarUrl: string }>
}) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl"
      style={{ background: "#0d1b2a", border: "1px solid #1e3a5f" }}>
      <svg
        viewBox="0 0 700 380"
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        className="w-full"
        style={{ display: "block" }}
      >
        <defs>
          <radialGradient id="oceanGrad" cx="40%" cy="55%" r="65%">
            <stop offset="0%" stopColor="#0d2d4a" />
            <stop offset="100%" stopColor="#060e1a" />
          </radialGradient>
          <filter id="landShadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.4" />
          </filter>
          <filter id="pinGlow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {pins.map((pin, i) => (
            <clipPath key={`clip-${i}`} id={`avatarClip-${i}`}>
              <circle cx={pin.x} cy={pin.y} r={pin.active ? "26" : "14"} />
            </clipPath>
          ))}
        </defs>

        <rect width="700" height="380" fill="url(#oceanGrad)" />

        {/* Grid lines */}
        {[80, 120, 160, 200, 240, 280, 320].map(y => (
          <line key={y} x1="0" y1={y} x2="700" y2={y}
            stroke="#1a3a5a" strokeWidth="0.4" strokeDasharray="3,6" opacity="0.5" />
        ))}
        {[100, 200, 300, 400, 500, 600].map(x => (
          <line key={x} x1={x} y1="0" x2={x} y2="380"
            stroke="#1a3a5a" strokeWidth="0.3" strokeDasharray="2,8" opacity="0.3" />
        ))}
        <line x1="0" y1="210" x2="700" y2="210" stroke="#1e4a6a" strokeWidth="0.8" opacity="0.6" />
        <text x="8" y="208" fontSize="6" fill="#1e4a6a" opacity="0.7" fontFamily="Georgia, serif">equator</text>

        {/* North America */}
        <path d="M 72 55 L 88 48 L 108 44 L 128 46 L 148 50 L 165 58 L 178 68 L 188 80 L 195 95 L 200 112 L 202 130 L 200 148 L 195 162 L 188 174 L 178 183 L 168 190 L 155 195 L 142 197 L 128 195 L 115 190 L 104 182 L 96 172 L 90 160 L 86 148 L 84 135 L 83 120 L 82 105 L 80 90 L 76 75 Z"
          fill="#1a4028" stroke="#2a6040" strokeWidth="0.8" filter="url(#landShadow)" />
        <path d="M 60 58 L 72 52 L 80 58 L 76 68 L 66 70 L 58 66 Z" fill="#1a4028" stroke="#2a6040" strokeWidth="0.6" />
        <path d="M 212 188 L 218 198 L 215 208 L 208 202 L 206 192 Z" fill="#1a4028" stroke="#2a6040" strokeWidth="0.5" />
        <path d="M 104 178 L 100 192 L 97 205 L 100 210 L 104 198 L 106 185 Z" fill="#1a4028" stroke="#2a6040" strokeWidth="0.4" />
        <path d="M 210 208 L 225 206 L 228 210 L 218 213 Z" fill="#1a4028" stroke="#2a6040" strokeWidth="0.4" />
        <path d="M 320 28 L 345 22 L 362 30 L 358 50 L 345 58 L 326 52 L 315 40 Z" fill="#163020" stroke="#2a5030" strokeWidth="0.6" opacity="0.85" />

        {/* South America */}
        <path d="M 168 215 L 188 210 L 205 215 L 215 228 L 218 245 L 215 262 L 208 278 L 198 292 L 184 305 L 170 310 L 157 305 L 148 292 L 142 278 L 140 262 L 142 245 L 148 230 Z"
          fill="#1a4028" stroke="#2a6040" strokeWidth="0.8" filter="url(#landShadow)" />

        {/* Europe */}
        <path d="M 432 92 L 448 86 L 468 84 L 485 88 L 498 96 L 504 108 L 500 120 L 492 130 L 478 136 L 462 138 L 448 134 L 438 126 L 432 116 L 430 104 Z"
          fill="#1a4028" stroke="#2a6040" strokeWidth="0.8" filter="url(#landShadow)" />
        <path d="M 432 128 L 448 125 L 452 140 L 444 148 L 434 143 L 430 133 Z" fill="#1a4028" stroke="#2a6040" strokeWidth="0.5" />
        <path d="M 466 132 L 474 130 L 478 145 L 473 155 L 467 148 L 464 138 Z" fill="#1a4028" stroke="#2a6040" strokeWidth="0.5" />
        <path d="M 456 84 L 474 76 L 488 82 L 486 94 L 474 98 L 460 94 Z" fill="#1a4028" stroke="#2a6040" strokeWidth="0.5" />
        <path d="M 440 96 L 450 90 L 456 98 L 452 108 L 443 110 L 437 103 Z" fill="#1a4028" stroke="#2a6040" strokeWidth="0.5" />
        <path d="M 432 98 L 438 94 L 440 102 L 435 106 Z" fill="#1a4028" stroke="#2a6040" strokeWidth="0.4" />

        {/* Africa */}
        <path d="M 446 152 L 468 148 L 488 152 L 502 165 L 508 182 L 506 200 L 498 218 L 486 232 L 470 242 L 454 244 L 440 238 L 430 224 L 426 208 L 426 190 L 430 174 L 437 162 Z"
          fill="#1a4028" stroke="#2a6040" strokeWidth="0.8" filter="url(#landShadow)" />
        <path d="M 510 228 L 516 222 L 520 232 L 517 244 L 511 242 Z" fill="#1a4028" stroke="#2a6040" strokeWidth="0.4" />

        {/* Asia */}
        <path d="M 500 76 L 540 68 L 580 65 L 615 70 L 640 80 L 655 95 L 658 112 L 650 128 L 635 140 L 615 148 L 592 152 L 568 150 L 545 144 L 524 135 L 508 122 L 500 108 L 498 92 Z"
          fill="#1a4028" stroke="#2a6040" strokeWidth="0.8" filter="url(#landShadow)" />
        <path d="M 572 148 L 584 148 L 590 168 L 580 178 L 570 168 L 566 155 Z" fill="#1a4028" stroke="#2a6040" strokeWidth="0.5" />
        <path d="M 615 148 L 635 145 L 645 158 L 638 168 L 624 165 L 612 158 Z" fill="#1a4028" stroke="#2a6040" strokeWidth="0.5" />
        <path d="M 648 108 L 656 102 L 662 110 L 658 120 L 650 118 Z" fill="#1a4028" stroke="#2a6040" strokeWidth="0.4" />

        {/* Australia */}
        <path d="M 585 270 L 615 262 L 640 265 L 655 278 L 658 295 L 648 310 L 628 318 L 608 315 L 592 304 L 583 288 Z"
          fill="#1a4028" stroke="#2a6040" strokeWidth="0.7" filter="url(#landShadow)" />
        <path d="M 665 308 L 670 300 L 675 310 L 671 318 Z" fill="#1a4028" stroke="#2a6040" strokeWidth="0.4" />

        {/* Arc lines between pins */}
        {pins.length > 1 && pins.map((pin, i) => {
          if (i === 0) return null;
          const prev = pins[i - 1];
          const mx = (pin.x + prev.x) / 2;
          const my = Math.min(pin.y, prev.y) - 25;
          return (
            <path key={`arc-${i}`}
              d={`M ${prev.x} ${prev.y} Q ${mx} ${my} ${pin.x} ${pin.y}`}
              fill="none" stroke="#f59e0b" strokeWidth="0.8" strokeDasharray="3,5" opacity="0.35" />
          );
        })}

        {/* Avatar pins — inactive ones first, active last so it renders on top */}
        {[...pins.filter(p => !p.active), ...pins.filter(p => p.active)].map((pin, i) => {
          const originalIndex = pins.indexOf(pin);
          const r = pin.active ? 27 : 15;
          return (
            <g key={`pin-${originalIndex}`} filter="url(#pinGlow)">
              {/* Pulse ring — only for active */}
              {pin.active && (
                <circle cx={pin.x} cy={pin.y} r={r + 6} fill="none"
                  stroke="#f59e0b" strokeWidth="1.5" opacity="0">
                  <animate attributeName="r" from={r} to={r + 14} dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Border ring */}
              <circle cx={pin.x} cy={pin.y} r={r + 1.5}
                fill={pin.active ? "#f59e0b" : "#334155"}
                stroke={pin.active ? "#fef3c7" : "#475569"}
                strokeWidth={pin.active ? 2.5 : 1.5} />
              {/* Avatar image */}
              <image
                href={pin.avatarUrl}
                x={pin.x - r} y={pin.y - r}
                width={r * 2} height={r * 2}
                clipPath={`url(#avatarClip-${originalIndex})`}
                preserveAspectRatio="xMidYMid slice"
              />
              {/* Name label — only shown for selected person */}
              {pin.active && (
                <>
                  <rect
                    x={pin.x - 28} y={pin.y + r + 4}
                    width="56" height="14"
                    rx="7" fill="rgba(0,0,0,0.55)" />
                  <text x={pin.x} y={pin.y + r + 14} textAnchor="middle" fontSize="8.5"
                    fill="#fef3c7" fontFamily="Georgia, serif" fontStyle="italic">
                    {firstName(pin.name)}
                  </text>
                </>
              )}
            </g>
          );
        })}

        <text x="12" y="372" fontSize="7" fill="#1e3a5a" fontFamily="Georgia, serif" opacity="0.5">
          Anson Family &middot; Worldwide
        </text>
      </svg>
    </div>
  );
}

// ─── Journal Entry ────────────────────────────────────────────────────────────

function JournalEntry({ submission, index }: { submission: Submission; index: number }) {
  return (
    <div className="relative pl-8" style={{ borderLeft: "2px solid #e5e7eb", marginLeft: "12px", paddingBottom: "20px" }}>
      <div className="absolute left-0 top-1 w-5 h-5 rounded-full flex items-center justify-center"
        style={{ background: "#111", transform: "translateX(-50%)", fontSize: "9px", color: "white", fontWeight: 700, border: "2px solid white", boxShadow: "0 0 0 2px #111" }}>
        {index + 1}
      </div>
      <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1 font-medium">
        {formatDate(submission.submission_date)}
      </div>
      <div className="text-sm text-gray-800 leading-relaxed"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", background: "#fafaf9", borderRadius: "12px", padding: "12px 16px", border: "1px solid #f0ede8" }}>
        &ldquo;{submission.event_of_the_day}&rdquo;
      </div>
    </div>
  );
}

// ─── Photo Carousel ───────────────────────────────────────────────────────────

function PhotoCarousel({ photos }: { photos: HomeContent[] }) {
  const [index, setIndex] = useState(0);
  if (photos.length === 0) return null;
  const photo = photos[index];

  return (
    <div className="flex flex-col" style={{ background: "#111" }}>
      {/* Image area — object-contain so nothing is cut off */}
      <div className="relative flex items-center justify-center"
        style={{ minHeight: "260px", maxHeight: "360px", background: "#0a0a0a" }}>
        <img
          src={photo.image_url}
          alt={photo.caption ?? "photo"}
          style={{ maxHeight: "360px", width: "100%", objectFit: "contain", display: "block" }}
        />
        {/* Prev arrow */}
        {photos.length > 1 && (
          <button
            onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110"
            style={{ background: "rgba(0,0,0,0.6)", color: "white", fontSize: "22px", lineHeight: 1 }}
            aria-label="Previous photo"
          >
            &#8249;
          </button>
        )}
        {/* Next arrow */}
        {photos.length > 1 && (
          <button
            onClick={() => setIndex((i) => (i + 1) % photos.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110"
            style={{ background: "rgba(0,0,0,0.6)", color: "white", fontSize: "22px", lineHeight: 1 }}
            aria-label="Next photo"
          >
            &#8250;
          </button>
        )}
        {/* Counter */}
        {photos.length > 1 && (
          <div className="absolute top-3 right-3 text-xs px-2 py-1 rounded-full font-semibold"
            style={{ background: "rgba(0,0,0,0.65)", color: "white" }}>
            {index + 1} / {photos.length}
          </div>
        )}
      </div>

      {/* Caption — always below image, easy to read */}
      {photo.caption && (
        <div className="px-4 py-3 text-sm text-center"
          style={{ background: "#1a1a1a", color: "#d1d5db", fontFamily: "Georgia, serif", fontStyle: "italic", lineHeight: 1.6, minHeight: "44px" }}>
          {photo.caption}
        </div>
      )}

      {/* Dot nav */}
      {photos.length > 1 && (
        <div className="flex justify-center gap-1.5 py-2.5" style={{ background: "#111" }}>
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className="rounded-full transition-all"
              style={{ width: i === index ? 18 : 7, height: 7, background: i === index ? "#f59e0b" : "rgba(255,255,255,0.25)" }}
              aria-label={`Go to photo ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Person Card ──────────────────────────────────────────────────────────────

function PersonKetchupCard({ card }: { card: PersonCard }) {
  const { profile, submissions, photos } = card;
  const eventsWithText = submissions.filter((s) => s.event_of_the_day?.trim());
  const birthday = formatBirthdate(profile.birthday);
  const location = formatLocation(profile);
  const avatarUrl = getAvatarUrl(profile.full_name);

  return (
    <div className="rounded-3xl overflow-hidden shadow-md" style={{ border: "1px solid #e5e7eb", background: "white" }}>

      {/* Header */}
      <div className="px-6 py-5" style={{ background: "#111", color: "white" }}>
        <div className="flex items-start gap-4">
          <img src={avatarUrl} alt={profile.full_name}
            className="w-14 h-14 rounded-full object-cover shrink-0"
            style={{ border: "2px solid #f59e0b" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/default-avatar.jpg"; }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
                {profile.full_name}
              </h2>
              <div className="text-xs px-3 py-1.5 rounded-full font-semibold shrink-0"
                style={{ background: "#1e3a5f", color: "#93c5fd" }}>
                {eventsWithText.length} update{eventsWithText.length !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm" style={{ color: "#94a3b8" }}>
              <span>&#128205;</span><span>{location}</span>
            </div>
            {birthday && (
              <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: "#64748b" }}>
                <span>&#127874;</span><span>{birthday}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Description — its own section, light background, large readable text ── */}
      {profile.description && (
        <div className="px-8 py-6" style={{ background: "#fffdf7", borderBottom: "1px solid #f0ede8", borderTop: "1px solid #f0ede8" }}>
          <div className="flex gap-4 items-start">
            <span style={{ fontSize: "56px", lineHeight: 1, color: "#f59e0b", opacity: 0.5, fontFamily: "Georgia, serif", flexShrink: 0, marginTop: "-8px" }}>
              &ldquo;
            </span>
            <p style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontSize: "16px", color: "#374151", lineHeight: 1.8, margin: 0, flex: 1 }}>
              {profile.description}
            </p>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="grid md:grid-cols-2">
        {photos.length > 0 && <PhotoCarousel photos={photos} />}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: "420px", background: "#fefefe" }}>
          {eventsWithText.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8 text-gray-400">
              <div style={{ fontSize: 36 }}>&#129335;</div>
              <div className="text-sm mt-2">No updates this period</div>
            </div>
          ) : (
            <>
              <div className="text-xs uppercase tracking-widest font-bold mb-4" style={{ color: "#9ca3af" }}>
                What&rsquo;s been happening
              </div>
              {eventsWithText.map((s, i) => (
                <JournalEntry key={s.id} submission={s} index={i} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KetchupPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [photos, setPhotos] = useState<HomeContent[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("email, full_name, city, state, country, birthday, description")
      .order("full_name")
      .then(({ data }) => { if (data) setProfiles(data); });
  }, []);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const availableMonths = TIME_OPTIONS.filter((t) => t.value === "all" || t.value <= currentMonth);

  useEffect(() => {
    if (selectedUser === "all" && !hasLoaded) return;

    const load = async () => {
      setLoading(true);
      setPage(1);

      const monthStart = selectedMonth !== "all" ? `${selectedMonth}-01` : "2026-01-01";
      const monthEnd = selectedMonth !== "all" ? `${selectedMonth}-31` : "2026-12-31";

      let subQuery = supabase
        .from("submissions")
        .select("id, full_name, event_of_the_day, submission_date")
        .gte("submission_date", monthStart)
        .lte("submission_date", monthEnd)
        .order("submission_date", { ascending: false });

      if (selectedUser !== "all") {
        const profile = profiles.find((p) => p.email === selectedUser);
        if (profile) subQuery = subQuery.eq("full_name", profile.full_name);
      }

      let photoQuery = supabase
        .from("home_content")
        .select("id, author, image_url, caption, created_at")
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd + "T23:59:59")
        .order("created_at", { ascending: false });

      if (selectedUser !== "all") {
        const profile = profiles.find((p) => p.email === selectedUser);
        if (profile) photoQuery = photoQuery.eq("author", profile.full_name);
      }

      const [{ data: subData }, { data: photoData }] = await Promise.all([subQuery, photoQuery]);

      setSubmissions(subData ?? []);
      setPhotos(photoData ?? []);
      setHasLoaded(true);
      setLoading(false);
    };

    load();
  }, [selectedUser, selectedMonth, profiles]);

  const personCards = useMemo((): PersonCard[] => {
    if (!hasLoaded) return [];
    const profilesInScope = selectedUser !== "all"
      ? profiles.filter((p) => p.email === selectedUser)
      : profiles;
    return profilesInScope
      .map((profile) => ({
        profile,
        submissions: submissions.filter((s) => s.full_name === profile.full_name),
        photos: photos.filter((p) => p.author === profile.full_name),
      }))
      .filter((c) => c.submissions.length > 0 || c.photos.length > 0);
  }, [profiles, submissions, photos, selectedUser, hasLoaded]);

  const totalPages = Math.ceil(personCards.length / ITEMS_PER_PAGE);
  const paginatedCards = personCards.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const mapPins = useMemo(() => {
    return profiles
      .map((p) => {
        const coords = getLocationPin(p);
        if (!coords) return null;
        return { ...coords, name: p.full_name, active: selectedUser === "all" || p.email === selectedUser, avatarUrl: getAvatarUrl(p.full_name) };
      })
      .filter(Boolean) as Array<{ x: number; y: number; name: string; active: boolean; avatarUrl: string }>;
  }, [profiles, selectedUser]);

  return (
    <AuthGuard>
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-10">

        <div className="text-center space-y-3">
          <div style={{ fontSize: 52 }}>&#127813;</div>
          <h1 className="text-5xl font-bold" style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: "#111" }}>
            Ketchup
          </h1>
          <p className="text-gray-400 text-sm max-w-sm mx-auto leading-relaxed">
            Catch up with the family &mdash; see where everyone is, what they&rsquo;ve been up to, and what&rsquo;s been on their mind.
          </p>
        </div>

        <WorldMap pins={mapPins} />

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <label className="text-xs uppercase tracking-widest text-gray-400 font-semibold text-center">
              Who do you want to catch up with?
            </label>
            <select value={selectedUser}
              onChange={(e) => { setSelectedUser(e.target.value); setHasLoaded(true); }}
              className="border-2 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-gray-900 transition"
              style={{ borderColor: "#e5e7eb", minWidth: "200px" }}
              title="Select a family member">
              <option value="all">Everyone</option>
              {profiles.map((p) => (
                <option key={p.email} value={p.email}>{p.full_name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <label className="text-xs uppercase tracking-widest text-gray-400 font-semibold text-center">
              Time period
            </label>
            <select value={selectedMonth}
              onChange={(e) => { setSelectedMonth(e.target.value); setHasLoaded(true); }}
              className="border-2 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-gray-900 transition"
              style={{ borderColor: "#e5e7eb", minWidth: "160px" }}
              title="Select a time period">
              {availableMonths.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {!hasLoaded && (
          <div className="text-center py-16 text-gray-400 space-y-3">
            <div style={{ fontSize: 48 }}>&#128070;</div>
            <div className="text-lg font-medium" style={{ fontFamily: "Georgia, serif" }}>
              Choose someone to catch up with
            </div>
            <div className="text-sm">
              Or select &ldquo;Everyone&rdquo; to see what the whole family&rsquo;s been up to.
            </div>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-3xl overflow-hidden animate-pulse"
                style={{ height: "320px", background: "#f3f4f6" }} />
            ))}
          </div>
        )}

        {hasLoaded && !loading && personCards.length === 0 && (
          <div className="text-center py-16 text-gray-400 space-y-3">
            <div style={{ fontSize: 48 }}>&#127797;</div>
            <div className="text-lg font-medium" style={{ fontFamily: "Georgia, serif" }}>Nothing to show yet</div>
            <div className="text-sm">No updates for this person or time period.</div>
          </div>
        )}

        {!loading && paginatedCards.length > 0 && (
          <div className="space-y-8">
            {paginatedCards.map((card) => (
              <PersonKetchupCard key={card.profile.email} card={card} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-4">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all disabled:opacity-30"
              style={{ borderColor: "#e5e7eb" }}>
              &larr; Prev
            </button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all disabled:opacity-30"
              style={{ borderColor: "#e5e7eb" }}>
              Next &rarr;
            </button>
          </div>
        )}

      </div>
    </AuthGuard>
  );
}
