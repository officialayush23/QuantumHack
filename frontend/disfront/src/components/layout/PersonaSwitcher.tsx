import { useNavigate } from "react-router-dom"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { env } from "@/config/env"

/** The same moment of the event from all three sides, one click apart.
 *  Demo only: hidden when VITE_DEMO_LOGINS=false, replaced by Supabase roles in production. */
export function PersonaSwitcher({ current }: { current: "citizen" | "field" | "admin" }) {
  const nav = useNavigate()
  if (!env.demoLogins) return null
  return (
    <ToggleGroup type="single" variant="outline" size="sm" value={current} onValueChange={(v) => v && nav(v === "admin" ? "/admin/console" : `/${v}`)} aria-label="Switch view">
      <ToggleGroupItem value="citizen">Citizen</ToggleGroupItem>
      <ToggleGroupItem value="field">Field crew</ToggleGroupItem>
      <ToggleGroupItem value="admin">Command</ToggleGroupItem>
    </ToggleGroup>
  )
}
