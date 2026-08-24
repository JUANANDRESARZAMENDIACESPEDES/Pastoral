import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Fraunces, Manrope, Libre_Baskerville } from "next/font/google";
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
              <path className="sk-p"
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
              {/* cruzita superior */}
              <path className="sk-p" data-dot="none"
                    style={{ '--d': '0.9s', '--dl': '0.15s' } as React.CSSProperties}
                    d="M50 8 V17 M46.5 11 H53.5" />
              {/* cúpula */}
              <path className="sk-p"
                    style={{ '--d': '1s', '--dl': '0.5s' } as React.CSSProperties}
                    d="M39 27 C41 18 59 18 61 27" />
              {/* banda media */}
              <path className="sk-p" data-dot="none"
                    style={{ '--d': '0.8s', '--dl': '0.85s' } as React.CSSProperties}
                    d="M37.5 33 C42 29.5 58 29.5 62.5 33" />
              {/* borde inferior */}
              <path className="sk-p"
                    style={{ '--d': '0.9s', '--dl': '1.05s' } as React.CSSProperties}
                    d="M36 41 Q50 47 64 41" />
              {/* fajines laterales */}
              <path className="sk-p" data-dot="none"
                    style={{ '--d': '1s', '--dl': '1.35s' } as React.CSSProperties}
                    d="M43 44 L39 60 L44.5 58.5 L46 45" />
              <path className="sk-p" data-dot="none"
                    style={{ '--d': '1s', '--dl': '1.45s' } as React.CSSProperties}
                    d="M57 44 L61 60 L55.5 58.5 L54 45" />
              {/* LLAVES CRUZADAS */}
              {/* arco de la llave izquierda */}
              <path className="sk-p"
                    style={{ '--d': '1.1s', '--dl': '1.7s' } as React.CSSProperties}
                    d="M40 66 A8 8 0 1 1 39.99 66" />
              {/* mango que baja hacia la derecha */}
              <path className="sk-p" data-dot="none"
                    style={{ '--d': '1.1s', '--dl': '2s' } as React.CSSProperties}
                    d="M39 74 L64 106" />
              {/* dientes de la primera llave */}
              <path className="sk-p" data-dot="none"
                    style={{ '--d': '0.7s', '--dl': '2.6s' } as React.CSSProperties}
                    d="M64 106 L72 114 M68.5 102.5 L76 110" />
              {/* arco de la llave derecha */}
              <path className="sk-p"
                    style={{ '--d': '1.1s', '--dl': '2.2s' } as React.CSSProperties}
                    d="M60 66 A8 8 0 1 1 59.99 66" />
              {/* mango que baja hacia la izquierda */}
              <path className="sk-p" data-dot="none"
                    style={{ '--d': '1.1s', '--dl': '2.4s' } as React.CSSProperties}
                    d="M61 74 L36 106" />
              {/* dientes de la segunda llave */}
              <path className="sk-p" data-dot="none"
                    style={{ '--d': '0.7s', '--dl': '3s' } as React.CSSProperties}
                    d="M36 106 L28 114 M31.5 102.5 L24 110" />
              {/* puntos dorados en los trazos principales */}
              <circle className="sk-dot" r="1.6"
                      style={{ '--d': '1s', '--dl': '0.5s', offsetPath: 'path("M39 27 C41 18 59 18 61 27")' } as React.CSSProperties} />
              <circle className="sk-dot" r="1.6"
                      style={{ '--d': '1.1s', '--dl': '1.7s', offsetPath: 'path("M40 66 A8 8 0 1 1 39.99 66")' } as React.CSSProperties} />
              <circle className="sk-dot" r="1.6"
                      style={{ '--d': '1.1s', '--dl': '2.2s', offsetPath: 'path("M60 66 A8 8 0 1 1 59.99 66")' } as React.CSSProperties} />
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
