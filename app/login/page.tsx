"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: "http://localhost:3000/album",
      },
    });

    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      alert("Check your email for the login link!");
    }
  };

  return (
    <main style={{ maxWidth: 400, margin: "4rem auto" }}>
      <h1>Login</h1>

      <input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", padding: "0.5rem", marginBottom: "1rem" }}
      />

      <button onClick={handleLogin} disabled={loading}>
        {loading ? "Sending link..." : "Send magic link"}
      </button>
    </main>
  );
}
