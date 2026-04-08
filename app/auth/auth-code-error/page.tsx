import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4 py-8">
      <h1 className="text-xl font-semibold">Sign in did not complete</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        The magic link may have expired, or the redirect URL is not allowed in
        Supabase. Check Authentication → URL Configuration, then try again.
      </p>
      <Link
        href="/login"
        className="text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
      >
        Back to sign in
      </Link>
    </main>
  );
}
