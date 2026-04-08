"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient, hasSupabaseEnv } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string>("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasSupabaseEnv) {
      setStatus("Missing Supabase environment variables.");
      return;
    }
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setStatus("Could not start Supabase client.");
      return;
    }

    setSending(true);
    setStatus("");

    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });

    setSending(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Check your email for the sign-in link.");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          We email you a magic link. Only allowlisted accounts can add meals;
          everyone can view stats on the home page.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Email</span>
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700"
            placeholder="you@example.com"
          />
        </label>
        <button
          type="submit"
          disabled={sending || !hasSupabaseEnv}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {sending ? "Sending link…" : "Send magic link"}
        </button>
      </form>

      {status ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{status}</p>
      ) : null}

      <Link
        href="/"
        className="text-center text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
      >
        Back to FoodStats
      </Link>
    </main>
  );
}
