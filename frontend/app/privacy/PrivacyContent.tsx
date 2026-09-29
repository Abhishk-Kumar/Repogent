"use client"

import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { motion } from "motion/react"
import { ParticleBackground } from "@/components/codeatlas/particle-bg"

export function PrivacyContent() {
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
              Privacy Policy
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
              <h2>1. What this policy covers</h2>
              <p>
                This Privacy Policy explains how CodeAtlas ("we", "us", "our") collects, uses,
                and protects information when you use our service at codeatlas.app and related
                endpoints. By using CodeAtlas, you agree to this policy.
              </p>
            </section>

            <section>
              <h2>2. Information we collect</h2>
              <h3>2.1 Repository data (temporary)</h3>
              <p>
                When you onboard a repository, we clone it to our analysis servers. The cloned
                source code is <strong>deleted immediately after analysis completes</strong>. We
                never store your source code persistently.
              </p>
              <h3>2.2 Analysis artifacts</h3>
              <p>We store derived artifacts for the duration of your session:</p>
              <ul>
                <li>Dependency graph (nodes, edges, tech stack)</li>
                <li>Security scan report (findings, metrics, health score)</li>
                <li>Chat history (questions and answers)</li>
                <li>Tickets created (title, description, severity, Jira/Linear links)</li>
              </ul>
              <p>
                Retention defaults: graph 7 days after last access, scan/chat 30 days, tickets
                until manually deleted. See <a href="/docs/data-retention" className="text-primary underline">Data Retention</a> for details.
              </p>
              <h3>2.3 Authentication tokens (encrypted)</h3>
              <p>
                If you connect Jira or Slack, we store OAuth tokens encrypted at rest using
                AES-256-GCM with a per-deployment key. Tokens are <strong>never</strong> written
                to localStorage, logs, or client-side storage. Disconnecting revokes tokens
                server-side immediately.
              </p>
              <h3>2.4 Usage analytics (aggregated, anonymous)</h3>
              <p>
                We collect anonymous usage metrics: repos analyzed per day, feature adoption
                (graph/chat/scan/tickets/slack), error rates, latency percentiles. No repository
                URLs, user identifiers, or code content are included. Web analytics run via
                Plausible (cookieless, no cross-site tracking, no cookie banner needed).
              </p>
            </section>

            <section>
              <h2>3. How we use your information</h2>
              <ul>
                <li>Provide the CodeAtlas service (analysis, graph, chat, scan, integrations)</li>
                <li>Improve detection accuracy and performance</li>
                <li>Security monitoring and abuse prevention</li>
                <li>Comply with legal obligations</li>
              </ul>
              <p>
                We do <strong>not</strong> sell your data, use it for advertising, or train
                models on your private code.
              </p>
            </section>

            <section>
              <h2>4. Zero-Retention Mode</h2>
              <p>
                Enable in workspace settings to delete all analysis artifacts immediately when
                you close the workspace. This means:
              </p>
              <ul>
                <li>Cloned repo deleted after graph construction</li>
                <li>Graph, scan report, chat history deleted on session end</li>
                <li>No analytics linking back to your repo</li>
              </ul>
              <p>Trade-off: you'll re-analyze on each visit. Recommended for sensitive codebases.</p>
            </section>

            <section>
              <h2>5. Third-party processors</h2>
              <p>We use subprocessors for specific functions:</p>
              <ul>
                <li><strong>LLM providers (OpenAI, Anthropic):</strong> AI chat and scan analysis. Code snippets sent for context; providers do not store or train on them.</li>
                <li><strong>Hosting (Vercel, Fly.io):</strong> Infrastructure. No access to decrypted tokens.</li>
                <li><strong>GitHub API:</strong> Repository metadata and cloning (public repos only during beta).</li>
              </ul>
              <p>All subprocessors sign DPAs and are GDPR/CCPA compliant.</p>
            </section>

            <section>
              <h2>6. Your rights</h2>
              <p>You can:</p>
              <ul>
                <li>Request deletion of all your data (email FILL-ME-CONTACT-EMAIL)</li>
                <li>Disconnect Jira/Slack at any time (revokes tokens immediately)</li>
                <li>Enable zero-retention mode for future sessions</li>
                <li>Export your scan reports and tickets</li>
              </ul>
            </section>

            <section>
              <h2>7. Security</h2>
              <ul>
                <li>Encryption at rest: AES-256-GCM for tokens and sensitive fields</li>
                <li>Encryption in transit: TLS 1.3 everywhere</li>
                <li>No secrets in logs, localStorage, or client bundles</li>
                <li>Regular dependency updates and vulnerability scanning</li>
              </ul>
            </section>

            <section>
              <h2>8. Children's privacy</h2>
              <p>CodeAtlas is not directed to children under 16. We do not knowingly collect personal information from children.</p>
            </section>

            <section>
              <h2>9. Changes to this policy</h2>
              <p>We'll post updates here with a new "Last updated" date. Material changes will be announced via the changelog and/or email.</p>
            </section>

            <section>
              <h2>10. Contact</h2>
              <p>Questions? Email <a href="mailto:FILL-ME-CONTACT-EMAIL" className="text-primary underline">FILL-ME-CONTACT-EMAIL</a>.</p>
            </section>
          </motion.div>
        </div>
        <SiteFooter onOnboard={() => window.location.href = "/#top"} />
      </main>
    </>
  )
}