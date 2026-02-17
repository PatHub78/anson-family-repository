export default function ThankYouPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-semibold">
        ✅ Thank you for your submission
      </h1>

      <div className="flex gap-4">
        <a href="/dashboard" className="underline">Dashboard</a>
        <a href="/album" className="underline">Album</a>
        <a href="/submit" className="underline">Submit Another Day</a>
      </div>
    </div>
  );
}
