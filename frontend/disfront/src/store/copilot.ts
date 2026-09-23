import { create } from "zustand"

import { answer, type Reply } from "@/lib/copilot"

export interface CopilotMsg extends Partial<Reply> {
  id: number
  role: "user" | "assistant"
  text: string
}

interface CopilotState {
  open: boolean
  busy: boolean
  msgs: CopilotMsg[]
  setOpen: (v: boolean) => void
  toggle: () => void
  ask: (q: string) => Promise<void>
  clear: () => void
}

let seq = 0

export const useCopilot = create<CopilotState>()((set, get) => ({
  open: false,
  busy: false,
  msgs: [],
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
  clear: () => set({ msgs: [] }),
  ask: async (q) => {
    const text = q.trim()
    if (!text || get().busy) return
    set((s) => ({ open: true, busy: true, msgs: [...s.msgs, { id: ++seq, role: "user", text }] }))
    // a short pause so the tool calls read as work being done, not a canned string
    await new Promise((r) => setTimeout(r, 450))
    let reply: Reply
    try {
      reply = await answer(text)
    } catch (e) {
      reply = { text: `That failed: ${e instanceof Error ? e.message : String(e)}`, tools: [] }
    }
    set((s) => ({ busy: false, msgs: [...s.msgs, { id: ++seq, role: "assistant", ...reply }] }))
  },
}))
