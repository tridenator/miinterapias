// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL!;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

// 🔎 Exponer SOLO para debug:
// - En entorno de desarrollo (vite dev), o
// - En cualquier entorno si visitás con ?debug=1 en la URL
const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const debugFlag = !!search?.has('debug');

if ((import.meta.env.DEV || debugFlag) && typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}
