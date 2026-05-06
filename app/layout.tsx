"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Permanent_Marker } from "next/font/google";
import { useState } from "react";

const marker = Permanent_Marker({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-marker",
});

const NAV_ITEMS = [
  { href: "/dashboard",        icon: "📊", label: "Dashboard" },
  { href: "/submit",           icon: "✏️", label: "Submit" },
  { href: "/ketchup",          icon: "🌍", label: "Ketchup" },
  { href: "/stories",          icon: "💭", label: "Memory Lane" },
  { href: "/album",            icon: "📷", label: "Anson Album" },
  { href: "/chess",            icon: "♟", label: "Chess" },
  { href: "/recommendations",  icon: "👍", label: "Recommendations" },
  { href: "/about",            icon: "🌳", label: "Winnie & Frank" },
]

// First 4 go in the mobile bottom bar, rest in "More"
const BOTTOM_BAR = NAV_ITEMS.slice(0, 4)
const MORE_ITEMS = NAV_ITEMS.slice(4)

function SidebarItem({ href, icon, label }: { href: string; icon: string; label: string }) {
  const pathname = usePathname()
  const isActive = pathname === href
  return (
    <Link
      href={href}
      title={label}
      className={`flex items-center justify-center w-12 h-12 rounded-xl text-2xl transition-colors
        ${isActive
          ? "bg-indigo-100 text-indigo-700"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"}`}
    >
      {icon}
    </Link>
  )
}

function BottomBarItem({ href, icon, label }: { href: string; icon: string; label: string }) {
  const pathname = usePathname()
  const isActive = pathname === href
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-0.5 flex-1 py-2 text-xs font-medium transition-colors
        ${isActive ? "text-indigo-600" : "text-gray-500 hover:text-gray-900"}`}
    >
      <span className="text-xl">{icon}</span>
      <span className="truncate w-full text-center">{label.split(" ")[0]}</span>
    </Link>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false)

  // Register service worker so Chrome treats this as a real installable PWA
  // (not just a browser shortcut)
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  }

  return (
    <html lang="en" className={marker.variable}>
      <head>
        {/* PWA / Add-to-Home-Screen */}
        <meta name="theme-color" content="#4f46e5" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Ansons" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body className="text-gray-900 bg-gray-50">

        {/* ── Desktop sidebar ── */}
        <aside className="hidden md:flex fixed left-0 top-0 h-full w-16 bg-white border-r border-gray-200 flex-col items-center py-4 gap-2 z-40">
          <Link href="/dashboard" className="text-3xl mb-2" title="Home">📖</Link>
          {NAV_ITEMS.map(item => (
            <SidebarItem key={item.href} {...item} />
          ))}
        </aside>

        {/* ── Main content ── */}
        <main className="md:pl-16 min-h-screen px-4 sm:px-6 py-6 pb-24 md:pb-6">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>

        {/* ── Mobile bottom bar ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-stretch z-40">
          {BOTTOM_BAR.map(item => (
            <BottomBarItem key={item.href} {...item} />
          ))}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(prev => !prev)}
            className="flex flex-col items-center gap-0.5 flex-1 py-2 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            <span className="text-xl">☰</span>
            <span>More</span>
          </button>
        </nav>

        {/* ── Mobile "More" drawer ── */}
        {moreOpen && (
          <>
            {/* Backdrop */}
            <div
              className="md:hidden fixed inset-0 bg-black/30 z-40"
              onClick={() => setMoreOpen(false)}
            />
            {/* Drawer */}
            <div className="md:hidden fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 z-50 rounded-t-2xl shadow-xl p-4">
              <div className="grid grid-cols-4 gap-3">
                {MORE_ITEMS.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-xs text-gray-600 text-center leading-tight">
                      {item.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

      </body>
    </html>
  )
}