import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      // Allow marketing pages (root now serves home content directly)
      allow: ['/', '/home', '/features', '/plan', '/faq'],
      // Block app-specific routes (if any exist)
      disallow: ['/qr', '/api'],
    },
    sitemap: 'https://www.helpyfam.com/sitemap.xml',
  }
}

