import { BlogIndexContent } from "./BlogContent"

export const metadata = {
  title: 'Blog — Engineering notes, product updates, and honest comparisons',
  description:
    'CodeAtlas blog: deep dives into dependency graph engineering, honest product comparisons, and release changelogs. No marketing fluff.',
  openGraph: {
    title: 'Blog — Engineering notes, product updates, and honest comparisons',
    description:
      'CodeAtlas blog: deep dives into dependency graph engineering, honest product comparisons, and release changelogs. No marketing fluff.',
    images: ['/og-blog.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blog — Engineering notes, product updates, and honest comparisons',
    description:
      'CodeAtlas blog: deep dives into dependency graph engineering, honest product comparisons, and release changelogs. No marketing fluff.',
    images: ['/og-blog.png'],
  },
}

export default function BlogPage() {
  return <BlogIndexContent />
}