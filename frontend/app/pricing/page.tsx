import { PricingContent } from "./PricingContent"

export const metadata = {
  title: 'Pricing — Simple, honest pricing for developers',
  description:
    'Free while in beta with generous limits. Pro and Team tiers coming soon — no fake pricing, no hidden costs. Join the waitlist to be notified.',
  openGraph: {
    title: 'Pricing — Simple, honest pricing for developers',
    description:
      'Free while in beta with generous limits. Pro and Team tiers coming soon — no fake pricing, no hidden costs. Join the waitlist to be notified.',
    images: ['/og-pricing.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing — Simple, honest pricing for developers',
    description:
      'Free while in beta with generous limits. Pro and Team tiers coming soon — no fake pricing, no hidden costs. Join the waitlist to be notified.',
    images: ['/og-pricing.png'],
  },
}

export default function PricingPage() {
  return <PricingContent />
}