"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Permanent_Marker } from "next/font/google";

const marker = Permanent_Marker({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-marker",
});

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  if (isActive) return null;

  return (
    <Link
      href={href}
      className="text-slate-600 hover:text-black transition-colors"
    >
      {label}
    </Link>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={marker.variable}>
      <body className="text-gray-900">

        <header className="bg-white border-b border-gray-200">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center gap-3">

            <div className="text-4xl mr-10">📖</div>

            <nav className="flex-1 flex flex-wrap justify-center gap-4 text-sm sm:text-lg font-semibold">
              <NavLink href="/about" label="Winnie & Frank" />
              <NavLink href="/submit" label="Submit" />
              <NavLink href="/album" label="Anson Album" />
              <NavLink href="/dashboard" label="Dashboard" />
              <NavLink href="/ketchup" label="Ketchup" />
              <NavLink href="/streakers" label="Streakers" />
              <NavLink href="/weekly-challenges" label="I Wish You Would!" />
              <NavLink href="/recommendations" label="Recommendations" />
              <NavLink href="/word-play" label="WordSmith" />
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-10">
          {children}
        </main>

      </body>
    </html>
  );
}
