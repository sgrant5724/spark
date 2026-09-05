import Link from "next/link";
export default function ForbiddenPage() {
  return (
    <div className="flex-1 grid place-items-center p-6">
      <div className="card max-w-md text-center">
        <h1 className="font-mono font-bold text-xl mb-2">Not allowed</h1>
        <p className="text-sm text-[var(--mute)] mb-4">Your role doesn&apos;t permit access to that page.</p>
        <Link href="/inbox" className="btn primary">Back to Inbox</Link>
      </div>
    </div>
  );
}
