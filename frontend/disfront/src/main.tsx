import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark">
      <TooltipProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>
)
