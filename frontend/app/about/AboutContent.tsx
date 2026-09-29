"use client"

import { Mail, ArrowRight, Compass } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { motion } from "motion/react"
import { ParticleBackground } from "@/components/codeatlas/particle-bg"

export function AboutContent() {
  return (
    <>
      <SiteHeader />
      <main className="relative min-h-screen">
        <ParticleBackground className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />
        <div className="relative mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center mb-16"
          >
            <div className="mx-auto mb-6 inline-flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Compass className="size-7" />
            </div>
            <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              About CodeAtlas
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Built for engineers who hate guessing. We turn codebases into interactive maps
              so you can understand, secure, and ship faster.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="space-y-12"
          >
            <section>
              <h2 className="text-2xl font-semibold mb-4">Why we built this</h2>
              <div className="prose prose-invert max-w-none space-y-4">
                <p>
                  Every engineer knows the pain: joining a new team, inheriting a legacy codebase,
                  or debugging an unfamiliar service. You spend weeks reading code line by line,
                  drawing mental diagrams, asking colleagues "how does this work?" — and the answers
                  are often incomplete or outdated.
                </p>
                <p>
                  CodeAtlas was built to replace that guesswork with a deterministic, interactive
                  dependency graph. Point it at any repository and get:
                </p>
                <ul className="list-disc space-y-1.5 pl-5 marker:text-primary">
                  <li>A visual map of every file and its dependencies</li>
                  <li>An AI that answers questions grounded in the actual code structure</li>
                  <li>An automated security scan with actionable findings</li>
                  <li>Integrations to push tickets to Jira/Linear and share to Slack</li>
                  <li>An MCP server so your AI agents (Cursor, Claude Code, Copilot) can query the repo</li>
                </ul>
                <p>
                  No configuration. No setup. Paste a GitHub URL and explore in under a minute.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Our principles</h2>
              <div className="grid gap-6 sm:grid-cols-2">
                {[
                  {
                    title: "Honest over hype",
                    desc: "We show unresolved imports and unparsed files. No fake zeros. No hallucinated edges.",
                  },
                  {
                    title: "Static analysis first",
                    desc: "Tree-sitter gives deterministic answers. LLMs augment — they don't replace the graph.",
                  },
                  {
                    title: "Your code, your control",
                    desc: "Zero-retention mode deletes everything after your session. Tokens encrypted at rest. Never in localStorage.",
                  },
                  {
                    title: "Built for agents",
                    desc: "MCP server exposes graph, scan, and chat as tools — Cursor, Claude Code, Copilot can query your repo.",
                  },
                ].map((p, i) => (
                  <motion.div
                    key={p.title}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.15 + i * 0.05, ease: "easeOut" }}
                    className="rounded-xl border border-border bg-card/50 p-6"
                  >
                    <h3 className="font-semibold mb-2">{p.title}</h3>
                    <p className="text-sm text-muted-foreground">{p.desc}</p>
                  </motion.div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">The team</h2>
              <div className="prose prose-invert max-w-none space-y-4">
                <p>
                  CodeAtlas is built by a small team of engineers who've spent years onboarding
                  into complex codebases at startups and big tech. We got tired of the guesswork
                  and built the tool we wanted.
                </p>
                <p>
                  We're self-funded, engineer-led, and optimizing for developer experience — not
                  quarterly metrics. If that resonates, we'd love to hear from you.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Get in touch</h2>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="mailto:FILL-ME-CONTACT-EMAIL"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/50 px-4 py-3 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-card"
                >
                  <Mail className="size-4" />
                  FILL-ME-CONTACT-EMAIL
                </a>
                <div className="flex items-center gap-4">
                  <a
                    href="https://github.com/Abhishk-Kumar/Repogent"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="GitHub"
                  >
                    <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                    </svg>
                  </a>
                  <a
                    href="https://twitter.com/codeatlas"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Twitter"
                  >
                    <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 9.24-3.308.843-8.502-9.24L0 8.753l3.307-.843 8.502 9.24 8.502-9.24 3.308.843-7.227 8.26z"/>
                    </svg>
                  </a>
                  <a
                    href="https://linkedin.com/company/codeatlas"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="LinkedIn"
                  >
                    <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </a>
                </div>
              </div>
            </section>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
            className="mt-16 text-center"
          >
            <Button
              onClick={() => window.location.href = "/#top"}
              size="lg"
              className="group"
            >
              Try CodeAtlas Free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </motion.div>
        </div>
        <SiteFooter onOnboard={() => window.location.href = "/#top"} />
      </main>
    </>
  )
}