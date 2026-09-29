import { AboutContent } from "./AboutContent"

export const metadata = {
  title: 'About — The team and principles behind CodeAtlas',
  description:
    'Meet the team behind CodeAtlas. Built for engineers who hate guessing. Self-funded, engineer-led, optimizing for developer experience — not quarterly metrics.',
  openGraph: {
    title: 'About — The team and principles behind CodeAtlas',
    description:
      'Meet the team behind CodeAtlas. Built for engineers who hate guessing. Self-funded, engineer-led, optimizing for developer experience — not quarterly metrics.',
    images: ['/og-about.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About — The team and principles behind CodeAtlas',
    description:
      'Meet the team behind CodeAtlas. Built for engineers who hate guessing. Self-funded, engineer-led, optimizing for developer experience — not quarterly metrics.',
    images: ['/og-about.png'],
  },
}

export default function AboutPage() {
  return <AboutContent />
}