"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/app/components/AuthGuard";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function WeeklyChallengesPage() {
  const [challenge, setChallenge] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const today = new Date();

      // Calculate Monday of current week
      const day = today.getDay(); // Sunday=0
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(today);
      monday.setDate(today.getDate() + diff);

      const mondayStr = monday.toISOString().split("T")[0];

      const { data } = await supabase
        .from("weekly_challenges")
        .select("*")
        .eq("week_start", mondayStr)
        .single();

      setChallenge(data);
    };

    load();
  }, []);

  return (
    <AuthGuard>
      <div className="max-w-3xl mx-auto py-16 px-6 space-y-8 text-center">

        <h1 className="text-4xl font-semibold">
          Weekly Challenge
        </h1>

        <img
          src="/challenge-image.jpg"
          alt="challenge"
          className="w-full rounded-2xl shadow-sm"
        />

        {challenge ? (
          <div className="space-y-4">

            <div className="text-xl">
              {challenge.challenge}
            </div>

            {challenge.bonus && (
              <div className="text-gray-500">
                Bonus: {challenge.bonus}
              </div>
            )}

          </div>
        ) : (
          <div className="text-gray-500">
            No challenge set for this week.
          </div>
        )}

      </div>
    </AuthGuard>
  );
}
