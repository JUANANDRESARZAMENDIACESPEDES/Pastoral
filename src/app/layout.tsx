import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Fraunces, Manrope, Libre_Baskerville } from "next/font/google";
import FaviconSync from "../components/FaviconSync";
import ThemeLoader from "../components/ThemeLoader";
import "./globals.css";
import "./responsive-fix.css";

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "600", "700"],
});

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600", "700"],
});

const accentFont = Libre_Baskerville({
  subsets: ["latin"],
  variable: "--font-accent",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Pastoral Juvenil Luqueña | PJL",
  description: "Sitio oficial de la Pastoral Juvenil Luqueña. Comunidad, fe y misión para la juventud de Luque.",
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/pjl-logo.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${displayFont.variable} ${bodyFont.variable} ${accentFont.variable}`} suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
        {/* Critical CSS anti-destello, en DOS fases:
            1) La navbar nace oculta y SOLO su animación la revela.
            2) Mientras el splash corre SIN clase pjl-reveal, TODO el
               contenido queda oculto: primero se ve la intro completa.
            3) page.tsx añade pjl-reveal a mitad de la salida del splash:
               el contenido aparece con su PROPIO fundido suave cruzándose
               con el resto del fundido del splash.
               La regla con :has() auto-expira al eliminarse el nodo del
               splash (red de seguridad si la clase quedara huérfana).
            4) Con movimiento reducido no hay intro ni velo. */}
        <style
          dangerouslySetInnerHTML={{
            __html: [
              '.top-nav .brand-logo-wrap,.top-nav .brand-text,.top-nav .nav-links .nav-item{opacity:0}',
              'html.show-splash:not(.pjl-reveal) body>*:not(#splash-pjl):not(script):not(style):not(noscript){visibility:hidden!important}',
              'html.pjl-reveal body>*:not(#splash-pjl):not(script):not(style):not(noscript){visibility:visible!important;animation:pjlPageIn .55s ease-out both}',
              '@keyframes pjlPageIn{from{opacity:0}to{opacity:1}}',
              'html.show-splash body:not(:has(> #splash-pjl))>*{visibility:visible!important}',
              '@media (prefers-reduced-motion:reduce){#splash-pjl{display:none!important}html.show-splash body>*:not(#splash-pjl){visibility:visible!important}}',
              '@media (prefers-reduced-motion:reduce){.top-nav .brand-logo-wrap,.top-nav .brand-text,.top-nav .nav-links .nav-item{opacity:1 !important}}',
            ].join(''),
          }}
        />
      </head>
      <body suppressHydrationWarning>
        {/* Marca <html> ANTES de pintar el splash: solo en la home ('/').
            El velo de contenido se gestiona junto con la intro; otras rutas
            no deben depender de ella. */}
        <script dangerouslySetInnerHTML={{ __html: "if(location.pathname==='/'){document.documentElement.className+=' show-splash';}" }} />
        {/* Pantalla de carga estática: vive FUERA del árbol que React intercambia,
            por eso se ve desde el primer pintado y sobrevive a la hidratación. */}
        <div id="splash-pjl" className="splash-screen" role="status" aria-label="Cargando Pastoral Juvenil Luqueña">
          <div className="splash-bg" aria-hidden="true">
            <span className="splash-orb splash-orb-1"></span>
            <span className="splash-orb splash-orb-2"></span>
            <span className="splash-orb splash-orb-3"></span>
            {Array.from({ length: 14 }).map((_, i) => (
              <span key={i} className="splash-ember" style={{ left: `${(i * 7.3 + 4) % 96}%`, animationDelay: `${(i * 0.37) % 3.2}s`, animationDuration: `${3.4 + (i % 5) * 0.55}s` }} />
            ))}
            {/* Siluetas line-art ESTÁTICAS dibujadas por código: se animan
                solas por CSS cuando splash-pjl recibe la clase art-on
                (línea: pathLength=1 + dashoffset · punto dorado: offset-path).
                Izquierda: cruz. Derecha: emblema del Vaticano
                (tiara papal + llaves cruzadas). Sin JS de por medio. */}
            <svg className="splash-sketch sk-a" viewBox="0 0 100 125" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id="pjlGoldA" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f5dfae" />
                  <stop offset="100%" stopColor="#c8973a" />
                </linearGradient>
              </defs>
              {/* contorno de la cruz latina */}
              <path className="sk-p sk-fill"
                    style={{ '--d': '3s', '--dl': '0.15s' } as React.CSSProperties}
                    d="M43 14 H57 V36 H78 V50 H57 V112 H43 V50 H22 V36 H43 Z" />
              {/* punto dorado que recorre el contorno */}
              <circle className="sk-dot" r="1.6"
                      style={{ '--d': '3s', '--dl': '0.15s', offsetPath: 'path("M43 14 H57 V36 H78 V50 H57 V112 H43 V50 H22 V36 H43 Z")' } as React.CSSProperties} />
            </svg>
              <svg className="splash-sketch sk-b" viewBox="0 0 100 125" aria-hidden="true" focusable="false">
                <defs>
                  <linearGradient id="pjlGoldB" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f5dfae" />
                    <stop offset="100%" stopColor="#c8973a" />
                  </linearGradient>
                </defs>
                {/* TIARA PAPAL */}
                {/* cruz sobre la corona */}
                <path className="sk-p"
                      style={{ '--d': '0.6s', '--dl': '0.15s' } as React.CSSProperties}
                      d="M50 3.5 V10 M46.8 5.8 H53.2" />
                {/* orbe bajo la cruz */}
                <path className="sk-p sk-fill"
                      style={{ '--d': '0.5s', '--dl': '0.35s' } as React.CSSProperties}
                      d="M52.2 12.5 A2.2 2.2 0 1 1 51.99 12.5 Z" />
                {/* contorno cerrado de la corona triple con tres bombos */}
                <path className="sk-p sk-fill"
                      style={{ '--d': '1.7s', '--dl': '0.55s' } as React.CSSProperties}
                      d="M37 45.5 C34.8 41.5 36.2 38.6 37.6 35.8 C35.4 32.4 36.6 29 38.2 26.2 C36.2 22.4 37.6 17.6 41 15 C43.6 13 46.6 11.8 50 11.8 C53.4 11.8 56.4 13 59 15 C62.4 17.6 63.8 22.4 61.8 26.2 C63.4 29 64.6 32.4 62.4 35.8 C63.8 38.6 65.2 41.5 63 45.5 Q50 50.5 37 45.5 Z" />
                {/* separador de pisos medio */}
                <path className="sk-p"
                      style={{ '--d': '0.75s', '--dl': '1.05s' } as React.CSSProperties}
                      d="M37.9 33.2 C43 30 57 30 62.1 33.2" />
                {/* separador de pisos alto */}
                <path className="sk-p"
                      style={{ '--d': '0.7s', '--dl': '1.3s' } as React.CSSProperties}
                      d="M39.6 24.6 C44 21.8 56 21.8 60.4 24.6" />
                {/* fajin izquierdo (cinta cerrada) */}
                <path className="sk-p sk-fill"
                      style={{ '--d': '0.9s', '--dl': '1.6s' } as React.CSSProperties}
                      d="M38.2 47.2 C36.4 53.4 35 58.6 33.8 63.4 C35.8 62.6 37.8 62 39.4 61.7 C40.4 56.4 41.2 51.6 42 47.9 Q40 48 38.2 47.2 Z" />
                {/* fajin derecho (cinta cerrada) */}
                <path className="sk-p sk-fill"
                      style={{ '--d': '0.9s', '--dl': '1.7s' } as React.CSSProperties}
                      d="M61.8 47.2 C63.6 53.4 65 58.6 66.2 63.4 C64.2 62.6 62.2 62 60.6 61.7 C59.6 56.4 58.8 51.6 58 47.9 Q60 48 61.8 47.2 Z" />
                {/* LLAVES CRUZADAS EN ASPA CON ARCOS DOBLES */}
                {/* llave dorada: arco exterior */}
                <path className="sk-p sk-fill"
                      style={{ '--d': '1.1s', '--dl': '2s' } as React.CSSProperties}
                      d="M37 54 A10 10 0 1 1 36.99 54 Z" />
                {/* llave dorada: arco interior */}
                <path className="sk-p sk-fill"
                      style={{ '--d': '0.7s', '--dl': '2.25s' } as React.CSSProperties}
                      d="M31.5 54 A4.5 4.5 0 1 1 31.49 54 Z" />
                {/* mango dorado que cruza hacia abajo-derecha */}
                <path className="sk-p"
                      style={{ '--d': '1.1s', '--dl': '2.5s' } as React.CSSProperties}
                      d="M33.7 61.5 L69 101" />
                {/* placa de dientes dorada */}
                <path className="sk-p sk-fill"
                      style={{ '--d': '0.7s', '--dl': '3.1s' } as React.CSSProperties}
                      d="M59.8 101.2 L63.6 105.8 L74.4 96.2 L72.2 91.9 Z" />
                {/* llave plateada: arco exterior */}
                <path className="sk-p sk-fill"
                      style={{ '--d': '1.1s', '--dl': '2.15s' } as React.CSSProperties}
                      d="M83 54 A10 10 0 1 1 82.99 54 Z" />
                {/* llave plateada: arco interior */}
                <path className="sk-p sk-fill"
                      style={{ '--d': '0.7s', '--dl': '2.4s' } as React.CSSProperties}
                      d="M73 54 A4.5 4.5 0 1 1 72.99 54 Z" />
                {/* mango plateado que cruza hacia abajo-izquierda */}
                <path className="sk-p"
                      style={{ '--d': '1.1s', '--dl': '2.65s' } as React.CSSProperties}
                      d="M66.3 61.5 L31 101" />
                {/* placa de dientes plateada */}
                <path className="sk-p sk-fill"
                      style={{ '--d': '0.7s', '--dl': '3.25s' } as React.CSSProperties}
                      d="M70.2 101.2 L66.4 105.8 L25.6 96.2 L27.8 91.9 Z" />
                {/* puntos dorados en los trazos principales */}
                <circle className="sk-dot" r="1.6"
                        style={{ '--d': '1.7s', '--dl': '0.55s', offsetPath: 'path("M37 45.5 C34.8 41.5 36.2 38.6 37.6 35.8 C35.4 32.4 36.6 29 38.2 26.2 C36.2 22.4 37.6 17.6 41 15 C43.6 13 46.6 11.8 50 11.8 C53.4 11.8 56.4 13 59 15 C62.4 17.6 63.8 22.4 61.8 26.2 C63.4 29 64.6 32.4 62.4 35.8 C63.8 38.6 65.2 41.5 63 45.5 Q50 50.5 37 45.5 Z")' } as React.CSSProperties} />
                <circle className="sk-dot" r="1.6"
                        style={{ '--d': '1.1s', '--dl': '2s', offsetPath: 'path("M37 54 A10 10 0 1 1 36.99 54 Z")' } as React.CSSProperties} />
                <circle className="sk-dot" r="1.6"
                        style={{ '--d': '1.1s', '--dl': '2.15s', offsetPath: 'path("M83 54 A10 10 0 1 1 82.99 54 Z")' } as React.CSSProperties} />
              </svg>
          </div>
          <div className="splash-content">
            <div className="splash-logo-wrap">
              <span className="splash-ring" aria-hidden="true"></span>
              <span className="splash-halo" aria-hidden="true"></span>
              <span className="splash-logo-fallback">⛪</span>
            </div>
            <h1 className="splash-title" aria-label="Pastoral Juvenil Luqueña">
              {['PASTORAL', 'JUVENIL', 'LUQUEÑA'].map((word, w) => (
                <span key={word} className="splash-word" aria-hidden="true">
                  {word.split('').map((ch, i) => (
                    <span key={i} className="splash-letter" style={{ animationDelay: `${0.75 + ([0, 8, 15][w] + i) * 0.045}s` }}>{ch}</span>
                  ))}
                </span>
              ))}
            </h1>
            <p className="splash-tagline">
              <span className="splash-flame" aria-hidden="true">🔥</span>
              <em>«Avivando la llama de Cristo en tu corazón»</em>
            </p>
            <div className="splash-loader">
              <div className="splash-bar"><span className="splash-bar-fill"></span><span className="splash-bar-shine"></span></div>
              <p className="splash-loading-text">Cargando<span className="splash-dots"><i>.</i><i>.</i><i>.</i></span></p>
            </div>
          </div>
        </div>
        <noscript><style>{"#splash-pjl{display:none!important}"}</style></noscript>
        <FaviconSync />
        <ThemeLoader />
        {children}
        <Script
          src="https://www.vaticannews.va/etc/designs/vaticannews/widget/widget.js"
          strategy="afterInteractive"
          id="vaticannews-widget"
        />
      </body>
    </html>
  );
}
