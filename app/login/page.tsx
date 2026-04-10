"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient, hasSupabaseEnv } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
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

    setBusy(true);
    setStatus("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setBusy(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    if (data.session) {
      window.location.assign("/");
    }
  }

  async function handleForgotPassword() {
    if (!hasSupabaseEnv) {
      setStatus("Missing Supabase environment variables.");
      return;
    }
    const trimmed = email.trim();
    if (!trimmed) {
      setStatus("Enter your email above, then tap “Forgot password?” again.");
      return;
    }
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setStatus("Could not start Supabase client.");
      return;
    }

    setBusy(true);
    setStatus("");
    const origin = window.location.origin;
    const nextPath = "/auth/update-password";
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    });
    setBusy(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus(
      "If that email is registered, we sent a link to choose a new password. Check your inbox.",
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Use the email and password for your account. Only allowlisted editors
          can add meals; everyone can view stats on the home page.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSignIn}>
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
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Password</span>
          <input
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700"
            placeholder="••••••••"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !hasSupabaseEnv}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <button
        type="button"
        disabled={busy || !hasSupabaseEnv}
        onClick={handleForgotPassword}
        className="w-full text-center text-sm font-medium text-zinc-700 underline disabled:opacity-50 dark:text-zinc-300"
      >
        Forgot password?
      </button>

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
