#!/usr/bin/env node
// generate-sitemap.js - Generates sitemap.xml for CodeAtlas

const fs = require('fs')
const path = require('path')

// Canonical domain comes from the environment so one build flag drives
// sitemap, robots, OG, and canonicals together. Defaults to the Render URL.
const siteUrl = (
  process.env.SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://repogent.onrender.com'
).replace(/\/$/, '')
const buildDir = path.join(__dirname, '../.next/server/app')
const publicDir = path.join(__dirname, '../public')

// Static routes from 07-NEW-PAGES.md
const staticRoutes = [
  { url: '/', changefreq: 'weekly', priority: 1.0 },
  { url: '/demo', changefreq: 'monthly', priority: 0.9 },
  { url: '/pricing', changefreq: 'monthly', priority: 0.8 },
  { url: '/docs', changefreq: 'weekly', priority: 0.9 },
  { url: '/blog', changefreq: 'weekly', priority: 0.8 },
  { url: '/changelog', changefreq: 'weekly', priority: 0.7 },
  { url: '/about', changefreq: 'monthly', priority: 0.6 },
  { url: '/privacy', changefreq: 'yearly', priority: 0.3 },
  { url: '/terms', changefreq: 'yearly', priority: 0.3 },
  { url: '/vs/deepwiki', changefreq: 'monthly', priority: 0.5 },
]

// Docs subpages
const docsRoutes = [
  'quickstart',
  'languages',
  'limits',
  'graph',
  'chat',
  'scan',
  'tickets',
  'slack',
  'mcp',
  'connect-agent',
  'api',
  'webhooks',
  'data-retention',
  'zero-retention',
  'faq',
].map((slug) => ({
  url: `/docs/${slug}`,
  changefreq: 'monthly',
  priority: 0.7,
}))

// Blog posts
const blogRoutes = [
  'dependency-graph-import-resolution',
  'codeatlas-vs-deepwiki',
  'changelog-ticket-system-slack',
  'how-codeatlas-works',
].map((slug) => ({
  url: `/blog/${slug}`,
  changefreq: 'monthly',
  priority: 0.6,
}))

const allRoutes = [...staticRoutes, ...docsRoutes, ...blogRoutes]

function generateSitemap() {
  const today = new Date().toISOString().split('T')[0]

  const urls = allRoutes
    .map((route) => {
      return `  <url>
    <loc>${siteUrl}${route.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`
    })
    .join('\n')

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`

  const outputPath = path.join(publicDir, 'sitemap.xml')
  fs.writeFileSync(outputPath, sitemap)
  console.log(`✅ Generated sitemap.xml with ${allRoutes.length} URLs at ${outputPath}`)

  const robots = `# robots.txt for CodeAtlas (generated — do not hand-edit)
User-agent: *
Allow: /

# Sitemap
Sitemap: ${siteUrl}/sitemap.xml

# Disallow workspace (thin auto-generated pages)
Disallow: /workspace
Disallow: /github/callback
Disallow: /_next/
Disallow: /api/
`
  fs.writeFileSync(path.join(publicDir, 'robots.txt'), robots)
  console.log(`✅ Generated robots.txt for ${siteUrl}`)
}

generateSitemap()