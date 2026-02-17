"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/app/components/AuthGuard";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Recommendation {
  id: number;
  full_name: string;
  type: string;
  title: string | null;
  creator: string | null;
  image_url: string;
  recommendation_likes?: { count: number }[];
}

function getAvatarUrl(name?: string | null) {
  if (!name) return "/default-avatar.jpg"; // fallback image

  const fileName = name.toLowerCase().replaceAll(" ", "-") + ".jpg";
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`;
}

function getLikes(row: Recommendation) {
  return row.recommendation_likes?.[0]?.count ?? 0;
}

function TypeIcon({ type }: { type: string }) {
  const base = "absolute top-2 right-2 text-xs bg-white rounded-full px-2 py-1 shadow";

  if (type === "book") return <div className={base}>📖</div>;
  if (type === "movie") return <div className={base}>🎞️</div>;
  return <div className={base}>🎵</div>;
}

export default function RecommendationsPage() {
  const [rows, setRows] = useState<Recommendation[]>([]);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [sortMode, setSortMode] = useState<"new" | "popular">("new");
  const [showModal, setShowModal] = useState(false);

  const [newType, setNewType] = useState<"book" | "movie" | "song">("book");
  const [newTitle, setNewTitle] = useState("");
  const [newCreator, setNewCreator] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("recommendations")
        .select(`
          id,
          full_name,
          type,
          title,
          creator,
          image_url,
          recommendation_likes(count)
        `)
        .eq("approved", true);

      if (!error) setRows((data ?? []) as Recommendation[]);
      else console.error(error);
    };

    load();
  }, []);

  const users = useMemo(
    () => Array.from(new Set(rows.map(r => r.full_name))),
    [rows]
  );

  const filtered = useMemo(() => {
    let result = rows.filter(row => {
      if (selectedType !== "all" && row.type !== selectedType) return false;
      if (selectedUser !== "all" && row.full_name !== selectedUser) return false;
      return true;
    });

    if (sortMode === "popular") {
      result = [...result].sort((a, b) => getLikes(b) - getLikes(a));
    }

    return result;
  }, [rows, selectedType, selectedUser, sortMode]);

  const handleSave = async () => {
    if (!newTitle || !newImageUrl) {
      alert("Title and Image URL are required");
      return;
    }

    setSaving(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Not logged in");
      setSaving(false);
      return;
    }

    const email = user.email?.toLowerCase();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("email", email)
      .single();

    if (profileError || !profile) {
      alert("Profile not found");
      setSaving(false);
      return;
    }

    const fullName = profile.full_name;

    const { data, error } = await supabase
      .from("recommendations")
      .insert({
        type: newType,
        title: newTitle,
        creator: newCreator || null,
        image_url: newImageUrl,
        approved: true,
        full_name: fullName,
        email: email,
        submission_date: new Date().toISOString().split("T")[0]
      })
      .select()
      .single();

    setSaving(false);

    if (error) {
      console.error("SUPABASE ERROR:", error);
      alert(error.message);
      return;
    }

    // Instantly update UI (important)
    setRows(prev => [data, ...prev]);

    // Reset form
    setNewTitle("");
    setNewCreator("");
    setNewImageUrl("");
    setShowModal(false);
  };

    const handleLike = async (recommendationId: number) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userId = user.id;

      // Check if already liked
      const { data: existing } = await supabase
        .from("recommendation_likes")
        .select("*")
        .eq("user_id", userId)
        .eq("recommendation_id", recommendationId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("recommendation_likes")
          .delete()
          .eq("user_id", userId)
          .eq("recommendation_id", recommendationId);
      } else {
        await supabase
          .from("recommendation_likes")
          .insert({
            user_id: userId,
            recommendation_id: recommendationId
          });
      }

      // Reload recommendations (simple & safe)
      const { data } = await supabase
        .from("recommendations")
        .select(`
          id,
          full_name,
          type,
          title,
          creator,
          image_url,
          recommendation_likes(count)
        `)
        .eq("approved", true);

      setRows((data ?? []) as Recommendation[]);
    };

  return (
    <AuthGuard>
      <div className="max-w-6xl mx-auto py-16 px-6 space-y-10">

        <div className="flex justify-center items-center gap-4">
          <h1 className="text-4xl font-semibold">
            Recommendations
          </h1>

          <button
            onClick={() => setShowModal(true)}
            className="pill pill-active"
          >
            + Add
          </button>
        </div>

        {/* SORTING */}
        <div className="flex justify-center gap-3">
          <button onClick={() => setSortMode("new")} className="pill">
            New
          </button>
          <button onClick={() => setSortMode("popular")} className="pill">
            Most Loved
          </button>
        </div>

        {/* TYPE FILTER */}
        <div className="flex justify-center gap-4">
          {["all", "book", "movie", "song"].map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`pill ${selectedType === type ? "pill-active" : ""}`}
            >
              {type === "all"
                ? "All"
                : type === "book"
                ? "Books"
                : type === "movie"
                ? "Movies"
                : "Songs"}
            </button>
          ))}
        </div>

        {/* USER FILTER */}
        <div className="flex justify-center gap-6 flex-wrap">
          <button
            onClick={() => setSelectedUser("all")}
            className={`pill ${selectedUser === "all" ? "pill-active" : ""}`}
          >
            All
          </button>

          {users.map(user => (
            <div
              key={user}
              onClick={() => setSelectedUser(user)}
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <div className="bg-white p-2 rounded-xl shadow-sm">
                <img
                  src={getAvatarUrl(user)}
                  alt={user}
                  className={`h-16 w-16 object-cover ${
                    selectedUser === user ? "ring-2 ring-black" : ""
                  }`}
                />
                <div className="sharpie text-sm text-center mt-1">
                  {user ? user.split(" ")[0] : "Unknown"}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5">
          {filtered.map(row => (
            <div key={row.id} className="bg-white rounded-xl p-2 shadow-sm">
              <div className="relative">
                <img
                  src={row.image_url}
                  alt={row.title ?? "image"}
                  className="w-full aspect-square object-cover rounded-lg"
                />
                <TypeIcon type={row.type} />
              </div>

              {row.title && (
                <div className="text-xs font-semibold mt-2">
                  {row.title}
                </div>
              )}

              {row.creator && (
                <div className="text-xs text-gray-500">
                  {row.creator}
                </div>
              )}

              <button
                onClick={() => handleLike(row.id)}
                className="text-xs text-gray-400 mt-1"
              >
                ❤️ {getLikes(row)}
              </button>
            </div>
          ))}
        </div>

      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-100 space-y-4">
            <div className="text-lg font-semibold">Add Recommendation</div>

            {/* TYPE */}
            <div className="flex gap-2">
              {["book", "movie", "song"].map(t => (
                <button
                  key={t}
                  onClick={() => setNewType(t as any)}
                  className={`pill ${newType === t ? "pill-active" : ""}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* TITLE */}
            <input
              placeholder="Title"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />

            {/* CREATOR */}
            <input
              placeholder="Author / Artist / Director"
              value={newCreator}
              onChange={e => setNewCreator(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />

            {/* IMAGE */}
            <input
              placeholder="Image URL"
              value={newImageUrl}
              onChange={e => setNewImageUrl(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />

            {/* PREVIEW */}
            {newImageUrl && (
              <img
                src={newImageUrl}
                alt="preview"
                className="w-24 h-24 object-cover rounded-lg mx-auto"
              />
            )}

            {/* BUTTONS */}
            <div className="flex justify-between">
              <button
                onClick={() => setShowModal(false)}
                className="pill"
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                className="pill pill-active"
                disabled={saving}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

    </AuthGuard>
  );
}
