"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient, hasSupabaseEnv } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) {
      setStatus("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setStatus("Use at least 6 characters.");
      return;
    }
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
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    window.location.assign("/");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Set new password</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          You opened a password reset link. Choose a new password, then you
          will be signed in.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">New password</span>
          <input
            required
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Confirm password</span>
          <input
            required
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !hasSupabaseEnv}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>

      {status ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{status}</p>
      ) : null}

      <Link
        href="/login"
        className="text-center text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
      >
        Back to sign in
      </Link>
    </main>
  );
}
