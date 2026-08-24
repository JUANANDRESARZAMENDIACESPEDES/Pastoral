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
                {/* TIARA PAPAL (como en la bandera: corona triple arriba) */}
                {/* cruz sobre la corona */}
                <path className="sk-p"
                      style={{ '--d': '0.6s', '--dl': '0.15s' } as React.CSSProperties}
                      d="M50 4 V10.5 M47 6.5 H53" />
                {/* contorno cerrado de la corona triple */}
                <path className="sk-p"
                      style={{ '--d': '1.6s', '--dl': '0.45s' } as React.CSSProperties}
                      d="M36 44 C35 40 36.5 37 38 34 C36.5 30 38 27 40 24 C39 20 41 15 45 13 C47 11.5 53 11.5 55 13 C59 15 61 20 60 24 C62 27 63.5 30 62 34 C63.5 37 65 40 64 44 Q50 49 36 44 Z" />
                {/* separador de pisos medio */}
                <path className="sk-p"
                      style={{ '--d': '0.8s', '--dl': '0.9s' } as React.CSSProperties}
                      d="M37.5 33 C42 29.8 58 29.8 62.5 33" />
                {/* separador de pisos alto */}
                <path className="sk-p"
                      style={{ '--d': '0.8s', '--dl': '1.15s' } as React.CSSProperties}
                      d="M39 25.5 C43.5 22.5 56.5 22.5 61 25.5" />
                {/* fajin izquierdo */}
                <path className="sk-p"
                      style={{ '--d': '0.8s', '--dl': '1.45s' } as React.CSSProperties}
                      d="M36.8 45 L34 61 L39 59.5 L41 46.5 Q39 46 36.8 45 Z" />
                {/* fajin derecho */}
                <path className="sk-p"
                      style={{ '--d': '0.8s', '--dl': '1.55s' } as React.CSSProperties}
                      d="M63.2 45 L66 61 L61 59.5 L59 46.5 Q61 46 63.2 45 Z" />
                {/* LLAVES CRUZADAS EN ASPA DETRAS DE LA TIARA */}
                {/* llave dorada: arco arriba-izquierda */}
                <path className="sk-p"
                      style={{ '--d': '1.1s', '--dl': '1.9s' } as React.CSSProperties}
                      d="M36 55 A9 9 0 1 1 35.99 55" />
                {/* mango que cruza hacia abajo-derecha */}
                <path className="sk-p"
                      style={{ '--d': '1.1s', '--dl': '2.3s' } as React.CSSProperties}
                      d="M33 61.6 L67 99" />
                {/* dientes al final del mango */}
                <path className="sk-p"
                      style={{ '--d': '0.6s', '--dl': '3s' } as React.CSSProperties}
                      d="M58.5 97.2 L65.9 90.4 M60.9 99.8 L68.3 93 M63.3 102.4 L70.7 95.6" />
                {/* llave plateada: arco arriba-derecha */}
                <path className="sk-p"
                      style={{ '--d': '1.1s', '--dl': '2.05s' } as React.CSSProperties}
                      d="M82 55 A9 9 0 1 1 81.99 55" />
                {/* mango que cruza hacia abajo-izquierda */}
                <path className="sk-p"
                      style={{ '--d': '1.1s', '--dl': '2.45s' } as React.CSSProperties}
                      d="M67 61.6 L33 99" />
                {/* dientes al final del mango */}
                <path className="sk-p"
                      style={{ '--d': '0.6s', '--dl': '3.15s' } as React.CSSProperties}
                      d="M41.5 97.2 L34.1 90.4 M39.1 99.8 L31.7 93 M36.7 102.4 L29.3 95.6" />
                {/* puntos dorados en los trazos principales */}
                <circle className="sk-dot" r="1.6"
                        style={{ '--d': '1.6s', '--dl': '0.45s', offsetPath: 'path("M36 44 C35 40 36.5 37 38 34 C36.5 30 38 27 40 24 C39 20 41 15 45 13 C47 11.5 53 11.5 55 13 C59 15 61 20 60 24 C62 27 63.5 30 62 34 C63.5 37 65 40 64 44 Q50 49 36 44 Z")' } as React.CSSProperties} />
                <circle className="sk-dot" r="1.6"
                        style={{ '--d': '1.1s', '--dl': '1.9s', offsetPath: 'path("M36 55 A9 9 0 1 1 35.99 55")' } as React.CSSProperties} />
                <circle className="sk-dot" r="1.6"
                        style={{ '--d': '1.1s', '--dl': '2.05s', offsetPath: 'path("M82 55 A9 9 0 1 1 81.99 55")' } as React.CSSProperties} />
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
