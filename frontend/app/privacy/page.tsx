import { PrivacyContent } from "./PrivacyContent"

export const metadata = {
  title: 'Privacy Policy — How CodeAtlas handles your code and data',
  description:
    'CodeAtlas Privacy Policy: repository code deleted after analysis, analysis artifacts retained 7-30 days, zero-retention mode available, OAuth tokens encrypted at rest, no code stored by third-party AI providers.',
  openGraph: {
    title: 'Privacy Policy — How CodeAtlas handles your code and data',
    description:
      'CodeAtlas Privacy Policy: repository code deleted after analysis, analysis artifacts retained 7-30 days, zero-retention mode available, OAuth tokens encrypted at rest, no code stored by third-party AI providers.',
    images: ['/og-privacy.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacy Policy — How CodeAtlas handles your code and data',
    description:
      'CodeAtlas Privacy Policy: repository code deleted after analysis, analysis artifacts retained 7-30 days, zero-retention mode available, OAuth tokens encrypted at rest, no code stored by third-party AI providers.',
    images: ['/og-privacy.png'],
  },
}

export default function PrivacyPage() {
  return <PrivacyContent />
}