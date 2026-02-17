"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// ✅ Single stable client instance
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Props = {
  children: ReactNode;
};

export default function AuthGuard({ children }: Props) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    let mounted = true;

    // ✅ Initial session check
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session) {
        router.replace("/login");
        return;
      }

      // ✅ NEW: Check profiles table
      const email = session.user.email?.toLowerCase();

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("email")
        .eq("email", email)
        .single();

      if (error || !profile) {
        await supabase.auth.signOut();
        setUnauthorized(true);
        setChecking(false);
        return;
      }

      setChecking(false);
    };

    checkSession();

    // ✅ React to auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session && !unauthorized) {
          router.replace("/login");
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  // ✅ Prevent flicker entirely
    if (checking) {
      return (
        <div className="flex items-center justify-center h-screen text-sm text-gray-500">
          Checking session…
        </div>
      );
    }

    if (unauthorized) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="bg-white p-6 rounded-xl shadow-sm text-center space-y-3">
            <div className="text-lg font-semibold">
              Your email is not authorized
            </div>
            <div className="text-sm text-gray-500">
              Please contact Patrick to request access.
            </div>
            <button
              onClick={() => router.replace("/login")}
              className="pill pill-active"
            >
              Back to Login
            </button>
          </div>
        </div>
      );
    }

  return <>{children}</>;
}
