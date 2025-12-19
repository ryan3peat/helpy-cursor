import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      // Allow marketing pages
      allow: ['/home', '/features', '/plan', '/faq'],
      // Block the app (root path and other app routes)
      disallow: '/',
    },
    sitemap: 'https://www.helpyfam.com/sitemap.xml',
  }
}

