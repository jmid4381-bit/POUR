/**
 * lib/supabase.ts — single Supabase client for the guest ordering app.
 *
 * Import { supabase } from "@/lib/supabase" anywhere you need database access.
 * The client is a singleton — Next.js module caching ensures only one instance.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  );
}

export const supabase = createClient(url, key);
