"use client"

import { Check, X, HelpCircle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { motion } from "motion/react"
import { Reveal } from "@/components/reveal"

const TIERS = [
  {
    name: "Free",
    description: "Free while in beta — generous limits for individuals and small teams",
    price: "$0",
    features: [
      { name: "Repository onboarding", included: true },
      { name: "Interactive dependency graph", included: true },
      { name: "AI chat (code questions)", included: true },
      { name: "Automated security scan", included: true },
      { name: "Scan report export (JSON/CSV/TXT/PDF)", included: true },
      { name: "Ticket queue → Jira / Linear", included: true },
      { name: "Slack sharing + notify-on-complete", included: true },
      { name: "MCP server access (agents)", included: true },
      { name: "Private repo support", included: false, note: "Coming soon" },
      { name: "Team workspaces & RBAC", included: false, note: "Coming soon" },
      { name: "SSO / SAML", included: false, note: "Coming soon" },
      { name: "Audit logs & compliance", included: false, note: "Coming soon" },
    ],
    cta: "Start free",
    variant: "outline" as const,
    popular: false,
  },
  {
    name: "Pro",
    description: "For power users who need private repos and higher limits",
    price: "Coming soon",
    features: [
      { name: "Repository onboarding", included: true },
      { name: "Interactive dependency graph", included: true },
      { name: "AI chat (code questions)", included: true },
      { name: "Automated security scan", included: true },
      { name: "Scan report export (JSON/CSV/TXT/PDF)", included: true },
      { name: "Ticket queue → Jira / Linear", included: true },
      { name: "Slack sharing + notify-on-complete", included: true },
      { name: "MCP server access (agents)", included: true },
      { name: "Private repo support", included: true },
      { name: "Team workspaces & RBAC", included: false, note: "Team plan" },
      { name: "SSO / SAML", included: false, note: "Team plan" },
      { name: "Audit logs & compliance", included: false, note: "Team plan" },
    ],
    cta: "Join waitlist",
    variant: "default" as const,
    popular: true,
  },
  {
    name: "Team",
    description: "For organizations needing SSO, audit logs, and compliance",
    price: "Coming soon",
    features: [
      { name: "Repository onboarding", included: true },
      { name: "Interactive dependency graph", included: true },
      { name: "AI chat (code questions)", included: true },
      { name: "Automated security scan", included: true },
      { name: "Scan report export (JSON/CSV/TXT/PDF)", included: true },
      { name: "Ticket queue → Jira / Linear", included: true },
      { name: "Slack sharing + notify-on-complete", included: true },
      { name: "MCP server access (agents)", included: true },
      { name: "Private repo support", included: true },
      { name: "Team workspaces & RBAC", included: true },
      { name: "SSO / SAML", included: true },
      { name: "Audit logs & compliance", included: true },
    ],
    cta: "Contact sales",
    variant: "outline" as const,
    popular: false,
  },
]

// One table CELL per tier (never a nested <tr>: a <tr> inside a <td> is
// invalid HTML — browsers reparse it, hydration mismatches, and production
// can crash with insertBefore/removeChild NotFoundError).
function TierCell({ feature }: { feature: { name: string; included: boolean; note?: string } }) {
  const Icon = feature.included ? Check : X
  return (
    <td className="py-3 text-center">
      <Icon className={`size-5 mx-auto ${feature.included ? "text-emerald-500" : "text-muted-foreground/50"}`} />
      {feature.note && (
        <span className="mt-1 block text-xs text-muted-foreground">{feature.note}</span>
      )}
    </td>
  )
}

function TierChecklist({ tier }: { tier: (typeof TIERS)[number] }) {
  return (
    <ul className="flex-1 space-y-2">
      {tier.features.map((f) => {
        const Icon = f.included ? Check : X
        return (
          <li key={f.name} className="flex items-start gap-2 text-[13px]">
            <Icon
              className={`mt-0.5 size-4 shrink-0 ${
                f.included ? "text-emerald-500" : "text-muted-foreground/40"
              }`}
            />
            <span className={f.included ? "text-foreground" : "text-muted-foreground/70"}>
              {f.name}
              {f.note && (
                <span className="ml-1.5 rounded-full border border-border bg-secondary/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {f.note}
                </span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function PricingTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[560px]">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="py-3 px-4 text-left text-sm font-medium text-foreground">Feature</th>
            {TIERS.map((tier) => (
              <th key={tier.name} className="py-3 px-4 text-center text-sm font-medium text-foreground">
                {tier.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIERS[0].features.map((_, i) => (
            <tr key={TIERS[0].features[i].name} className="border-t border-border/50">
              <td className="py-3 text-sm text-foreground">{TIERS[0].features[i].name}</td>
              {TIERS.map((tier) => (
                <TierCell key={tier.name} feature={tier.features[i]} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

import { ParticleBackground } from "@/components/codeatlas/particle-bg"

export function PricingContent() {
  return (
    <>
      <SiteHeader />
      <main className="relative min-h-screen">
        <ParticleBackground className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mx-auto max-w-3xl text-center"
          >
            <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              Simple, honest pricing
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Free while in beta. Pro and Team tiers are coming soon — no fake pricing,
              no hidden costs. Join the waitlist to be notified.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="mt-12 grid gap-6 sm:grid-cols-3"
          >
            {TIERS.map((tier, i) => (
              <motion.article
                key={tier.name}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.08, ease: "easeOut" }}
                className={`relative flex flex-col rounded-2xl border border-border bg-card/70 p-6 shadow-xl shadow-black/20 backdrop-blur ${tier.popular ? "ring-2 ring-primary/30" : ""}`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                    Most Popular
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="text-xl font-semibold">{tier.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{tier.description}</p>
                  <div className="mt-4 flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-semibold">{tier.price}</span>
                    {tier.price !== "Coming soon" && <span className="text-muted-foreground">/month</span>}
                  </div>
                </div>

                {tier.price === "Coming soon" ? (
                  <Button className="mb-6 w-full" size="lg" variant={tier.variant} asChild>
                    <a
                      href={`mailto:FILL-ME-CONTACT-EMAIL?subject=${encodeURIComponent(`CodeAtlas ${tier.name} early access`)}`}
                      title="Coming soon — email us for early access (address to be confirmed)"
                    >
                      {tier.cta} — coming soon
                    </a>
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      window.location.href = "/#top"
                    }}
                    className="mb-6 w-full"
                    size="lg"
                    variant={tier.variant}
                  >
                    {tier.cta}
                  </Button>
                )}

                <TierChecklist tier={tier} />
              </motion.article>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
            className="mt-12"
          >
            <h2 className="mb-4 text-center text-xl font-semibold">Compare all tiers</h2>
            <PricingTable />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
            className="mt-16 rounded-2xl border border-border bg-card/50 p-6 text-center"
          >
            <h3 className="text-lg font-semibold">Currently in beta — everything is free</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              All features (private repos, team workspaces, SSO, audit logs) will be gated
              by tier after beta. Early adopters get grandfathered pricing.
            </p>
            <Button
              onClick={() => window.location.href = "/#top"}
              className="mt-4"
              size="lg"
              variant="default"
            >
              Try CodeAtlas Free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
            className="mt-12 text-center"
          >
            <p className="text-sm text-muted-foreground">
              Questions? <a href="mailto:FILL-ME-CONTACT-EMAIL" className="text-primary underline">Contact us (address to be confirmed)</a>
            </p>
          </motion.div>
        </div>
        <SiteFooter onOnboard={() => window.location.href = "/#top"} />
      </main>
    </>
  )
}