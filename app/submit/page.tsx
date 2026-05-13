"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import AuthGuard from "../components/AuthGuard";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Toast notification ───────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 24,
        left: "50%",
        transform: `translateX(-50%) translateY(${visible ? 0 : -80}px)`,
        opacity: visible ? 1 : 0,
        transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        zIndex: 9999,
        background: "linear-gradient(135deg, #1a1a1a, #2d2d2d)",
        color: "white",
        padding: "14px 28px",
        borderRadius: "999px",
        fontSize: "15px",
        fontWeight: 700,
        boxShadow: "0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        letterSpacing: "0.01em",
      }}
    >
      {message}
    </div>
  );
}

export default function SubmitPage() {
  const today = new Date().toISOString().split("T")[0];

  const [submittedDates, setSubmittedDates] = useState<string[]>([]);
  const [submissionDate, setSubmissionDate] = useState("");
  const [steps, setSteps] = useState("0");
  const [distanceBiked, setDistanceBiked] = useState("0");
  const [timeExercises, setTimeExercises] = useState("0");
  const [pagesRead, setPagesRead] = useState("0");
  const [eventOfTheDay, setEventOfTheDay] = useState("");
  const [caption, setCaption] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [myName, setMyName] = useState<string>("");
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3500);
  };

  useEffect(() => {
    const loadDates = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) return;

      // Load submitted dates
      const { data } = await supabase
        .from("submissions")
        .select("submission_date")
        .eq("email", user.email);
      setSubmittedDates(data?.map(d => d.submission_date) ?? []);

      // Load name for toast
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("email", user.email)
        .single();
      if (profile?.full_name) setMyName(profile.full_name);
    };
    loadDates();
  }, []);

  const uploadPhoto = async (userId: string) => {
    if (!photoFile) return null;
    const fileExt = photoFile.name.split(".").pop();
    const fileName = `${userId}_${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from("home-images")
      .upload(fileName, photoFile);
    if (error) { alert("Upload failed: " + error.message); return null; }
    const { data: publicUrlData } = supabase.storage
      .from("home-images")
      .getPublicUrl(fileName);
    return publicUrlData.publicUrl;
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) { setPhotoFile(null); setPhotoPreview(null); return; }

    const isHeic =
      file.type === 'image/heic' ||
      file.type === 'image/heif' ||
      file.name.toLowerCase().endsWith('.heic') ||
      file.name.toLowerCase().endsWith('.heif');

    if (isHeic) {
      showToast('Converting photo… one sec 📷');
      try {
        const heic2any = (await import('heic2any')).default;
        const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 }) as Blob;
        const converted = new File([blob], file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'), { type: 'image/jpeg' });
        setPhotoFile(converted);
        setPhotoPreview(URL.createObjectURL(converted));
      } catch {
        showToast('Could not convert HEIC — try a JPEG instead');
        setPhotoFile(null); setPhotoPreview(null);
      }
    } else {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) { alert("You must be logged in!"); return; }

    const today = new Date().toISOString().split("T")[0];

    if (submissionDate === today) {
      const confirmed = window.confirm(
        "You are submitting for today, but today is not over yet. Do you want to continue?"
      );
      if (!confirmed) return;
    }

    let fullName = myName || "Unknown User";
    if (!fullName || fullName === "Unknown User") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("email", user.email)
        .single();
      if (profile?.full_name) fullName = profile.full_name;
      else if (user.user_metadata?.full_name) fullName = user.user_metadata.full_name;
    }

    // Show personalised toast immediately on submit
    const first = fullName.split(" ")[0];
    showToast(`Hi ${first}! Submitting your day... 🎉`);

    const { data: existing } = await supabase
      .from("submissions")
      .select("id")
      .eq("email", user.email)
      .eq("submission_date", submissionDate)
      .maybeSingle();

    if (existing) {
      const confirmed = window.confirm(
        "You already submitted for this date. Continuing will overwrite your previous submission. Do you want to proceed?"
      );
      if (!confirmed) return;
    }

    setUploading(true);
    const photoUrl = await uploadPhoto(user.id);
    setUploading(false);

    const payload = {
      user_id: user.id,
      email: user.email,
      full_name: fullName,
      submission_date: submissionDate,
      steps: Number(steps) || null,
      distance_biked: Number(distanceBiked) || null,
      time_exercises: Number(timeExercises) || null,
      pages_read: Number(pagesRead) || null,
      event_of_the_day: eventOfTheDay || null,
    };

    const { data: insertData, error: submissionError } = await supabase
      .from("submissions")
      .upsert([payload], { onConflict: "email,submission_date" })
      .select();

    if (submissionError) {
      alert("Submission failed: " + submissionError.message);
      return;
    }

    if (photoUrl) {
      const photoPayload = {
        image_url: photoUrl,
        caption: caption || "",
        author: fullName,
        approved: true,
      };
      const { error: photoError } = await supabase
        .from("home_content")
        .insert([photoPayload])
        .select();
      if (photoError) { alert("Photo save failed: " + photoError.message); return; }
    }

    window.location.href = "/thank-you";
  };

  // Button style logic
  const buttonStyle: React.CSSProperties = {
    width: "100%",
    padding: "18px",
    borderRadius: "999px",
    fontSize: "18px",
    fontWeight: 700,
    color: "white",
    border: "none",
    cursor: uploading ? "wait" : "pointer",
    transition: "all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)",
    transform: isPressed ? "scale(0.96)" : isHovered ? "scale(1.03)" : "scale(1)",
    background: uploading
      ? "#6b7280"
      : isHovered
      ? "linear-gradient(135deg, #16a34a, #15803d)"
      : "linear-gradient(135deg, #111, #374151)",
    boxShadow: isHovered && !uploading
      ? "0 8px 24px rgba(22, 163, 74, 0.45), 0 2px 8px rgba(0,0,0,0.2)"
      : "0 2px 8px rgba(0,0,0,0.15)",
    letterSpacing: "0.02em",
  };

  return (
    <AuthGuard>
      {/* Toast */}
      <Toast message={toastMessage} visible={toastVisible} />

      <div className="max-w-2xl mx-auto bg-gray-100 min-h-screen py-10">
        <div className="bg-[#5f8569] text-white rounded-3xl shadow-sm ring-1 ring-gray-200 p-10 space-y-8">

          <h1 className="text-6xl italic font-semibold text-center">
            Share Your Day :)
          </h1>

          <img
            src="/Submit_form_foto.jpg"
            alt="Friends"
            className="w-full h-52 object-cover rounded-2xl"
          />

          <form onSubmit={handleSubmit} className="space-y-6">

            <Input label="Date">
              <input
                type="date"
                value={submissionDate}
                min="2026-01-01"
                max={today}
                onChange={(e) => setSubmissionDate(e.target.value)}
                required
                className="input text-black"
              />
              {submittedDates.includes(submissionDate) ? (
                <div className="text-white text-lg font-bold">
                  ✅ Submission already exists for this date
                </div>
              ) : (
                <div className="text-white text-lg font-semibold">
                  ⬜ No submission yet
                </div>
              )}
            </Input>

            <Input label="Steps">
              <input type="number" min="0" value={steps}
                onChange={(e) => setSteps(e.target.value)} className="input text-black" />
            </Input>

            <Input label="Distance Biked (miles)">
              <input type="number" min="0" step="0.1" value={distanceBiked}
                onChange={(e) => setDistanceBiked(e.target.value)} className="input text-black" />
            </Input>

            <Input label="Time Exercising (minutes)">
              <input type="number" min="0" value={timeExercises}
                onChange={(e) => setTimeExercises(e.target.value)} className="input text-black" />
            </Input>

            <Input label="Pages Read">
              <input type="number" min="0" value={pagesRead}
                onChange={(e) => setPagesRead(e.target.value)} className="input text-black" />
            </Input>

            <Input label="One Thing That Happened Today">
              <textarea value={eventOfTheDay}
                onChange={(e) => setEventOfTheDay(e.target.value)}
                rows={3} className="input text-black" />
            </Input>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Upload Photo</label>
              <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-black transition bg-gray-50">
                <span className="text-sm text-gray-600">📷 Choose a photo</span>
                {photoPreview && (
                  <img src={photoPreview} alt="Preview" className="h-32 rounded-lg object-cover" />
                )}
                <input type="file" accept="image/*"
                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                  className="hidden" />
              </label>
            </div>

            <Input label="Photo Caption">
              <input type="text" value={caption}
                onChange={(e) => setCaption(e.target.value)} className="input text-black" />
            </Input>

            {/* ── Submit button ── */}
            <button
              type="submit"
              disabled={uploading}
              style={buttonStyle}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
              onMouseDown={() => setIsPressed(true)}
              onMouseUp={() => setIsPressed(false)}
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-3">
                  <svg
                    className="animate-spin"
                    style={{ width: 22, height: 22 }}
                    viewBox="0 0 24 24" fill="none"
                  >
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Uploading your photo...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {isHovered ? "✓ Let's go!" : "Submit"}
                </span>
              )}
            </button>

            {success && (
              <div className="text-center text-sm">✅ Successfully submitted</div>
            )}

          </form>
        </div>
      </div>
    </AuthGuard>
  );
}

function Input({ label, children }: any) {
  return (
    <label className="block space-y-2">
      <div className="text-sm font-medium text-white">{label}</div>
      {children}
    </label>
  );
}
