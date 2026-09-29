import { ChangelogContent } from "./ChangelogContent"

export const metadata = {
  title: 'Changelog — All notable changes to CodeAtlas',
  description:
    'Complete changelog for CodeAtlas following Keep a Changelog format. Ticket system, Slack integration, security scan, AI chat, dependency graph, and more.',
  openGraph: {
    title: 'Changelog — All notable changes to CodeAtlas',
    description:
      'Complete changelog for CodeAtlas following Keep a Changelog format. Ticket system, Slack integration, security scan, AI chat, dependency graph, and more.',
    images: ['/og-changelog.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Changelog — All notable changes to CodeAtlas',
    description:
      'Complete changelog for CodeAtlas following Keep a Changelog format. Ticket system, Slack integration, security scan, AI chat, dependency graph, and more.',
    images: ['/og-changelog.png'],
  },
}

export default function ChangelogPage() {
  return <ChangelogContent />
}