export default function manifest() {
  return {
    name: 'Mi Tienda',
    short_name: 'Tienda',
    description: 'Tu tienda online',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
  };
}
