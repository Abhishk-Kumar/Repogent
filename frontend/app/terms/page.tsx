import { TermsContent } from "./TermsContent"

export const metadata = {
  title: 'Terms of Service — CodeAtlas beta terms and conditions',
  description:
    'CodeAtlas Terms of Service: beta disclaimer, acceptable use, intellectual property, limitation of liability, indemnification, termination, governing law. Free during beta, no warranties.',
  openGraph: {
    title: 'Terms of Service — CodeAtlas beta terms and conditions',
    description:
      'CodeAtlas Terms of Service: beta disclaimer, acceptable use, intellectual property, limitation of liability, indemnification, termination, governing law. Free during beta, no warranties.',
    images: ['/og-terms.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms of Service — CodeAtlas beta terms and conditions',
    description:
      'CodeAtlas Terms of Service: beta disclaimer, acceptable use, intellectual property, limitation of liability, indemnification, termination, governing law. Free during beta, no warranties.',
    images: ['/og-terms.png'],
  },
}

export default function TermsPage() {
  return <TermsContent />
}