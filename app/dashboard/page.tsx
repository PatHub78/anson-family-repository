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

function getColorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

function formatNumber(value: any) {
  return Number(value ?? 0).toLocaleString();
}

function getAvatarUrl(name: string) {
  const fileName = name.toLowerCase().replaceAll(" ", "-") + ".jpg";
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`;
}

function getFirstName(fullName: string) {
  return fullName.split(" ")[0];
}

/* -----------------------------
   Metric Image
----------------------------- */

function getMetricImage(metric: Metric) {
  if (metric === "steps")
    return "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?q=80&w=1200";

  if (metric === "exerciseMinutes")
    return "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=800";

  if (metric === "biking")
    return "https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?q=80&w=1200";

  return "https://i0.wp.com/www.themarginalian.org/wp-content/uploads/2014/01/norahborges15.jpg?w=680&ssl=1";
}

/* -----------------------------
   Avatar
----------------------------- */

const Avatar = ({ name, rank }: { name: string; rank: number }) => {
  const color = getColorForName(name);

  const medal =
    rank === 1 ? "🥇" :
    rank === 2 ? "🥈" :
    rank === 3 ? "🥉" :
    null;

  return (
    <div className="flex flex-col items-center gap-2 relative">
      <div
        style={{
          height: 90,
          width: 90,
          borderRadius: 24,
          overflow: "hidden",
          border: `4px solid ${color}`,
          background: "#111",
        }}
      >
        <img
          src={getAvatarUrl(name)}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {medal ? (
        <div className="absolute -top-2 -right-2 text-xl">{medal}</div>
      ) : (
        <div className="absolute -top-2 -right-2 bg-black text-white text-xs px-2 py-1 rounded-full">
          {rank}
        </div>
      )}

      <div className="text-sm text-gray-700">
        {getFirstName(name)}
      </div>
    </div>
  );
};

/* -----------------------------
   Scorecard
----------------------------- */

const ScoreCard = ({
  title,
  name,
  value,
}: {
  title: string;
  name: string;
  value: number;
}) => (
  <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 w-56">
    <div className="text-xs text-gray-500 mb-3">{title}</div>

    <div className="flex items-center gap-3">
      <div
        style={{
          height: 46,
          width: 46,
          borderRadius: 12,
          overflow: "hidden",
          border: `3px solid ${getColorForName(name)}`,
        }}
      >
        <img
          src={getAvatarUrl(name)}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      <div>
        <div className="text-sm font-semibold">
          {getFirstName(name)}
        </div>
        <div className="text-sm text-gray-500">
          {formatNumber(value)}
        </div>
      </div>
    </div>
  </div>
);

/* -----------------------------
   Page
----------------------------- */

export default function DashboardPage() {
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<Metric>("steps");

  const metricLabels = {
    steps: "Steps",
    exerciseMinutes: "Exercise",
    pagesRead: "Reading",
    biking: "Biking",
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from("submissions")
        .select("full_name, steps, time_exercises, pages_read, distance_biked, submission_date");

      setRows((data as Submission[]) ?? []);
      setLoading(false);
    };

    fetchData();
  }, []);

  const aggregated = useMemo(() => {
    const map = new Map<string, any>();

    rows.forEach((row) => {
      const name = row.full_name || "Unknown";

      if (!map.has(name)) {
        map.set(name, {
          id: name,
          steps: 0,
          exerciseMinutes: 0,
          pagesRead: 0,
          biking: 0,
        });
      }

      const current = map.get(name);

      current.steps += Number(row.steps ?? 0);
      current.exerciseMinutes += Number(row.time_exercises ?? 0);
      current.pagesRead += Number(row.pages_read ?? 0);
      current.biking += Number(row.distance_biked ?? 0);
    });

    return Array.from(map.values());
  }, [rows]);

  const sorted = useMemo(() => {
    return [...aggregated].sort((a, b) => b[metric] - a[metric]);
  }, [aggregated, metric]);

const leader = sorted[0];

/* -----------------------------
   DAILY STATS
----------------------------- */

const dailyStats = useMemo(() => {
  const perDay = new Map<string, number>();
  const perPersonDays = new Map<string, number[]>();

  rows.forEach((row) => {
    const name = row.full_name;

    const value =
      metric === "steps"
        ? Number(row.steps ?? 0)
        : metric === "exerciseMinutes"
        ? Number(row.time_exercises ?? 0)
        : metric === "pagesRead"
        ? Number(row.pages_read ?? 0)
        : Number(row.distance_biked ?? 0);

    const key = `${name}_${row.submission_date}`;

    perDay.set(key, (perDay.get(key) ?? 0) + value);

    if (!perPersonDays.has(name)) perPersonDays.set(name, []);
  });

  perDay.forEach((value, key) => {
    const [name] = key.split("_");
    perPersonDays.get(name)!.push(value);
  });

  let bestDay = { name: "", value: 0 };
  let bestAverage = { name: "", value: 0 };

  perPersonDays.forEach((values, name) => {
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    if (max > bestDay.value) bestDay = { name, value: max };
    if (avg > bestAverage.value) bestAverage = { name, value: avg };
  });

  return { bestDay, bestAverage };
}, [rows, metric]);

if (loading) {
  return <p className="text-sm text-gray-500">Loading dashboard…</p>;
}

  return (
    <AuthGuard>
      <div className="space-y-16">

        <header className="text-center space-y-4">
          <h1 className="text-5xl font-semibold tracking-tight">
            Anson Family ⚡ Pioneers of Action!
          </h1>

          <div className="text-3xl font-bold">
            {metricLabels[metric].toUpperCase()}
          </div>
        </header>

        <div className="flex justify-center gap-6">
          {(Object.keys(metricLabels) as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-10 py-4 rounded-full text-xl font-semibold transition ${
                metric === m
                  ? "bg-black text-white"
                  : "bg-white shadow-sm ring-1 ring-gray-200"
              }`}
            >
              {metricLabels[m]}
            </button>
          ))}
        </div>

        <div className="flex justify-center gap-8 flex-wrap">
          {sorted.map((p, index) => (
            <Avatar key={p.id} name={p.id} rank={index + 1} />
          ))}
        </div>

        {/* Main Row */}
        <div className="grid grid-cols-[160px_4fr_160px] gap-8 items-center">

          {/* Metric Image */}
          <div className="rounded-3xl overflow-hidden shadow-sm ring-1 ring-gray-200 bg-white">
            <img
              src={getMetricImage(metric)}
              alt="metric visual"
              style={{ width: "100%", height: 420, objectFit: "cover" }}
            />
          </div>

          {/* Chart */}
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
            <ResponsiveContainer width="100%" height={420}>
              <BarChart 
                data={sorted} 
                layout="vertical" 
                margin={{ top: 10, right: 40, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />

                <XAxis type="number" tickFormatter={formatNumber} />

                <YAxis
                  type="category"
                  dataKey="id"
                  width={90}
                  interval={0}
                  tick={{ fontSize: 14, fill: "#111", fontWeight: 600 }}
                  tickFormatter={(value) => getFirstName(value)}
                />

                <Tooltip formatter={(v) => formatNumber(v)} />

                <Bar dataKey={metric} radius={[0, 10, 10, 0]}>
                  {sorted.map((entry) => (
                    <Cell key={entry.id} fill={getColorForName(entry.id)} />
                  ))}

                  <LabelList
                    dataKey={metric}
                    position="right"
                    formatter={(v) => formatNumber(v)}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Scorecards */}
          <div className="flex flex-col gap-4">
            <ScoreCard
              title="Highest Daily Total"
              name={dailyStats.bestDay.name}
              value={dailyStats.bestDay.value}
            />

            <ScoreCard
              title="Highest Daily Average"
              name={dailyStats.bestAverage.name}
              value={Math.round(dailyStats.bestAverage.value)}
            />
          </div>

        </div>
      </div>
    </AuthGuard>
  );
}
