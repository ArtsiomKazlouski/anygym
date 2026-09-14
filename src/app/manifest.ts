import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'anygym',
    short_name: 'anygym',
    description: 'Трекер тренировок для тех, кто ходит по разным залам',
    lang: 'ru',
    start_url: '/',
    // standalone — без адресной строки: в зале это лишний элемент,
    // по которому легко промахнуться.
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#0a0a0a',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
