/** Every environment variable the front end reads, in one place.
 *
 *  VITE_MAPBOX_TOKEN      public Mapbox token (pk.*). Basemap + Directions routing.
 *  VITE_API_URL           FastAPI base incl. /api/v1. Unset = demo mode (in-browser world + recorded QAOA runs).
 *  VITE_SUPABASE_URL      Supabase project URL (auth + realtime, once the backend lands).
 *  VITE_SUPABASE_ANON_KEY Supabase anon key.
 *  VITE_DEMO_LOGINS       "false" hides the persona switcher in a production build.
 */
const read = (k: string) => {
  const v = (import.meta.env as Record<string, string | undefined>)[k]
  return v && v.trim() ? v.trim() : undefined
}

export const env = {
  mapboxToken: read("VITE_MAPBOX_TOKEN"),
  apiUrl: read("VITE_API_URL")?.replace(/\/$/, ""),
  supabaseUrl: read("VITE_SUPABASE_URL"),
  supabaseAnonKey: read("VITE_SUPABASE_ANON_KEY"),
  demoLogins: read("VITE_DEMO_LOGINS") !== "false",
}

/** "demo": the whole event runs in the browser from recorded results. "api": the FastAPI backend. */
export const dataMode: "demo" | "api" = env.apiUrl ? "api" : "demo"
