"use client";

import { useState } from "react";
import AuthGuard from "@/app/components/AuthGuard"; // (optional if you ever reuse layout)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email) {
      alert("Please enter your email");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/about`, // ✅ Redirect after login (adjust as needed)
      },
    });

    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      alert("📬 Check your email — your login link is on the way!");
    }
  };

  return (
    <main className="max-w-md mx-auto py-24 px-6 text-center space-y-8">
      
      <h1 className="text-4xl font-semibold">
        Welcome Back
      </h1>

      <p className="text-gray-600 text-sm leading-relaxed">
        Enter your email address and we’ll send you a secure magic link.
        <br />
        No password required.
      </p>

      <div className="space-y-3">
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-xl px-4 py-3 text-sm text-center focus:outline-none focus:ring-2 focus:ring-black"
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          className="pill pill-active w-full"
        >
          {loading ? "Sending link..." : "Send Magic Link"}
        </button>
      </div>

      <p className="text-xs text-gray-400">
        We’ll never share your email.
      </p>

    </main>
  );
}
