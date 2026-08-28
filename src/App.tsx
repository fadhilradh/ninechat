import { BrowserRouter, Link, Route, Routes } from "react-router-dom"

import { SiteNav } from "@/components/site-nav"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SettingsProvider } from "@/hooks/use-settings"
import { AboutPage } from "@/pages/about"
import { AuthPage } from "@/pages/auth"
import { ChatPage } from "@/pages/chat"
import { LandingPage } from "@/pages/landing"
import { UpdatePrompt } from "@/components/update-prompt"

function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-mono text-5xl font-bold text-primary">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Nothing lives here</h1>
      <Button asChild>
        <Link to="/">Back to the start</Link>
      </Button>
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <TooltipProvider delayDuration={400}>
          <div className="flex h-full min-h-0 flex-col">
            <SiteNav />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route
                path="/chat"
                element={
                  <div className="min-h-0 flex-1">
                    <ChatPage />
                  </div>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>

          <Toaster position="top-center" richColors />
          <UpdatePrompt />
        </TooltipProvider>
      </SettingsProvider>
    </BrowserRouter>
  )
}
