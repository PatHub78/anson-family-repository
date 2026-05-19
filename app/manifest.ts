import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Anson Family',
    short_name: 'Ansons',
    description: 'The Anson Family App',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f9fafb',
    theme_color: '#4f46e5',
    icons: [
      { src: '/apple-icon', sizes: '180x180', type: 'image/png', purpose: 'any' },
      { src: '/icon',       sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon',       sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
