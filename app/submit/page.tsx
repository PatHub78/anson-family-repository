"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import AuthGuard from "../components/AuthGuard";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
  
  useEffect(() => {
    const loadDates = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) return;

      const { data } = await supabase
        .from("submissions")
        .select("submission_date")
        .eq("email", user.email);

      setSubmittedDates(data?.map(d => d.submission_date) ?? []);
    };

    loadDates();
  }, []);

  const uploadPhoto = async (userId: string) => {
    if (!photoFile) return null;

    console.log("Uploading file:", photoFile.name);

    const fileExt = photoFile.name.split(".").pop();
    const fileName = `${userId}_${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from("home-images")
      .upload(fileName, photoFile);

    console.log("Storage response:", { data, error });

    if (error) {
      alert("Upload failed: " + error.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from("home-images")
      .getPublicUrl(fileName);

    console.log("Public URL:", publicUrlData.publicUrl);

    return publicUrlData.publicUrl;
  };

  const handleFileChange = (file: File | null) => {
    console.log("File selected:", file);

    setPhotoFile(file);

    if (!file) {
      setPhotoPreview(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log("---- SUBMIT START ----");

    const { data: userData, error: userError } = await supabase.auth.getUser();

    console.log("Auth response:", { userData, userError });

    const user = userData?.user;

    if (!user) {
      alert("You must be logged in!");
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    if (submissionDate === today) {
      const confirmed = window.confirm(
        "You are submitting for today, but today is not over yet. Do you want to continue?"
      );

      if (!confirmed) return;
    }

    let fullName = "Unknown User";

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("email", user.email)
      .single();

    if (profile?.full_name) {
      fullName = profile.full_name;
    } else if (user.user_metadata?.full_name) {
      fullName = user.user_metadata.full_name;
    }
      
    console.log("User ID:", user.id);
    console.log("Submission date:", submissionDate);

    setUploading(true);
    const photoUrl = await uploadPhoto(user.id);
    setUploading(false);

    console.log("Photo URL result:", photoUrl);

    const payload = {
      user_id: user.id,
      email: user.email,        // ADD
      full_name: fullName,      // ADD
      submission_date: submissionDate,
      steps: Number(steps) || null,
      distance_biked: Number(distanceBiked) || null,
      time_exercises: Number(timeExercises) || null,
      pages_read: Number(pagesRead) || null,
      event_of_the_day: eventOfTheDay || null,
    };

    console.log("INSERT PAYLOAD:", payload);

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

    const { data: insertData, error: submissionError } = await supabase
      .from("submissions")
      
      .upsert([payload], { onConflict: "email,submission_date"})
      .select();

    console.log("Insert response:", { insertData, submissionError });

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

      console.log("PHOTO PAYLOAD:", photoPayload);

      const { data: photoData, error: photoError } = await supabase
        .from("home_content")
        .insert([photoPayload])
        .select();

      console.log("Photo insert response:", { photoData, photoError });

      if (photoError) {
        alert("Photo save failed: " + photoError.message);
        return;
      }
    }

    console.log("---- SUBMIT SUCCESS ----");

    window.location.href = "/thank-you";

  };

  return (
    <AuthGuard>
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
                min="2026-01-01"     // ✅ BLOCK past
                max={today}          // ✅ BLOCK future
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
              <input
                type="number"
                min="0"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                className="input text-black"
              />
            </Input>

            <Input label="Distance Biked (miles)">
              <input
                type="number"
                min="0"
                step="0.1"
                value={distanceBiked}
                onChange={(e) => setDistanceBiked(e.target.value)}
                className="input text-black"
              />
            </Input>

            <Input label="Time Exercising (minutes)">
              <input
                type="number"
                min="0"
                value={timeExercises}
                onChange={(e) => setTimeExercises(e.target.value)}
                className="input text-black"
              />
            </Input>

            <Input label="Pages Read">
              <input
                type="number"
                min="0"
                value={pagesRead}
                onChange={(e) => setPagesRead(e.target.value)}
                className="input text-black"
              />
            </Input>

            <Input label="One Thing That Happened Today">
              <textarea
                value={eventOfTheDay}
                onChange={(e) => setEventOfTheDay(e.target.value)}
                rows={3}
                className="input text-black"
              />
            </Input>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">
                Upload Photo
              </label>

              <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-black transition bg-gray-50">

                <span className="text-sm text-gray-600">
                  📷 Choose a photo
                </span>

                {photoPreview && (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="h-32 rounded-lg object-cover"
                  />
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleFileChange(e.target.files?.[0] ?? null)
                  }
                  className="hidden"
                />
              </label>
            </div>

            <Input label="Photo Caption">
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="input text-black"
              />
            </Input>

            <button
              type="submit"
              disabled={uploading}
              className="w-full bg-black text-white py-4 rounded-full text-lg font-semibold"
            >
              Submit
            </button>

            {success && (
              <div className="text-center text-sm">
                ✅ Successfully submitted
              </div>
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
