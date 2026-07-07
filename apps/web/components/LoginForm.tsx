"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { SparkLogo } from "@/components/SparkLogo";

export function LoginForm() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      totp,
      redirect: false,
      callbackUrl,
    });
    setPending(false);
    if (res?.error) {
      setError("Invalid email, password, or authenticator code.");
      return;
    }
    window.location.href = res?.url ?? callbackUrl;
  }

  return (
    <div className="w-[340px] rounded-brand bg-surface p-7 shadow-xl">
      <div className="mb-5 flex items-center gap-3">
        <SparkLogo size={34} />
        <div>
          <div className="font-display text-lg font-bold text-ink">Spark</div>
          <div className="text-[0.6rem] uppercase tracking-[0.18em] text-accent">
            LSI Media
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-ink/60">
            Email
          </span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-ink/60">
            Password
          </span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-ink/60">
            Authenticator code (if enabled)
          </span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={totp}
            onChange={(e) => setTotp(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-accent-warn">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-orange py-2 font-display text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="my-3 text-center text-xs text-ink/50">— or —</div>

      <div className="space-y-2">
        <button
          onClick={() => signIn("google", { callbackUrl })}
          className="w-full rounded-lg border border-line py-2 text-sm font-medium text-accent"
        >
          Continue with Google
        </button>
        <button
          onClick={() => signIn("microsoft-entra-id", { callbackUrl })}
          className="w-full rounded-lg border border-line py-2 text-sm font-medium text-accent"
        >
          Continue with Microsoft
        </button>
      </div>

      <p className="mt-4 text-center text-[0.65rem] text-ink/50">
        Accounts are invite-only. Spark never creates accounts or sets passwords
        on your behalf.
      </p>
    </div>
  );
}
