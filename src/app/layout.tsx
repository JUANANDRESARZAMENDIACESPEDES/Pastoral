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
                {/* cruz sobre la corona */}
                <path className="sk-p"
                      style={{ '--d': '0.7s', '--dl': '0.15s' } as React.CSSProperties}
                      d="M50 5 V13.5 M46.8 8 H53.2" />
                {/* cúpula del primer piso */}
                <path className="sk-p"
                      style={{ '--d': '0.9s', '--dl': '0.45s' } as React.CSSProperties}
                      d="M41.5 25 C43.5 18.5 56.5 18.5 58.5 25" />
                {/* separador del segundo piso */}
                <path className="sk-p"
                      style={{ '--d': '0.75s', '--dl': '0.75s' } as React.CSSProperties}
                      d="M39.5 31.5 C44 27.5 56 27.5 60.5 31.5" />
                {/* separador del tercer piso */}
                <path className="sk-p"
                      style={{ '--d': '0.75s', '--dl': '1s' } as React.CSSProperties}
                      d="M38 38 C43.5 34 56.5 34 62 38" />
                {/* borde inferior de la corona */}
                <path className="sk-p"
                      style={{ '--d': '0.8s', '--dl': '1.25s' } as React.CSSProperties}
                      d="M36.5 44.5 Q50 50 63.5 44.5" />
                {/* fajín izquierdo */}
                <path className="sk-p"
                      style={{ '--d': '0.9s', '--dl': '1.55s' } as React.CSSProperties}
                      d="M42.5 47 L38.5 62.5 L44 61 L46 48" />
                {/* fajín derecho */}
                <path className="sk-p"
                      style={{ '--d': '0.9s', '--dl': '1.65s' } as React.CSSProperties}
                      d="M57.5 47 L61.5 62.5 L56 61 L54 48" />
                {/* LLAVES CRUZADAS EN ASPA */}
                {/* arco de la llave izquierda */}
                <path className="sk-p"
                      style={{ '--d': '1s', '--dl': '1.95s' } as React.CSSProperties}
                      d="M39.5 66 A7.5 7.5 0 1 1 39.49 66" />
                {/* mango izquierdo hacia abajo-derecha */}
                <path className="sk-p"
                      style={{ '--d': '1s', '--dl': '2.25s' } as React.CSSProperties}
                      d="M37 71 L63 102" />
                {/* dientes de la llave izquierda */}
                <path className="sk-p"
                      style={{ '--d': '0.65s', '--dl': '2.75s' } as React.CSSProperties}
                      d="M63 102 L71 110 M67 98.5 L74.5 106 M71 110 L74.5 106" />
                {/* arco de la llave derecha */}
                <path className="sk-p"
                      style={{ '--d': '1s', '--dl': '2.15s' } as React.CSSProperties}
                      d="M75.5 66 A7.5 7.5 0 1 1 75.49 66" />
                {/* mango derecho hacia abajo-izquierda */}
                <path className="sk-p"
                      style={{ '--d': '1s', '--dl': '2.45s' } as React.CSSProperties}
                      d="M63 71 L37 102" />
                {/* dientes de la llave derecha */}
                <path className="sk-p"
                      style={{ '--d': '0.65s', '--dl': '2.95s' } as React.CSSProperties}
                      d="M37 102 L29 110 M33 98.5 L25.5 106 M29 110 L25.5 106" />
                {/* puntos dorados en los trazos principales */}
                <circle className="sk-dot" r="1.6"
                        style={{ '--d': '0.9s', '--dl': '0.45s', offsetPath: 'path("M41.5 25 C43.5 18.5 56.5 18.5 58.5 25")' } as React.CSSProperties} />
                <circle className="sk-dot" r="1.6"
                        style={{ '--d': '1s', '--dl': '1.95s', offsetPath: 'path("M39.5 66 A7.5 7.5 0 1 1 39.49 66")' } as React.CSSProperties} />
                <circle className="sk-dot" r="1.6"
                        style={{ '--d': '1s', '--dl': '2.15s', offsetPath: 'path("M75.5 66 A7.5 7.5 0 1 1 75.49 66")' } as React.CSSProperties} />
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
