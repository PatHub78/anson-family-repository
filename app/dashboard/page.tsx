"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/app/components/AuthGuard";
import { createClient } from "@supabase/supabase-js";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LabelList,
} from "recharts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Submission {
  full_name: string;
  steps: number | null;
  time_exercises: number | null;
  pages_read: number | null;
  distance_biked: number | null;
  submission_date: string;
}

type Metric = "steps" | "exerciseMinutes" | "pagesRead" | "biking";
type TimeFilter = "7d" | "30d" | "allTime";

interface AggregatedPerson {
  id: string;
  steps: number;
  exerciseMinutes: number;
  pagesRead: number;
  biking: number;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getColorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 52%)`;
}

function formatNumber(value: number | string | undefined) {
  return Number(value ?? 0).toLocaleString();
}

function getAvatarUrl(name: string) {
  const fileName = name.toLowerCase().replaceAll(" ", "-") + ".jpg";
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`;
}

function getFirstName(fullName: string) {
  return fullName.split(" ")[0];
}

function daysAgo(dateStr: string): number {
  const now = new Date();
  const d = new Date(dateStr + "T12:00:00Z");
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function getFilteredRows(rows: Submission[], filter: TimeFilter): Submission[] {
  if (filter === "allTime") return rows;
  const days = filter === "7d" ? 7 : 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return rows.filter((r) => new Date(r.submission_date + "T12:00:00Z") >= cutoff);
}

function getMetricValue(row: Submission, metric: Metric): number {
  if (metric === "steps") return Number(row.steps ?? 0);
  if (metric === "exerciseMinutes") return Number(row.time_exercises ?? 0);
  if (metric === "pagesRead") return Number(row.pages_read ?? 0);
  return Number(row.distance_biked ?? 0);
}

function getFreshnessColor(daysSince: number): string {
  if (daysSince <= 2) return "#22c55e";
  if (daysSince <= 7) return "#f59e0b";
  return "#ef4444";
}

function getFreshnessLabel(daysSince: number): string {
  if (daysSince === 0) return "today";
  if (daysSince === 1) return "yesterday";
  return `${daysSince}d ago`;
}

function getMetricEmoji(metric: Metric): string {
  if (metric === "steps") return "👟";
  if (metric === "exerciseMinutes") return "🏋️";
  if (metric === "pagesRead") return "📚";
  return "🚴";
}

function getMetricUnit(metric: Metric): string {
  if (metric === "steps") return "steps";
  if (metric === "exerciseMinutes") return "min";
  if (metric === "pagesRead") return "pages";
  return "km";
}

// ─────────────────────────────────────────────
// Trend Arrow
// ─────────────────────────────────────────────

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return (
    <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#dcfce7", color: "#16a34a" }}>
      NEW
    </span>
  );

  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;

  return (
    <span
      className="text-xs font-bold px-1.5 py-0.5 rounded-full"
      style={{
        background: up ? "#dcfce7" : "#fee2e2",
        color: up ? "#16a34a" : "#dc2626",
      }}
    >
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

// ─────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────

function StatCard({
  label,
  name,
  value,
  unit,
  emoji,
  sub,
}: {
  label: string;
  name: string;
  value: number;
  unit: string;
  emoji: string;
  sub?: string;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
    >
      <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "#9ca3af" }}>
        {emoji} {label}
      </div>
      <div className="flex items-center gap-3">
        <div
          className="rounded-xl overflow-hidden flex-shrink-0"
          style={{ width: 40, height: 40, border: `3px solid ${getColorForName(name)}` }}
        >
          <img src={getAvatarUrl(name)} alt={name} className="w-full h-full object-cover" />
        </div>
        <div>
          <div className="text-sm font-bold" style={{ color: "#111" }}>{getFirstName(name)}</div>
          <div className="text-sm" style={{ color: "#6b7280" }}>
            {formatNumber(value)} {unit}
          </div>
          {sub && <div className="text-xs" style={{ color: "#9ca3af" }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Streak Badge
// ─────────────────────────────────────────────

function streakDays(submissions: string[]): number {
  const unique = [...new Set(submissions)].sort().reverse();
  if (unique.length === 0) return 0;
  let streak = 0;
  let current = new Date();
  current.setHours(0, 0, 0, 0);

  for (const d of unique) {
    const day = new Date(d + "T12:00:00Z");
    day.setHours(0, 0, 0, 0);
    const diff = Math.round((current.getTime() - day.getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 1) {
      streak++;
      current = day;
    } else {
      break;
    }
  }
  return streak;
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function DashboardPage() {
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<Metric>("steps");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("30d");

  const metricLabels: Record<Metric, string> = {
    steps: "Steps",
    exerciseMinutes: "Exercise",
    pagesRead: "Reading",
    biking: "Biking",
  };

  const timeLabels: Record<TimeFilter, string> = {
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    allTime: "All time",
  };

  useEffect(() => {
    const fetchData = async () => {
      // Supabase's PostgREST defaults to 1000 rows per response. We have to
      // page through explicitly to get every submission.
      const PAGE = 1000;
      const all: Submission[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("submissions")
          .select("full_name, steps, time_exercises, pages_read, distance_biked, submission_date")
          .order("submission_date", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error || !data || data.length === 0) break;
        all.push(...(data as Submission[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setRows(all);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Filtered rows for current period
  const filteredRows = useMemo(() => getFilteredRows(rows, timeFilter), [rows, timeFilter]);

  // Filtered rows for previous period (for trend comparison)
  const previousRows = useMemo(() => {
    if (timeFilter === "allTime") return [];
    const days = timeFilter === "7d" ? 7 : 30;
    const now = new Date();
    const periodStart = new Date();
    periodStart.setDate(now.getDate() - days);
    const prevStart = new Date();
    prevStart.setDate(now.getDate() - days * 2);

    return rows.filter((r) => {
      const d = new Date(r.submission_date + "T12:00:00Z");
      return d >= prevStart && d < periodStart;
    });
  }, [rows, timeFilter]);

  // Aggregate current period
  const aggregated = useMemo(() => {
    const map = new Map<string, Record<string, number>>();

    filteredRows.forEach((row) => {
      const name = row.full_name || "Unknown";
      if (!map.has(name)) map.set(name, { steps: 0, exerciseMinutes: 0, pagesRead: 0, biking: 0 });
      const c = map.get(name)!;
      c.steps += Number(row.steps ?? 0);
      c.exerciseMinutes += Number(row.time_exercises ?? 0);
      c.pagesRead += Number(row.pages_read ?? 0);
      c.biking += Number(row.distance_biked ?? 0);
    });

    return Array.from(map.entries()).map(([id, vals]) => ({ id, ...vals })) as AggregatedPerson[];
  }, [filteredRows]);

  // Aggregate previous period
  const prevAggregated = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    previousRows.forEach((row) => {
      const name = row.full_name || "Unknown";
      if (!map.has(name)) map.set(name, { steps: 0, exerciseMinutes: 0, pagesRead: 0, biking: 0 });
      const c = map.get(name)!;
      c.steps += Number(row.steps ?? 0);
      c.exerciseMinutes += Number(row.time_exercises ?? 0);
      c.pagesRead += Number(row.pages_read ?? 0);
      c.biking += Number(row.distance_biked ?? 0);
    });
    return map;
  }, [previousRows]);

  const sorted = useMemo(() => {
    return [...aggregated].sort((a, b) => b[metric] - a[metric]);
  }, [aggregated, metric]);

  // Per-person freshness & submission count
  const personMeta = useMemo(() => {
    const map = new Map<string, { lastDate: string; totalDays: number; allDates: string[] }>();

    rows.forEach((row) => {
      const name = row.full_name;
      if (!map.has(name)) map.set(name, { lastDate: row.submission_date, totalDays: 0, allDates: [] });
      const m = map.get(name)!;
      if (row.submission_date > m.lastDate) m.lastDate = row.submission_date;
      if (!m.allDates.includes(row.submission_date)) {
        m.allDates.push(row.submission_date);
        m.totalDays++;
      }
    });

    return map;
  }, [rows]);

  // Best stats
  const bestStats = useMemo(() => {
    if (filteredRows.length === 0) return null;

    // Best single day
    const dayMap = new Map<string, number>();
    filteredRows.forEach((row) => {
      const key = `${row.full_name}_${row.submission_date}`;
      dayMap.set(key, (dayMap.get(key) ?? 0) + getMetricValue(row, metric));
    });

    let bestDay = { name: "", value: 0, date: "" };
    dayMap.forEach((value, key) => {
      const [name, date] = key.split("_");
      if (value > bestDay.value) bestDay = { name, value, date };
    });

    // Best average
    const perPerson = new Map<string, number[]>();
    dayMap.forEach((value, key) => {
      const [name] = key.split("_");
      if (!perPerson.has(name)) perPerson.set(name, []);
      perPerson.get(name)!.push(value);
    });

    let bestAvg = { name: "", value: 0 };
    perPerson.forEach((vals, name) => {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (avg > bestAvg.value) bestAvg = { name, value: avg };
    });

    // Most consistent (most submission days in period)
    const dayCount = new Map<string, Set<string>>();
    filteredRows.forEach((row) => {
      if (!dayCount.has(row.full_name)) dayCount.set(row.full_name, new Set());
      dayCount.get(row.full_name)!.add(row.submission_date);
    });

    let mostConsistent = { name: "", days: 0 };
    dayCount.forEach((days, name) => {
      if (days.size > mostConsistent.days) mostConsistent = { name, days: days.size };
    });

    return { bestDay, bestAvg, mostConsistent };
  }, [filteredRows, metric]);

  // Most improved (biggest positive trend)
  const mostImproved = useMemo(() => {
    if (timeFilter === "allTime") return null;
    let best = { name: "", pct: -Infinity };

    aggregated.forEach(({ id, ...vals }) => {
      const curr = vals[metric] as number;
      const prev = prevAggregated.get(id)?.[metric] ?? 0;
      if (prev === 0) return;
      const pct = ((curr - prev) / prev) * 100;
      if (pct > best.pct) best = { name: id, pct };
    });

    return best.name ? best : null;
  }, [aggregated, prevAggregated, metric, timeFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-sm animate-pulse" style={{ color: "#9ca3af" }}>Loading dashboard…</div>
      </div>
    );
  }

  const unit = getMetricUnit(metric);
  const emoji = getMetricEmoji(metric);

  return (
    <AuthGuard>
      <div
        className="min-h-screen -mx-6 -my-10 px-6 py-12"
        style={{ background: "#f8f7f4" }}
      >
        <div className="max-w-5xl mx-auto space-y-10">

          {/* ── Header ── */}
          <div className="text-center space-y-2">
            <h1
              className="text-4xl sm:text-6xl font-black tracking-tight"
              style={{ color: "#111", letterSpacing: "-0.03em" }}
            >
              Anson Family
            </h1>
            <div className="text-base font-medium" style={{ color: "#9ca3af" }}>
              Pioneers of Action ⚡
            </div>
          </div>

          {/* ── Filters ── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

            {/* Metric pills */}
            <div className="flex gap-2 flex-wrap justify-center">
              {(Object.keys(metricLabels) as Metric[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className="px-4 py-2 rounded-full text-sm font-bold transition hover:scale-105"
                  style={{
                    background: metric === m ? "#111" : "#fff",
                    color: metric === m ? "#fff" : "#374151",
                    border: metric === m ? "none" : "1px solid #e5e7eb",
                    boxShadow: metric === m ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
                  }}
                >
                  {getMetricEmoji(m)} {metricLabels[m]}
                </button>
              ))}
            </div>

            {/* Time pills */}
            <div className="flex gap-2">
              {(Object.keys(timeLabels) as TimeFilter[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeFilter(t)}
                  className="px-4 py-2 rounded-full text-sm font-bold transition hover:scale-105"
                  style={{
                    background: timeFilter === t ? "#6366f1" : "#fff",
                    color: timeFilter === t ? "#fff" : "#374151",
                    border: timeFilter === t ? "none" : "1px solid #e5e7eb",
                    boxShadow: timeFilter === t ? "0 4px 12px rgba(99,102,241,0.3)" : "none",
                  }}
                >
                  {timeLabels[t]}
                </button>
              ))}
            </div>
          </div>

          {/* ── Avatar row with freshness ── */}
          <div
            className="rounded-3xl p-6"
            style={{ background: "#fff", border: "1px solid #e5e7eb" }}
          >
            <div className="flex flex-wrap justify-center gap-6">
              {sorted.map((p, index) => {
                const meta = personMeta.get(p.id);
                const lastDate = meta?.lastDate ?? "";
                const daysSince = lastDate ? daysAgo(lastDate) : 999;
                const freshnessColor = getFreshnessColor(daysSince);
                const streak = meta ? streakDays(meta.allDates) : 0;
                const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null;
                const prev = prevAggregated.get(p.id)?.[metric] ?? 0;

                return (
                  <div key={p.id} className="flex flex-col items-center gap-2 relative">
                    {/* Freshness ring */}
                    <div
                      className="rounded-3xl overflow-hidden relative"
                      style={{
                        width: 80, height: 80,
                        border: `4px solid ${getColorForName(p.id)}`,
                        boxShadow: `0 0 0 2px ${freshnessColor}`,
                      }}
                    >
                      <img
                        src={getAvatarUrl(p.id)}
                        alt={p.id}
                        className="w-full h-full object-cover"
                      />
                      {/* Freshness dot */}
                      <div
                        className="absolute bottom-1 right-1 rounded-full"
                        style={{ width: 10, height: 10, background: freshnessColor, border: "2px solid #fff" }}
                      />
                    </div>

                    {/* Medal or rank */}
                    {medal ? (
                      <div className="absolute -top-2 -right-2 text-lg">{medal}</div>
                    ) : (
                      <div
                        className="absolute -top-2 -right-2 text-xs font-black w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: "#111", color: "#fff" }}
                      >
                        {index + 1}
                      </div>
                    )}

                    <div className="text-center">
                      <div className="text-sm font-bold" style={{ color: "#111" }}>
                        {getFirstName(p.id)}
                      </div>
                      <div className="text-xs" style={{ color: "#9ca3af" }}>
                        {formatNumber(p[metric])} {unit}
                      </div>
                      {/* Trend badge */}
                      <div className="mt-1 flex justify-center">
                        <TrendBadge current={p[metric] as number} previous={prev} />
                      </div>
                      {/* Streak */}
                      {streak >= 3 && (
                        <div className="text-xs font-bold mt-0.5" style={{ color: "#f59e0b" }}>
                          🔥 {streak}d streak
                        </div>
                      )}
                      {/* Freshness */}
                      <div className="text-[10px] mt-0.5" style={{ color: freshnessColor }}>
                        {getFreshnessLabel(daysSince)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Chart ── */}
          <div
            className="rounded-3xl p-6 sm:p-8"
            style={{ background: "#fff", border: "1px solid #e5e7eb" }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-lg font-black" style={{ color: "#111" }}>
                  {emoji} {metricLabels[metric]} Leaderboard
                </div>
                <div className="text-xs" style={{ color: "#9ca3af" }}>
                  {timeLabels[timeFilter]}
                </div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={340}>
              <BarChart
                data={sorted}
                layout="vertical"
                margin={{ top: 10, right: 60, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" tickFormatter={formatNumber} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="id"
                  width={80}
                  interval={0}
                  tick={{ fontSize: 13, fill: "#374151", fontWeight: 700 }}
                  tickFormatter={getFirstName}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v) => [`${formatNumber(v as number)} ${unit}`, metricLabels[metric]]}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 13 }}
                />
                <Bar dataKey={metric} radius={[0, 10, 10, 0]} maxBarSize={36}>
                  {sorted.map((entry) => (
                    <Cell key={entry.id} fill={getColorForName(entry.id)} />
                  ))}
                  <LabelList
                    dataKey={metric}
                    position="right"
                    formatter={(v: unknown) => formatNumber(v as number)}
                    style={{ fontSize: 12, fontWeight: 700, fill: "#374151" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Stat Cards ── */}
          {bestStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Best single day"
                name={bestStats.bestDay.name}
                value={bestStats.bestDay.value}
                unit={unit}
                emoji="⚡"
                sub={bestStats.bestDay.date}
              />
              <StatCard
                label="Best daily avg"
                name={bestStats.bestAvg.name}
                value={Math.round(bestStats.bestAvg.value)}
                unit={unit}
                emoji="📈"
              />
              <StatCard
                label="Most consistent"
                name={bestStats.mostConsistent.name}
                value={bestStats.mostConsistent.days}
                unit="days"
                emoji="🎯"
                sub="submission days"
              />
              {mostImproved && (
                <StatCard
                  label="Most improved"
                  name={mostImproved.name}
                  value={Math.round(mostImproved.pct)}
                  unit="%"
                  emoji="🚀"
                  sub="vs previous period"
                />
              )}
            </div>
          )}

          {/* ── Submission activity table ── */}
          <div
            className="rounded-3xl p-6 sm:p-8"
            style={{ background: "#fff", border: "1px solid #e5e7eb" }}
          >
            <div className="text-base font-black mb-5" style={{ color: "#111" }}>
              📋 Submission Activity
            </div>
            <div className="space-y-3">
              {[...personMeta.entries()]
                .sort((a, b) => b[1].totalDays - a[1].totalDays)
                .map(([name, meta]) => {
                  const daysSince = daysAgo(meta.lastDate);
                  const freshnessColor = getFreshnessColor(daysSince);
                  const pct = Math.min(100, Math.round((meta.totalDays / Math.max(...[...personMeta.values()].map(m => m.totalDays))) * 100));

                  return (
                    <div key={name} className="flex items-center gap-4">
                      <div
                        className="rounded-xl overflow-hidden flex-shrink-0"
                        style={{ width: 36, height: 36, border: `2px solid ${getColorForName(name)}` }}
                      >
                        <img src={getAvatarUrl(name)} alt={name} className="w-full h-full object-cover" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold" style={{ color: "#111" }}>{getFirstName(name)}</span>
                          <span className="text-xs" style={{ color: "#9ca3af" }}>
                            {meta.totalDays} days · last {getFreshnessLabel(daysSince)}
                          </span>
                        </div>
                        <div className="rounded-full overflow-hidden" style={{ height: 6, background: "#f3f4f6" }}>
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: getColorForName(name) }}
                          />
                        </div>
                      </div>

                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: freshnessColor }}
                      />
                    </div>
                  );
                })}
            </div>
          </div>

        </div>
      </div>
    </AuthGuard>
  );
}
