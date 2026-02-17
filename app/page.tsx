import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Welcome to We Are The Ansons 👋</h1>

      <nav>
        <ul>
          <li>
            <Link href="/about">About</Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
