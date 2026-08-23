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
            {/* Siluetas line-art dibujadas POR CODIGO en el fondo: un punto
                dorado recorre cada trazo mientras la linea se revela (truco
                pathLength=1 + dashoffset). Izquierda: estructura/iglesia.
                Derecha: senora con bebe. page.tsx dispara los beginElement()
                en el momento justo para sincronizar punto y linea. */}
            <svg className="splash-sketch sk-a" viewBox="0 0 220 300" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id="pjlGoldA" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f5dfae" />
                  <stop offset="100%" stopColor="#c8973a" />
                </linearGradient>
              </defs>
              {/* cruz */}
              <path pathLength={1} className="sk-p" style={{ '--d': '1.1s', '--dl': '0.1s' } as React.CSSProperties} data-dot="none"
                    d="M110 12 V46 M97 28 H123" />
              {/* fronton */}
              <path pathLength={1} className="sk-p" style={{ '--d': '1.5s', '--dl': '0.35s' } as React.CSSProperties}
                    d="M38 102 L110 48 L182 102" />
              {/* cornisa */}
              <path pathLength={1} className="sk-p" style={{ '--d': '0.9s', '--dl': '0.75s' } as React.CSSProperties} data-dot="none"
                    d="M30 106 H190" />
              {/* muros y piso */}
              <path pathLength={1} className="sk-p" style={{ '--d': '2.3s', '--dl': '0.95s' } as React.CSSProperties} data-dot="none"
                    d="M48 110 V240 M172 110 V240 M28 240 H192" />
              {/* puerta en arco (punto viajero) */}
              <path pathLength={1} className="sk-p" style={{ '--d': '1.7s', '--dl': '1.7s' } as React.CSSProperties}
                    d="M94 240 V186 A16 16 0 0 1 126 186 V240" />
              {/* roseton (punto orbita) */}
              <path pathLength={1} className="sk-p" style={{ '--d': '1.4s', '--dl': '2.6s' } as React.CSSProperties}
                    d="M126 134 A16 16 0 1 1 125.99 134" />
              <circle className="sk-dot" r="4.5" opacity="0">
                <animateMotion data-smil="" data-delay="1.7" dur="1.7s" begin="indefinite" fill="freeze"
                               path="M94,240 V186 A16 16 0 0 1 126,186 V240" />
                <animate data-smil="" data-delay="1.7" dur="1.7s" begin="indefinite" fill="freeze"
                         attributeName="opacity" values="0;1;1;0" keyTimes="0;0.06;0.85;1" />
              </circle>
              <circle className="sk-dot" r="4.5" opacity="0">
                <animateMotion data-smil="" data-delay="2.6" dur="1.4s" begin="indefinite" fill="freeze"
                               path="M126,134 A16 16 0 1 1 125.99,134" />
                <animate data-smil="" data-delay="2.6" dur="1.4s" begin="indefinite" fill="freeze"
                         attributeName="opacity" values="0;1;1;0" keyTimes="0;0.06;0.85;1" />
              </circle>
              <circle className="sk-dot" r="4.5" opacity="0">
                <animateMotion data-smil="" data-delay="0.35" dur="1.5s" begin="indefinite" fill="freeze"
                               path="M38,102 L110,48 L182,102" />
                <animate data-smil="" data-delay="0.35" dur="1.5s" begin="indefinite" fill="freeze"
                         attributeName="opacity" values="0;1;1;0" keyTimes="0;0.06;0.85;1" />
              </circle>
            </svg>
            <svg className="splash-sketch sk-b" viewBox="0 0 220 300" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id="pjlGoldB" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f5dfae" />
                  <stop offset="100%" stopColor="#c8973a" />
                </linearGradient>
              </defs>
              {/* halo sobre la cabeza */}
              <path pathLength={1} className="sk-p" style={{ '--d': '1.3s', '--dl': '0.15s' } as React.CSSProperties} data-dot="none"
                    d="M74 66 C86 30 138 22 158 50" />
              {/* velo y perfil (punto viajero principal) */}
              <path pathLength={1} className="sk-p" style={{ '--d': '2.6s', '--dl': '0.5s' } as React.CSSProperties}
                    d="M148 36 C116 24 82 34 70 64 C59 92 67 110 59 140 C51 170 55 198 65 224 C73 244 79 262 77 284" />
              {/* rostro sugerido */}
              <path pathLength={1} className="sk-p" style={{ '--d': '1.2s', '--dl': '1.5s' } as React.CSSProperties} data-dot="none"
                    d="M97 76 C89 90 91 104 99 114 C105 121 105 127 99 131" />
              {/* brazos que acunan (punto viajero) */}
              <path pathLength={1} className="sk-p" style={{ '--d': '1.8s', '--dl': '2.2s' } as React.CSSProperties}
                    d="M99 160 C117 149 139 153 153 167 C161 175 163 187 157 197" />
              {/* cabecita del bebe (punto orbita) */}
              <path pathLength={1} className="sk-p" style={{ '--d': '1.1s', '--dl': '3.1s' } as React.CSSProperties}
                    d="M165 181 A13 13 0 1 1 164.99 181" />
              {/* cuerpito del bebe */}
              <path pathLength={1} className="sk-p" style={{ '--d': '1.2s', '--dl': '3.4s' } as React.CSSProperties} data-dot="none"
                    d="M137 199 C145 211 159 215 171 209" />
              {/* hombro y manto base */}
              <path pathLength={1} className="sk-p" style={{ '--d': '2s', '--dl': '2.9s' } as React.CSSProperties} data-dot="none"
                    d="M65 224 C98 212 134 216 157 238 C165 248 169 264 167 284" />
              <circle className="sk-dot" r="4.5" opacity="0">
                <animateMotion data-smil="" data-delay="0.5" dur="2.6s" begin="indefinite" fill="freeze"
                               path="M148,36 C116,24 82,34 70,64 C59,92 67,110 59,140 C51,170 55,198 65,224 C73,244 79,262 77,284" />
                <animate data-smil="" data-delay="0.5" dur="2.6s" begin="indefinite" fill="freeze"
                         attributeName="opacity" values="0;1;1;0" keyTimes="0;0.05;0.88;1" />
              </circle>
              <circle className="sk-dot" r="4.5" opacity="0">
                <animateMotion data-smil="" data-delay="2.2" dur="1.8s" begin="indefinite" fill="freeze"
                               path="M99,160 C117,149 139,153 153,167 C161,175 163,187 157,197" />
                <animate data-smil="" data-delay="2.2" dur="1.8s" begin="indefinite" fill="freeze"
                         attributeName="opacity" values="0;1;1;0" keyTimes="0;0.06;0.85;1" />
              </circle>
              <circle className="sk-dot" r="4.5" opacity="0">
                <animateMotion data-smil="" data-delay="3.1" dur="1.1s" begin="indefinite" fill="freeze"
                               path="M165,181 A13 13 0 1 1 164.99,181" />
                <animate data-smil="" data-delay="3.1" dur="1.1s" begin="indefinite" fill="freeze"
                         attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.82;1" />
              </circle>
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
