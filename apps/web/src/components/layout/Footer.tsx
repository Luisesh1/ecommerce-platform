"use client";
import Link from 'next/link';
import { Facebook, Instagram, Twitter, Youtube, Mail } from 'lucide-react';

const footerLinks = {
  Tienda: [
    { label: 'Todos los productos', href: '/productos' },
    { label: 'Novedades', href: '/productos?sort=newest' },
    { label: 'Ofertas', href: '/productos?oferta=true' },
    { label: 'Categorias', href: '/categorias' },
  ],
  Cuenta: [
    { label: 'Mi perfil', href: '/cuenta' },
    { label: 'Mis pedidos', href: '/cuenta/pedidos' },
    { label: 'Wishlist', href: '/wishlist' },
    { label: 'Direcciones', href: '/cuenta/direcciones' },
  ],
  Ayuda: [
    { label: 'Centro de ayuda', href: '/ayuda' },
    { label: 'Devoluciones', href: '/devoluciones' },
    { label: 'Envios', href: '/envios' },
    { label: 'Contacto', href: '/contacto' },
  ],
  Legal: [
    { label: 'Terminos y condiciones', href: '/terminos' },
    { label: 'Politica de privacidad', href: '/privacidad' },
    { label: 'Politica de cookies', href: '/cookies' },
  ],
};

const socialLinks = [
  { Icon: Facebook, href: '#', label: 'Facebook' },
  { Icon: Instagram, href: '#', label: 'Instagram' },
  { Icon: Twitter, href: '#', label: 'Twitter' },
  { Icon: Youtube, href: '#', label: 'YouTube' },
];

export function Footer() {
  return (
    <footer className="bg-neutral-900 text-neutral-300">
      {/* Newsletter */}
      <div className="border-b border-neutral-800">
        <div className="container-page py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-semibold text-white">Suscribete a nuestro newsletter</h3>
              <p className="text-sm text-neutral-400 mt-1">
                Recibe las ultimas novedades, ofertas y promociones.
              </p>
            </div>
            <form
              className="flex gap-2 w-full md:w-auto"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="relative flex-1 md:w-72">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  type="email"
                  placeholder="tu@email.com"
                  className="w-full rounded border border-neutral-700 bg-neutral-800 py-2 pl-10 pr-4 text-sm text-white placeholder:text-neutral-500 focus:border-brand-500 focus:outline-none"
                />
              </div>
              <button className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors">
                Suscribirse
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="container-page py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <h4 className="text-sm font-semibold text-white mb-4">{section}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-neutral-400 hover:text-white transition-colors no-underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-neutral-800">
        <div className="container-page flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">Ecommerce</span>
            <span className="text-neutral-500 text-sm">
              &copy; {new Date().getFullYear()} Todos los derechos reservados.
            </span>
          </div>
          <div className="flex items-center gap-4">
            {socialLinks.map(({ Icon, href, label }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
