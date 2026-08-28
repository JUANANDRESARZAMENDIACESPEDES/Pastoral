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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" />
        <link rel="preload" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&display=swap" as="style" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&display=swap" media="print" />
        <script dangerouslySetInnerHTML={{ __html: "var pf=document.querySelector('link[href*=\"Playfair\"][media=\"print\"]');if(pf)pf.onload=function(){this.media='all'};" }} />
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
              /* La navbar es visible por defecto: antes dependia de
                 'nav-entered' (opacity:0) que solo saltaba a los ~6s. Si el
                 velo se perdia, quedaba el contenido visible SIN navbar hasta
                 entonces. Ahora el navbar se ve siempre y 'nav-entered' solo
                 añade su animación de entrada (nunca puede 'faltar'). */
              '.top-nav .brand-logo-wrap,.top-nav .brand-text,.top-nav .nav-links .nav-item{opacity:1}',
              'html.show-splash:not(.pjl-reveal) body>*:not(#splash-pjl):not(script):not(style):not(noscript){visibility:hidden!important}',
              'html.pjl-reveal body>*:not(#splash-pjl):not(script):not(style):not(noscript){visibility:visible!important;animation:pjlPageIn .55s ease-out both}',
              '@keyframes pjlPageIn{from{opacity:0}to{opacity:1}}',
              'html.show-splash body:not(:has(> #splash-pjl))>*{visibility:visible!important}',
              '@media (prefers-reduced-motion:reduce){#splash-pjl{display:none!important}html.show-splash body>*:not(#splash-pjl){visibility:visible!important}}',
              '@media (prefers-reduced-motion:reduce){.top-nav .brand-logo-wrap,.top-nav .brand-text,.top-nav .nav-links .nav-item{opacity:1 !important}}',
            ].join(''),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
  function setFavicon(u){var l=document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]');for(var i=0;i<l.length;i++)l[i].remove();var c=document.createElement('link');c.rel='icon';c.type='image/png';c.href=u;document.head.insertBefore(c,document.head.firstChild);var a=document.createElement('link');a.rel='apple-touch-icon';a.href=u;document.head.appendChild(a)}
  function drawCircle(img){var s=256,ca=document.createElement('canvas');ca.width=s;ca.height=s;var x=ca.getContext('2d');x.beginPath();x.arc(s/2,s/2,s/2,0,Math.PI*2);x.closePath();x.clip();var m=Math.min(img.width,img.height);x.drawImage(img,(img.width-m)/2,(img.height-m)/2,m,m,0,0,s,s);setFavicon(ca.toDataURL('image/png'))}
  function loadLogo(){try{var r=localStorage.getItem('pjl_branding');if(!r)return;var b=JSON.parse(r);var u=b&&b.mainLogo;if(!u)return;if(u.indexOf('data:')===0){var img=new Image();img.onload=function(){drawCircle(img)};img.src=u}else{fetch(u).then(function(res){return res.blob()}).then(function(blob){var reader=new FileReader();reader.onload=function(){var img=new Image();img.onload=function(){drawCircle(img)};img.onerror=function(){setFavicon(u)};img.src=reader.result};reader.readAsDataURL(blob)}).catch(function(){setFavicon(u)})}}catch(e){}}
  setTimeout(loadLogo,50);
  function onStore(e){try{var d=e.detail||{};if(d.key==='branding')setTimeout(loadLogo,50)}catch(ex){}}
  if(typeof window!=='undefined'){window.addEventListener('pjl_store_update',onStore);window.addEventListener('storage',function(e){if(e.key==='pjl_branding')setTimeout(loadLogo,50)})}
})();`,
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
                Izquierda: cruz. Derecha: cáliz y hostia
                (símbolo eucarístico). Sin JS de por medio. */}
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
                {/* CÁLIZ Y HOSTIA — SÍMBOLO EUCARÍSTICO */}
                {/* hostia: disco circular elevado */}
                <path className="sk-p sk-fill"
                      style={{ '--d': '1.1s', '--dl': '0.4s' } as React.CSSProperties}
                      d="M37 28 A13 13 0 1 1 36.99 28 Z" />
                {/* cruz de la hostia: brazo vertical */}
                <path className="sk-p"
                      style={{ '--d': '0.5s', '--dl': '1s' } as React.CSSProperties}
                      d="M50 21 V35" />
                {/* cruz de la hostia: brazo horizontal */}
                <path className="sk-p"
                      style={{ '--d': '0.5s', '--dl': '1.15s' } as React.CSSProperties}
                      d="M44 28 H56" />
                {/* rayos de gloria que irradian de la hostia */}
                <path className="sk-p"
                      style={{ '--d': '0.4s', '--dl': '1.4s' } as React.CSSProperties}
                      d="M43 16 L39 9" />
                <path className="sk-p"
                      style={{ '--d': '0.4s', '--dl': '1.5s' } as React.CSSProperties}
                      d="M57 16 L61 9" />
                <path className="sk-p"
                      style={{ '--d': '0.4s', '--dl': '1.6s' } as React.CSSProperties}
                      d="M37 24 L31 23" />
                <path className="sk-p"
                      style={{ '--d': '0.4s', '--dl': '1.7s' } as React.CSSProperties}
                      d="M63 24 L69 23" />
                <path className="sk-p"
                      style={{ '--d': '0.4s', '--dl': '1.8s' } as React.CSSProperties}
                      d="M39 36 L34 41" />
                <path className="sk-p"
                      style={{ '--d': '0.4s', '--dl': '1.9s' } as React.CSSProperties}
                      d="M61 36 L66 41" />
                {/* copa del cáliz (boca ancha y redondeada) */}
                <path className="sk-p sk-fill"
                      style={{ '--d': '1.7s', '--dl': '2s' } as React.CSSProperties}
                      d="M26 68 C26 76 32 90 50 94 C68 90 74 76 74 68 C62 74 38 74 26 68 Z" />
                {/* borde interior de la boca de la copa */}
                <path className="sk-p"
                      style={{ '--d': '0.6s', '--dl': '2.3s' } as React.CSSProperties}
                      d="M30 70 Q50 77 70 70" />
                {/* tallo superior */}
                <path className="sk-p"
                      style={{ '--d': '0.4s', '--dl': '2.7s' } as React.CSSProperties}
                      d="M50 94 V98" />
                {/* nudo del tallo */}
                <path className="sk-p sk-fill"
                      style={{ '--d': '0.5s', '--dl': '2.9s' } as React.CSSProperties}
                      d="M46.5 100 A3.5 3.5 0 1 1 46.49 100 Z" />
                {/* tallo inferior */}
                <path className="sk-p"
                      style={{ '--d': '0.4s', '--dl': '3.1s' } as React.CSSProperties}
                      d="M50 103.5 V107" />
                {/* pie del cáliz */}
                <path className="sk-p sk-fill"
                      style={{ '--d': '1s', '--dl': '3.2s' } as React.CSSProperties}
                      d="M40 107 L60 107 L65 114 Q50 118 35 114 Z" />
                {/* puntos dorados que recorren las formas principales */}
                <circle className="sk-dot" r="1.6"
                        style={{ '--d': '1.1s', '--dl': '0.4s', offsetPath: 'path("M37 28 A13 13 0 1 1 36.99 28 Z")' } as React.CSSProperties} />
                <circle className="sk-dot" r="1.6"
                        style={{ '--d': '1.7s', '--dl': '2s', offsetPath: 'path("M26 68 C26 76 32 90 50 94 C68 90 74 76 74 68 C62 74 38 74 26 68 Z")' } as React.CSSProperties} />
                <circle className="sk-dot" r="1.6"
                        style={{ '--d': '1s', '--dl': '3.2s', offsetPath: 'path("M40 107 L60 107 L65 114 Q50 118 35 114 Z")' } as React.CSSProperties} />
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
        {/* Inyecta el logo oficial en el splash ANTES de la hidratación para
            evitar que se vea el logo por defecto un instante. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var r=localStorage.getItem('pjl_branding');if(!r)return;var b=JSON.parse(r);var u=b&&b.mainLogo;if(!u)return;var f=document.querySelector('.splash-logo-fallback');if(!f)return;var img=document.createElement('img');img.src=u;img.alt='Logotipo de la Pastoral Juvenil Luqueña';img.className='splash-logo-img';img.onload=function(){f.replaceWith(img)};img.onerror=function(){};if(img.complete&&img.naturalWidth>0)setTimeout(function(){if(f.isConnected)f.replaceWith(img)},0)}catch(e){}})();` }} />
        <ThemeLoader />
        {children}
        <Script
          src="https://www.vaticannews.va/etc/designs/vaticannews/widget/widget.js"
          strategy="lazyOnload"
          id="vaticannews-widget"
        />
      </body>
    </html>
  );
}
