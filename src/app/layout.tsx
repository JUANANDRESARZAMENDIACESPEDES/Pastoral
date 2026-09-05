import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Fraunces, Manrope, Libre_Baskerville } from "next/font/google";
import ThemeLoader from "../components/ThemeLoader";
import PwaInstallPrompt from "../components/PwaInstallPrompt";
import PwaIconSync from "../components/PwaIconSync";
import InstalledToast from "../components/InstalledToast";
import UpdatePrompt from "../components/UpdatePrompt";
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
  applicationName: "Pastoral Juvenil Luqueña",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Pastoral Juvenil Luqueña",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1A2744",
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
        {/* Captura TEMPRANA del beforeinstallprompt (antes de la hidratación).
            Chrome lo dispara al cargar si la web es instalable; si React no lo
            escucha a tiempo el evento se pierde y nunca habría instalación
            nativa. Lo guardamos en una variable global para que el hook lo
            recupere cuando se monte. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
  try{
    if(!window.__pjlpwa) window.__pjlpwa={deferredPrompt:null,hasPrompt:false,captured:false};
    function capture(e){
      if(e && e.preventDefault) e.preventDefault();
      window.__pjlpwa.captured=true;
      window.__pjlpwa.deferredPrompt=e;
      window.__pjlpwa.hasPrompt=true;
      try{window.dispatchEvent(new CustomEvent('pjl_beforeinstall',{detail:e}))}catch(_){}
    }
    window.addEventListener('beforeinstallprompt',capture);
    window.addEventListener('appinstalled',function(){try{window.__pjlpwa.hasPrompt=false;window.__pjlpwa.deferredPrompt=null}catch(_){}});
  }catch(e){}
})();`,
          }}
        />
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
              /* El navbar nace oculto (opacity:0 en globals.css) y SOLO se
                 revela cuando 'nav-entered' dispara su animación escalonada.
                 El velo del splash lo mantiene oculto hasta entonces, y el
                 useLayoutEffect de page.tsx siempre añade 'nav-entered', por
                 lo que no existe ventana sin menú: un único fundido de entrada.
                 Nada de sobreescribir opacity a 1 aquí (causaba doble refresco:
                 flash visible -> re-animación desde 0). */
              'html.show-splash:not(.pjl-reveal) body>*:not(#splash-pjl):not(script):not(style):not(noscript){visibility:hidden!important}',
              'html.pjl-reveal body>*:not(#splash-pjl):not(script):not(style):not(noscript){visibility:visible!important;animation:pjlPageIn .55s ease-out both}',
              /* IMPORTANTE: el navbar NO debe heredar pjlPageIn. Si lo recibe,
                 entraría con el fundido del contenido y LUEGO otra vez con su
                 propia animación nav-entered -> doble refresco. Se le quita la
                 animación de pjlPageIn y queda solamente con su fundido único. */
              'html.pjl-reveal body>.top-nav{animation:none!important;visibility:visible!important}',
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
  var FALLBACK='/android-chrome-192.png';
  function setFavicon(u){var l=document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]');for(var i=0;i<l.length;i++)l[i].remove();var c=document.createElement('link');c.rel='icon';c.type='image/png';c.href=u;document.head.insertBefore(c,document.head.firstChild);var a=document.createElement('link');a.rel='apple-touch-icon';a.href=u;document.head.appendChild(a)}
  function drawCircle(imgUrl){var img=new Image();img.onload=function(){var s=256,ca=document.createElement('canvas');ca.width=s;ca.height=s;var x=ca.getContext('2d');x.beginPath();x.arc(s/2,s/2,s/2,0,Math.PI*2);x.closePath();x.clip();var m=Math.min(img.width,img.height);x.drawImage(img,(img.width-m)/2,(img.height-m)/2,m,m,0,0,s,s);setFavicon(ca.toDataURL('image/png'));try{if(navigator.serviceWorker&&navigator.serviceWorker.controller)navigator.serviceWorker.controller.postMessage({type:'FAVICON_UPDATED'})}catch(e){}};img.onerror=function(){setFavicon(FALLBACK)};img.src=imgUrl+(imgUrl.indexOf('data:')===0?'':'?ts='+Date.now())}
  function loadLogo(){try{var r=localStorage.getItem('pjl_branding');var u=null;if(r){var b=JSON.parse(r);u=b&&b.mainLogo}
    if(!u||u===FALLBACK){setFavicon(FALLBACK);try{if(navigator.serviceWorker&&navigator.serviceWorker.controller)navigator.serviceWorker.controller.postMessage({type:'FAVICON_UPDATED'})}catch(e){};return}
    drawCircle(u)
  }catch(e){setFavicon(FALLBACK)}}
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
        <script dangerouslySetInnerHTML={{ __html: `(function(){if(location.pathname!=='/')return;var skip=false;try{var ne=performance&&performance.getEntriesByType&&performance.getEntriesByType('navigation');var nt=ne&&ne[0]?ne[0].type:'';var isReload=(nt==='reload')||(performance.navigation&&performance.navigation.type===1);if(!isReload){var ts=parseInt(sessionStorage.getItem('pjl_skip_splash')||'',10);if(ts&&Date.now()-ts<8000)skip=true;}}catch(e){skip=false;}if(!skip){document.documentElement.className+=' show-splash';}})();` }} />
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
                {/* CÁLIZ (silueta trazada desde la referencia ostia_y_caliz.avif) */}
                <path className="sk-p sk-fill"
                      style={{ '--d': '2.6s', '--dl': '0.3s' } as React.CSSProperties}
                      d="M39.12 0.00 C35.30 0.50 38.56 1.98 37.88 2.98 C37.20 3.97 36.10 4.96 35.06 5.95 C34.01 6.94 32.96 7.94 31.61 8.93 C30.27 9.92 28.15 10.91 26.99 11.90 C25.84 12.90 25.19 13.89 24.68 14.88 C24.16 15.87 24.15 16.87 23.92 17.86 C23.69 18.85 23.86 19.84 23.31 20.83 C22.76 21.83 21.57 22.82 20.61 23.81 C19.65 24.80 18.18 25.79 17.54 26.79 C16.90 27.78 16.60 28.77 16.77 29.76 C16.93 30.75 17.76 31.75 18.55 32.74 C19.35 33.73 21.07 34.72 21.53 35.71 C22.00 36.71 21.80 37.70 21.36 38.69 C20.92 39.68 19.51 40.67 18.89 41.67 C18.27 42.66 17.51 43.65 17.64 44.64 C17.77 45.63 18.97 46.63 19.66 47.62 C20.35 48.61 21.51 49.60 21.79 50.60 C22.07 51.59 21.75 52.58 21.32 53.57 C20.89 54.56 19.80 55.56 19.23 56.55 C18.66 57.54 17.79 58.53 17.89 59.52 C17.98 60.52 19.17 61.51 19.78 62.50 C20.40 63.49 21.30 64.48 21.59 65.48 C21.88 66.47 21.97 67.46 21.53 68.45 C21.10 69.44 19.73 70.44 18.98 71.43 C18.24 72.42 17.24 73.41 17.06 74.40 C16.89 75.40 17.15 76.39 17.91 77.38 C18.68 78.37 20.70 79.37 21.64 80.36 C22.58 81.35 23.18 82.34 23.56 83.33 C23.94 84.33 23.84 85.32 23.94 86.31 C24.04 87.30 23.69 88.29 24.17 89.29 C24.65 90.28 25.76 91.27 26.82 92.26 C27.87 93.25 29.24 94.25 30.49 95.24 C31.74 96.23 33.34 97.22 34.32 98.21 C35.31 99.21 35.90 100.20 36.42 101.19 C36.95 102.18 37.43 103.17 37.47 104.17 C37.51 105.16 37.27 106.15 36.65 107.14 C36.03 108.13 34.68 109.13 33.75 110.12 C32.81 111.11 31.75 112.10 31.02 113.10 C30.28 114.09 29.51 115.08 29.35 116.07 C29.19 117.06 29.63 118.06 30.06 119.05 C30.49 120.04 31.39 121.03 31.93 122.02 C32.47 123.02 27.63 124.50 33.31 125.00 C38.98 125.50 60.26 125.50 65.96 125.00 C71.66 124.50 66.89 123.02 67.52 122.02 C68.16 121.03 69.22 120.04 69.76 119.05 C70.30 118.06 70.84 117.06 70.75 116.07 C70.66 115.08 69.95 114.09 69.24 113.10 C68.52 112.10 67.43 111.11 66.47 110.12 C65.50 109.13 64.10 108.13 63.45 107.14 C62.80 106.15 62.53 105.16 62.55 104.17 C62.57 103.17 63.03 102.18 63.56 101.19 C64.08 100.20 64.68 99.21 65.67 98.21 C66.67 97.22 68.27 96.23 69.52 95.24 C70.78 94.25 72.16 93.25 73.21 92.26 C74.27 91.27 75.38 90.28 75.86 89.29 C76.34 88.29 75.99 87.30 76.09 86.31 C76.19 85.32 76.09 84.33 76.47 83.33 C76.85 82.34 77.45 81.35 78.39 80.36 C79.33 79.37 81.35 78.37 82.12 77.38 C82.88 76.39 83.14 75.40 82.97 74.40 C82.79 73.41 81.80 72.42 81.06 71.43 C80.32 70.44 78.96 69.44 78.54 68.45 C78.11 67.46 78.22 66.47 78.52 65.48 C78.82 64.48 79.72 63.49 80.34 62.50 C80.95 61.51 82.13 60.52 82.21 59.52 C82.29 58.53 81.41 57.54 80.83 56.55 C80.24 55.56 79.14 54.56 78.71 53.57 C78.27 52.58 77.94 51.59 78.21 50.60 C78.48 49.60 79.64 48.61 80.33 47.62 C81.02 46.63 82.22 45.63 82.35 44.64 C82.48 43.65 81.73 42.66 81.11 41.67 C80.50 40.67 79.09 39.68 78.65 38.69 C78.21 37.70 78.00 36.71 78.46 35.71 C78.93 34.72 80.64 33.73 81.43 32.74 C82.23 31.75 83.06 30.75 83.23 29.76 C83.41 28.77 83.12 27.78 82.48 26.79 C81.84 25.79 80.38 24.80 79.42 23.81 C78.46 22.82 77.24 21.83 76.72 20.83 C76.21 19.84 76.43 18.85 76.32 17.86 C76.21 16.87 76.43 15.87 76.07 14.88 C75.71 13.89 75.27 12.90 74.16 11.90 C73.06 10.91 70.87 9.92 69.44 8.93 C68.01 7.94 66.77 6.94 65.57 5.95 C64.37 4.96 63.01 3.97 62.23 2.98 C61.44 1.98 64.69 0.50 60.84 0.00 C56.99 -0.50 42.95 -0.50 39.12 0.00 Z" />
                {/* punto dorado que recorre el contorno del cáliz */}
                <circle className="sk-dot" r="1.6"
                        style={{ '--d': '2.6s', '--dl': '0.3s', offsetPath: 'path("M39.12 0.00 C35.30 0.50 38.56 1.98 37.88 2.98 C37.20 3.97 36.10 4.96 35.06 5.95 C34.01 6.94 32.96 7.94 31.61 8.93 C30.27 9.92 28.15 10.91 26.99 11.90 C25.84 12.90 25.19 13.89 24.68 14.88 C24.16 15.87 24.15 16.87 23.92 17.86 C23.69 18.85 23.86 19.84 23.31 20.83 C22.76 21.83 21.57 22.82 20.61 23.81 C19.65 24.80 18.18 25.79 17.54 26.79 C16.90 27.78 16.60 28.77 16.77 29.76 C16.93 30.75 17.76 31.75 18.55 32.74 C19.35 33.73 21.07 34.72 21.53 35.71 C22.00 36.71 21.80 37.70 21.36 38.69 C20.92 39.68 19.51 40.67 18.89 41.67 C18.27 42.66 17.51 43.65 17.64 44.64 C17.77 45.63 18.97 46.63 19.66 47.62 C20.35 48.61 21.51 49.60 21.79 50.60 C22.07 51.59 21.75 52.58 21.32 53.57 C20.89 54.56 19.80 55.56 19.23 56.55 C18.66 57.54 17.79 58.53 17.89 59.52 C17.98 60.52 19.17 61.51 19.78 62.50 C20.40 63.49 21.30 64.48 21.59 65.48 C21.88 66.47 21.97 67.46 21.53 68.45 C21.10 69.44 19.73 70.44 18.98 71.43 C18.24 72.42 17.24 73.41 17.06 74.40 C16.89 75.40 17.15 76.39 17.91 77.38 C18.68 78.37 20.70 79.37 21.64 80.36 C22.58 81.35 23.18 82.34 23.56 83.33 C23.94 84.33 23.84 85.32 23.94 86.31 C24.04 87.30 23.69 88.29 24.17 89.29 C24.65 90.28 25.76 91.27 26.82 92.26 C27.87 93.25 29.24 94.25 30.49 95.24 C31.74 96.23 33.34 97.22 34.32 98.21 C35.31 99.21 35.90 100.20 36.42 101.19 C36.95 102.18 37.43 103.17 37.47 104.17 C37.51 105.16 37.27 106.15 36.65 107.14 C36.03 108.13 34.68 109.13 33.75 110.12 C32.81 111.11 31.75 112.10 31.02 113.10 C30.28 114.09 29.51 115.08 29.35 116.07 C29.19 117.06 29.63 118.06 30.06 119.05 C30.49 120.04 31.39 121.03 31.93 122.02 C32.47 123.02 27.63 124.50 33.31 125.00 C38.98 125.50 60.26 125.50 65.96 125.00 C71.66 124.50 66.89 123.02 67.52 122.02 C68.16 121.03 69.22 120.04 69.76 119.05 C70.30 118.06 70.84 117.06 70.75 116.07 C70.66 115.08 69.95 114.09 69.24 113.10 C68.52 112.10 67.43 111.11 66.47 110.12 C65.50 109.13 64.10 108.13 63.45 107.14 C62.80 106.15 62.53 105.16 62.55 104.17 C62.57 103.17 63.03 102.18 63.56 101.19 C64.08 100.20 64.68 99.21 65.67 98.21 C66.67 97.22 68.27 96.23 69.52 95.24 C70.78 94.25 72.16 93.25 73.21 92.26 C74.27 91.27 75.38 90.28 75.86 89.29 C76.34 88.29 75.99 87.30 76.09 86.31 C76.19 85.32 76.09 84.33 76.47 83.33 C76.85 82.34 77.45 81.35 78.39 80.36 C79.33 79.37 81.35 78.37 82.12 77.38 C82.88 76.39 83.14 75.40 82.97 74.40 C82.79 73.41 81.80 72.42 81.06 71.43 C80.32 70.44 78.96 69.44 78.54 68.45 C78.11 67.46 78.22 66.47 78.52 65.48 C78.82 64.48 79.72 63.49 80.34 62.50 C80.95 61.51 82.13 60.52 82.21 59.52 C82.29 58.53 81.41 57.54 80.83 56.55 C80.24 55.56 79.14 54.56 78.71 53.57 C78.27 52.58 77.94 51.59 78.21 50.60 C78.48 49.60 79.64 48.61 80.33 47.62 C81.02 46.63 82.22 45.63 82.35 44.64 C82.48 43.65 81.73 42.66 81.11 41.67 C80.50 40.67 79.09 39.68 78.65 38.69 C78.21 37.70 78.00 36.71 78.46 35.71 C78.93 34.72 80.64 33.73 81.43 32.74 C82.23 31.75 83.06 30.75 83.23 29.76 C83.41 28.77 83.12 27.78 82.48 26.79 C81.84 25.79 80.38 24.80 79.42 23.81 C78.46 22.82 77.24 21.83 76.72 20.83 C76.21 19.84 76.43 18.85 76.32 17.86 C76.21 16.87 76.43 15.87 76.07 14.88 C75.71 13.89 75.27 12.90 74.16 11.90 C73.06 10.91 70.87 9.92 69.44 8.93 C68.01 7.94 66.77 6.94 65.57 5.95 C64.37 4.96 63.01 3.97 62.23 2.98 C61.44 1.98 64.69 0.50 60.84 0.00 C56.99 -0.50 42.95 -0.50 39.12 0.00 Z")' } as React.CSSProperties} />
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
        <script dangerouslySetInnerHTML={{ __html: `(function(){function inject(){try{var r=localStorage.getItem('pjl_branding');if(!r)return;var b=JSON.parse(r);var u=b&&b.mainLogo;if(!u)return;var f=document.querySelector('.splash-logo-fallback');if(!f)return;if(f.querySelector('img'))return;var img=document.createElement('img');img.src=u;img.alt='Logotipo de la Pastoral Juvenil Luqueña';img.className='splash-logo-img';img.onload=function(){if(f.isConnected)f.replaceWith(img)};img.onerror=function(){};if(img.complete&&img.naturalWidth>0)setTimeout(function(){if(f.isConnected)f.replaceWith(img)},0)}catch(e){}}inject();setTimeout(inject,300);setTimeout(inject,1200);window.addEventListener('load',inject);window.addEventListener('pjl_store_update',function(){setTimeout(inject,50)});window.addEventListener('storage',function(e){if(e.key==='pjl_branding')setTimeout(inject,50)})})();` }} />
        <ThemeLoader />
        <PwaIconSync />
        {/* Registro del Service Worker (PWA instalable / offline shell).
            Se registra en producción/*seguro y con soporte del navegador.
            Registro TEMPRANO (no espera window.load) para que Chrome
            evalúe la web como instalable lo antes posible. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(function(r){r.update()}).catch(function(){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(function(){})});});}})();` }}
        />
        <PwaInstallPrompt />
        <InstalledToast />
        <UpdatePrompt />
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
