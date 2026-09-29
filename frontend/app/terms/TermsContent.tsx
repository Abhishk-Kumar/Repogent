"use client"

import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { motion } from "motion/react"
import { ParticleBackground } from "@/components/codeatlas/particle-bg"

export function TermsContent() {
  const lastUpdated = "January 25, 2025"

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
            className="text-center mb-12"
          >
            <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              Terms of Service
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">Last updated: {lastUpdated}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="prose prose-invert max-w-none space-y-10"
          >
            <section>
              <h2>1. Agreement</h2>
              <p>
                By accessing or using CodeAtlas (the "Service") at codeatlas.app, you agree to
                these Terms of Service ("Terms"). If you do not agree, do not use the Service.
              </p>
            </section>

            <section>
              <h2>2. Description of Service</h2>
              <p>
                CodeAtlas analyzes GitHub repositories to generate an interactive dependency graph,
                provide AI-powered codebase chat, run automated security scans, and enable
                integrations (Jira, Linear, Slack, MCP). The Service is provided "as is" and
                "as available" during beta.
              </p>
            </section>

            <section>
              <h2>3. Eligibility</h2>
              <p>You must be at least 16 years old and capable of forming a binding contract. By using the Service, you represent and warrant that you meet these requirements.</p>
            </section>

            <section>
              <h2>4. Repository Access & Analysis</h2>
              <ul>
                <li>During beta, only public GitHub repositories are supported.</li>
                <li>You may only analyze repositories you own or have permission to access.</li>
                <li>Cloned repository content is deleted immediately after analysis. We do not store your source code.</li>
                <li>Analysis artifacts (graph, scan, chat) are retained per our <a href="/privacy" className="text-primary underline">Privacy Policy</a>.</li>
              </ul>
            </section>

            <section>
              <h2>5. Integrations (Jira, Slack, Linear, MCP)</h2>
              <ul>
                <li>OAuth tokens are encrypted at rest (AES-256-GCM) and never exposed client-side.</li>
                <li>Disconnecting an integration revokes tokens server-side immediately.</li>
                <li>You are responsible for the actions taken via integrations (e.g., tickets created, messages posted).</li>
                <li>We are not liable for third-party service changes, outages, or data loss.</li>
              </ul>
            </section>

            <section>
              <h2>6. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul>
                <li>Analyze repositories you don't have permission to access</li>
                <li>Attempt to reverse-engineer, decompile, or extract our proprietary models/algorithms</li>
                <li>Use the Service for illegal activities or to violate third-party rights</li>
                <li>Overload, disrupt, or degrade the Service (rate limits apply)</li>
                <li>Share or resell access to your account or API keys</li>
              </ul>
            </section>

            <section>
              <h2>7. Intellectual Property</h2>
              <ul>
                <li>CodeAtlas (software, brand, design) is owned by us and protected by IP laws.</li>
                <li>Your repository code remains yours. We claim no ownership over analyzed code.</li>
                <li>Scan reports, graphs, and chat outputs are yours to use, export, and share.</li>
                <li>Feedback you provide is free for us to use without obligation.</li>
              </ul>
            </section>

            <section>
              <h2>8. Beta Disclaimer</h2>
              <p>
                CodeAtlas is in beta. Features may change, break, or be removed without notice.
                We make no guarantees about uptime, accuracy, or completeness of analysis.
                The Service is provided without warranties of any kind, express or implied.
              </p>
            </section>

            <section>
              <h2>9. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, CodeAtlas and its team shall not be liable
                for any indirect, incidental, special, consequential, or punitive damages, including
                loss of data, profits, or business opportunities. Our total liability shall not
                exceed the amount you paid us (currently $0 during beta).
              </p>
            </section>

            <section>
              <h2>10. Indemnification</h2>
              <p>
                You agree to indemnify and hold CodeAtlas harmless from any claims, damages, or
                expenses arising from your use of the Service, violation of these Terms, or
                infringement of third-party rights.
              </p>
            </section>

            <section>
              <h2>11. Termination</h2>
              <p>
                We may suspend or terminate your access for Terms violations. You may stop using
                the Service at any time. Disconnecting integrations revokes tokens. Data deletion
                follows our <a href="/privacy" className="text-primary underline">Privacy Policy</a>.
              </p>
            </section>

            <section>
              <h2>12. Governing Law</h2>
              <p>These Terms are governed by the laws of the State of California, USA, without regard to conflict of laws principles.</p>
            </section>

            <section>
              <h2>13. Changes</h2>
              <p>We may update these Terms. Continued use after changes constitutes acceptance. Material changes announced via changelog/email.</p>
            </section>

            <section>
              <h2>14. Contact</h2>
              <p>Questions? Email <a href="mailto:FILL-ME-CONTACT-EMAIL" className="text-primary underline">FILL-ME-CONTACT-EMAIL</a>.</p>
            </section>
          </motion.div>
        </div>
        <SiteFooter onOnboard={() => window.location.href = "/#top"} />
      </main>
    </>
  )
}