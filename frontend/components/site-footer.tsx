"use client"

import { ArrowRight, Compass } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/reveal"

function scrollToInput() {
  const input = document.querySelector<HTMLInputElement>('[aria-label="GitHub repository URL"]')
  if (input) {
    input.closest('section')?.scrollIntoView({ behavior: "smooth" })
    setTimeout(() => input.focus(), 600)
  }
}

export function SiteFooter({ onOnboard }: { onOnboard?: (repo: string) => void }) {
  return (
    <footer className="relative">
      {/* final CTA */}
      <section className="border-b border-border py-20 sm:py-28">
        <Reveal className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Stop reading code line by line.{" "}
            <span className="text-primary">Start understanding it.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground">
            Onboard your first repository free. No setup, no config — paste a URL
            and explore in under a minute.
          </p>
          <div className="mt-8 flex justify-center">
            <Button
              size="lg"
              onClick={scrollToInput}
              className="group h-12 rounded-lg px-6 font-medium"
            >
              Onboard a Repository
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </Reveal>
      </section>

      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Compass className="size-4" />
          </span>
          <span className="text-sm font-semibold">CodeAtlas</span>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} CodeAtlas. Built for engineers who hate
          guessing.
        </p>
        <nav className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <a href="/demo" className="transition-colors hover:text-foreground">
            Demo
          </a>
          <a href="/pricing" className="transition-colors hover:text-foreground">
            Pricing
          </a>
          <a href="/docs" className="transition-colors hover:text-foreground">
            Docs
          </a>
          <a href="/blog" className="transition-colors hover:text-foreground">
            Blog
          </a>
          <a href="/about" className="transition-colors hover:text-foreground">
            About
          </a>
          <a href="/changelog" className="transition-colors hover:text-foreground">
            Changelog
          </a>
          <a href="/vs/deepwiki" className="transition-colors hover:text-foreground">
            vs DeepWiki
          </a>
          <a href="/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </a>
          <a href="/terms" className="transition-colors hover:text-foreground">
            Terms
          </a>
          <a
            href="https://github.com/Abhishk-Kumar/Repogent"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  )
}
