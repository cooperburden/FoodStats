"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  createBrowserSupabaseClient,
  hasSupabaseEnv,
} from "@/lib/supabase/client";

type Person = "cooper" | "tia";
type AudienceFilter = "both" | Person;
type AteSelection = "cooper" | "tia" | "both";

type Entry = {
  id: string;
  restaurant: string;
  locationName: string;
  orderedItems: string[];
  date: string;
  ateBy: AteSelection;
};

const STORAGE_KEY = "foodstats_entries_v1";

const peopleLabel: Record<AudienceFilter, string> = {
  both: "Both",
  cooper: "Cooper",
  tia: "Tia",
};

function eatsForFilter(entry: Entry, filter: AudienceFilter): boolean {
  if (filter === "both") {
    return true;
  }
  return entry.ateBy === "both" || entry.ateBy === filter;
}

function normalizeEntry(row: {
  id: string;
  restaurant: string;
  location_name: string;
  ordered_items: string[];
  eaten_at: string;
  ate_by: AteSelection;
}): Entry {
  return {
    id: row.id,
    restaurant: row.restaurant,
    locationName: row.location_name,
    orderedItems: row.ordered_items,
    date: row.eaten_at,
    ateBy: row.ate_by,
  };
}

export default function Home() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      return;
    }
    const id = requestAnimationFrame(() => {
      setSupabase(createBrowserSupabaseClient());
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const [entries, setEntries] = useState<Entry[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return [];
    }
    try {
      return JSON.parse(saved) as Entry[];
    } catch {
      return [];
    }
  });
  const [activeView, setActiveView] = useState<"log" | "stats">("log");
  const [statsFilter, setStatsFilter] = useState<AudienceFilter>("both");
  const [restaurant, setRestaurant] = useState("");
  const [locationName, setLocationName] = useState("");
  const [orderedItems, setOrderedItems] = useState("");
  const [ateBy, setAteBy] = useState<AteSelection>("both");
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [user, setUser] = useState<User | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [editorCheckError, setEditorCheckError] = useState<string>("");
  const [authReady, setAuthReady] = useState(() => !hasSupabaseEnv);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client = supabase;
    let cancelled = false;

    async function loadEntriesFromCloud() {
      const { data, error } = await client
        .from("meal_entries")
        .select("id, restaurant, location_name, ordered_items, eaten_at, ate_by")
        .order("eaten_at", { ascending: false });

      if (cancelled) {
        return;
      }

      if (error) {
        setStatus(
          `Could not load meals: ${error.message}. If tables are new, run supabase/schema.sql.`,
        );
        return;
      }

      const normalized = (data ?? []).map((row) => normalizeEntry(row));
      setEntries(normalized);
      setStatus("");
    }

    async function refreshEditorFlag(sessionUser: User | null) {
      if (!sessionUser) {
        setCanEdit(false);
        setEditorCheckError("");
        return;
      }
      const { data, error } = await client.rpc("is_editor");
      if (cancelled) {
        return;
      }
      if (error) {
        setCanEdit(false);
        setEditorCheckError(
          `Editor check failed: ${error.message}. Run supabase/fix_editor_access.sql in Supabase.`,
        );
        return;
      }
      setEditorCheckError("");
      setCanEdit(Boolean(data));
    }

    async function init() {
      let nextUser: User | null = null;
      try {
        const { data: userData, error: userError } =
          await client.auth.getUser();
        if (cancelled) {
          return;
        }
        nextUser = userData.user;
        if (userError || !nextUser) {
          const {
            data: { session },
          } = await client.auth.getSession();
          if (cancelled) {
            return;
          }
          nextUser = session?.user ?? null;
        }
        if (!cancelled) {
          setUser(nextUser);
          setAuthReady(true);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setAuthReady(true);
        }
      }

      if (cancelled) {
        return;
      }

      void refreshEditorFlag(nextUser).catch(() => {
        setCanEdit(false);
      });
      void loadEntriesFromCloud().catch(() => {
        /* status set inside */
      });
    }

    init();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      await refreshEditorFlag(session?.user ?? null);
      await loadEntriesFromCloud();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!hasSupabaseEnv || !supabase || authReady) {
      return;
    }
    const id = window.setTimeout(() => {
      setAuthReady(true);
    }, 12000);
    return () => window.clearTimeout(id);
  }, [supabase, authReady]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  const filteredEntries = useMemo(
    () => entries.filter((entry) => eatsForFilter(entry, statsFilter)),
    [entries, statsFilter],
  );

  const topRestaurants = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of filteredEntries) {
      counts.set(entry.restaurant, (counts.get(entry.restaurant) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [filteredEntries]);

  const topLocations = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of filteredEntries) {
      counts.set(entry.locationName, (counts.get(entry.locationName) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [filteredEntries]);

  const canSaveToCloud = Boolean(supabase && user && canEdit);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setStatus("");

    const parsedItems = orderedItems
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const nextEntry: Entry = {
      id: crypto.randomUUID(),
      restaurant: restaurant.trim(),
      locationName: locationName.trim(),
      orderedItems: parsedItems,
      date: new Date().toISOString(),
      ateBy,
    };

    if (supabase && canSaveToCloud) {
      const { data, error } = await supabase
        .from("meal_entries")
        .insert({
          restaurant: nextEntry.restaurant,
          location_name: nextEntry.locationName,
          ordered_items: nextEntry.orderedItems,
          eaten_at: nextEntry.date,
          ate_by: nextEntry.ateBy,
        })
        .select("id, restaurant, location_name, ordered_items, eaten_at, ate_by")
        .single();

      if (error) {
        setStatus(`Supabase: ${error.message}. Saved on this device only.`);
        setEntries((prev) => [nextEntry, ...prev]);
      } else if (data) {
        setEntries((prev) => [normalizeEntry(data), ...prev]);
      }
    } else if (supabase && !user) {
      setStatus("Sign in to save meals to your shared database (link below).");
      setEntries((prev) => [nextEntry, ...prev]);
    } else if (supabase && user && !canEdit) {
      setStatus(
        "Your account is signed in but is not on the editor list. Ask Cooper to add your email in Supabase (editor_allowlist). Saved locally only.",
      );
      setEntries((prev) => [nextEntry, ...prev]);
    } else {
      setEntries((prev) => [nextEntry, ...prev]);
    }

    setRestaurant("");
    setLocationName("");
    setOrderedItems("");
    setAteBy("both");
    setIsSaving(false);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">FoodStats</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Track where you eat, what you order, and compare stats for Cooper and
          Tia.
        </p>
        <div className="space-y-2">
          <p className="text-xs text-zinc-500">
            {hasSupabaseEnv ? (
              <span>Cloud sync enabled.</span>
            ) : (
              <span>Local-only mode. Add Supabase env vars for shared data.</span>
            )}
          </p>
          {hasSupabaseEnv ? (
            !authReady ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Checking sign-in…
              </p>
            ) : user ? (
              <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700 dark:bg-zinc-900/50">
                <span className="min-w-0 break-all font-medium text-zinc-900 dark:text-zinc-100">
                  {user.email}
                  <span className="ml-2 block font-normal text-zinc-600 sm:inline dark:text-zinc-400">
                    {canEdit ? "(editor)" : "(view only)"}
                  </span>
                </span>
                <a
                  href="/auth/signout"
                  className="inline-flex shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-center text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                >
                  Sign out
                </a>
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-block text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
              >
                Sign in to add meals
              </Link>
            )
          ) : null}
        </div>
        {editorCheckError ? (
          <p className="text-xs text-red-600 dark:text-red-400">{editorCheckError}</p>
        ) : null}
        {status ? <p className="text-xs text-amber-600">{status}</p> : null}
      </header>

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-200 p-2 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setActiveView("log")}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            activeView === "log"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-transparent text-zinc-700 dark:text-zinc-200"
          }`}
        >
          Add Entry
        </button>
        <button
          type="button"
          onClick={() => setActiveView("stats")}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            activeView === "stats"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-transparent text-zinc-700 dark:text-zinc-200"
          }`}
        >
          Stats
        </button>
      </div>

      {activeView === "log" ? (
        <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-4 text-xl font-semibold">New Entry</h2>
          {hasSupabaseEnv && authReady && !canSaveToCloud ? (
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">
              {!user
                ? "Visitors can browse stats. Sign in with an allowlisted email to save meals to the cloud."
                : "You are signed in, but your email is not in editor_allowlist yet. Meals you save will stay on this device only until an admin adds your email in Supabase."}
            </p>
          ) : null}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Restaurant</span>
              <input
                required
                value={restaurant}
                onChange={(e) => setRestaurant(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none ring-zinc-400 placeholder:text-zinc-400 focus:ring-2 dark:border-zinc-700"
                placeholder="e.g. Chipotle"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Location</span>
              <input
                required
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none ring-zinc-400 placeholder:text-zinc-400 focus:ring-2 dark:border-zinc-700"
                placeholder="e.g. 123 Main St, Tampa"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Who ate here?</span>
              <select
                value={ateBy}
                onChange={(e) => setAteBy(e.target.value as AteSelection)}
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700"
              >
                <option value="cooper">Me (Cooper)</option>
                <option value="tia">Tia</option>
                <option value="both">Both</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                What did you order?
              </span>
              <input
                required
                value={orderedItems}
                onChange={(e) => setOrderedItems(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none ring-zinc-400 placeholder:text-zinc-400 focus:ring-2 dark:border-zinc-700"
                placeholder="Burrito bowl, chips, lemonade"
              />
              <span className="mt-1 block text-xs text-zinc-500">
                Separate multiple items with commas.
              </span>
            </label>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {isSaving ? "Saving..." : "Save Meal"}
            </button>
          </form>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="mb-4 text-xl font-semibold">Stats</h2>
            <div className="mb-4 flex flex-wrap gap-2">
              {(["both", "cooper", "tia"] as AudienceFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatsFilter(filter)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    statsFilter === filter
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
                  }`}
                >
                  {peopleLabel[filter]}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900">
                <p className="text-xs uppercase text-zinc-500">Meals Logged</p>
                <p className="text-2xl font-bold">{filteredEntries.length}</p>
              </div>
              <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900">
                <p className="text-xs uppercase text-zinc-500">Restaurants</p>
                <p className="text-2xl font-bold">{topRestaurants.length}</p>
              </div>
              <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900">
                <p className="text-xs uppercase text-zinc-500">Locations</p>
                <p className="text-2xl font-bold">{topLocations.length}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="mb-2 text-lg font-semibold">Top Restaurants</h3>
            {topRestaurants.length === 0 ? (
              <p className="text-sm text-zinc-500">No entries yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {topRestaurants.map(([name, count]) => (
                  <li
                    key={name}
                    className="flex items-center justify-between rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-900"
                  >
                    <span>{name}</span>
                    <strong>{count}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="mb-2 text-lg font-semibold">Top Locations</h3>
            {topLocations.length === 0 ? (
              <p className="text-sm text-zinc-500">No entries yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {topLocations.map(([name, count]) => (
                  <li
                    key={name}
                    className="flex items-center justify-between rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-900"
                  >
                    <span>{name}</span>
                    <strong>{count}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="mb-2 text-lg font-semibold">Recent Entries</h3>
            {filteredEntries.length === 0 ? (
              <p className="text-sm text-zinc-500">No entries yet.</p>
            ) : (
              <ul className="space-y-3">
                {filteredEntries.slice(0, 10).map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
                  >
                    <p className="font-semibold">{entry.restaurant}</p>
                    <p className="text-zinc-600 dark:text-zinc-300">
                      {entry.locationName}
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-300">
                      {entry.orderedItems.join(", ")}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Eaten by: {peopleLabel[entry.ateBy]} |{" "}
                      {new Date(entry.date).toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
