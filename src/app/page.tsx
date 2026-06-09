/* eslint-disable @typescript-eslint/no-unused-vars, @next/next/no-img-element, @typescript-eslint/ban-ts-comment, react-hooks/exhaustive-deps */
'use client';

import { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  store, NewsItem, Activity, FaqItem, SiteContent, DocItem, MemberProfile, Chapel, Branding, ThemePalette, TimelineEvent, HeroSlide,
  DEFAULT_CONTENT, DEFAULT_NEWS, DEFAULT_ACTIVITIES, DEFAULT_FAQ, DEFAULT_SOCIAL, SocialLinks, DEFAULT_BRANDING, DEFAULT_CHAPELS
} from '@/lib/pjlStore';
import Link from 'next/link';
import Script from 'next/script';

const ZonaMap = dynamic(() => import('@/components/ZonaMap'), { ssr: false, loading: () => <div style={{ height: '500px', background: 'var(--cream)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Cargando mapa...</div> });

const STAT_LABELS: Record<string, string> = {
  '/': 'Página Principal',
  '/agenda': 'Agenda / Calendario',
  '/noticias': 'Noticias',
  '/zonas': 'Zonas Pastorales',
  '/curriculos': 'Currículos',
  '/documentos': 'Documentos',
  '/mision': 'Misión / Visión',
  '/contacto': 'Contacto',
  '/estatuto': 'Estatuto',
  '/historia': 'Historia',
  '/institucional': 'Institucional',
  '/consejo': 'Consejo PJL',
  '/equipos': 'Equipos',
  '/preguntas': 'Preguntas Frecuentes',
  '/faq': 'Preguntas Frecuentes',
  '/home': 'Página Principal',
};

const humanizeStatLabel = (path: string) => {
  if (STAT_LABELS[path]) return STAT_LABELS[path];
  const clean = path.replace(/^\//, '');
  if (!clean) return 'Página Principal';
  return clean
    .split(/[-_]/g)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const mapHeroPosition = (position?: string) => {
  switch (position) {
    case 'Top':
      return 'center top';
    case 'Bottom':
      return 'center bottom';
    case 'Left':
      return 'left center';
    case 'Right':
      return 'right center';
    default:
      return 'center center';
  }
};

const detectDeviceType = () => {
  if (typeof window === 'undefined') return 'desktop' as const;
  const ua = window.navigator.userAgent.toLowerCase();
  const width = window.innerWidth;

  if (/ipad|tablet/.test(ua) || (width >= 768 && width <= 1024 && /android/.test(ua))) return 'tablet' as const;
  if (/mobi|iphone|ipod|android/.test(ua) || width < 768) return 'mobile' as const;
  return 'desktop' as const;
};


function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPage = searchParams.get('page') || 'home';
  const [selectedZone, setSelectedZone] = useState<number | null>(null);

  // --- STATE ---
  const [fontSize, setFontSize] = useState(16);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [activeZoneTab, setActiveZoneTab] = useState<'capillas' | 'coordination' | 'mapa' | 'comunidades'>('capillas');
  const [selectedProfile, setSelectedProfile] = useState<MemberProfile | null>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<TimelineEvent | null>(null);
  const [activeConsejoTab, setActiveConsejoTab] = useState('coordinacion');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [globalCommFilter, setGlobalCommFilter] = useState<number | 'all'>('all');

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileSubmenuOpen, setMobileSubmenuOpen] = useState<Record<string, boolean>>({});
  const toggleMobileSubmenu = (key: string) => {
    setMobileSubmenuOpen(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Reset selected zone when leaving zones page
  useEffect(() => {
    if (currentPage !== 'zonas') {
      queueMicrotask(() => setSelectedZone(null));
    }
  }, [currentPage]);

  const [liveSocial, setLiveSocial] = useState<SocialLinks>(DEFAULT_SOCIAL);
  const [liveChapels, setLiveChapels] = useState<Chapel[]>([]);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [siteContent, setSiteContent] = useState<SiteContent>(DEFAULT_CONTENT);
  const [liveActivities, setLiveActivities] = useState<Activity[]>([]);
  const [liveNews, setLiveNews] = useState<NewsItem[]>([]);
  const [liveFaq, setLiveFaq] = useState<FaqItem[]>([]);
  const [liveProfiles, setLiveProfiles] = useState<MemberProfile[]>([]);
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [liveHeroImages, setLiveHeroImages] = useState<HeroSlide[]>([]);
  const [heroIntervalSecs, setHeroIntervalSecs] = useState<number>(3);
  const [liveHeroIndex, setLiveHeroIndex] = useState(0);

  // Prevent background scrolling when modals or mobile menu is open
  useEffect(() => {
    if (selectedProfile || selectedHistoryItem || selectedNews || isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [selectedProfile, selectedHistoryItem, selectedNews, isMobileMenuOpen]);

  // --- SYNC LOGIC ---
  const syncData = () => {
    const newContent = store.content.get();
    const newActivities = store.activities.get().filter(a => a.active);
    const newNews = store.news.get().filter(n => n.published);
    const newFaq = store.faq.get();
    const newProfiles = store.profiles.get();
    const newBranding = store.branding.get();
    const newHero = store.hero.get() || [];
    const newHeroInterval = store.heroInterval.get() || 3;
    const newSocial = store.social.get();
    const newChapels = store.chapels.get();

    // Only update if stringified value changed to avoid unnecessary interval resets
    setSiteContent(prev => JSON.stringify(prev) !== JSON.stringify(newContent) ? newContent : prev);
    setLiveActivities(prev => JSON.stringify(prev) !== JSON.stringify(newActivities) ? newActivities : prev);
    setLiveNews(prev => JSON.stringify(prev) !== JSON.stringify(newNews) ? newNews : prev);
    setLiveFaq(prev => JSON.stringify(prev) !== JSON.stringify(newFaq) ? newFaq : prev);
    setLiveProfiles(prev => JSON.stringify(prev) !== JSON.stringify(newProfiles) ? newProfiles : prev);
    setBranding(prev => JSON.stringify(prev) !== JSON.stringify(newBranding) ? newBranding : prev);
    setLiveHeroImages(prev => JSON.stringify(prev) !== JSON.stringify(newHero) ? newHero : prev);
    setHeroIntervalSecs(prev => prev !== newHeroInterval ? newHeroInterval : prev);
    setLiveSocial(prev => JSON.stringify(prev) !== JSON.stringify(newSocial) ? newSocial : prev);
    setLiveChapels(prev => JSON.stringify(prev) !== JSON.stringify(newChapels) ? newChapels : prev);
  };

  useEffect(() => {
    // Small delay to avoid 'setState in effect' warning for synchronous mount sync
    const timer = setTimeout(syncData, 0);
    const interval = setInterval(syncData, 5000);
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith('pjl_')) syncData();
    };
    const onCustomUpdate = () => syncData();

    window.addEventListener('storage', onStorage);
    window.addEventListener('pjl_store_update', onCustomUpdate);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pjl_store_update', onCustomUpdate);
    };
  }, []);

  // --- AUTO-SLIDE HERO BANNER ---
  useEffect(() => {
    if (liveHeroImages.length <= 1) return;
    
    const interval = setInterval(() => {
      setLiveHeroIndex(prev => (prev + 1) % liveHeroImages.length);
    }, heroIntervalSecs * 1000);

    return () => clearInterval(interval);
  }, [liveHeroImages.length, heroIntervalSecs]);

  // --- INTERSECTION OBSERVER FOR EXQUISITE SCROLL ANIMATIONS ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

    const reveals = document.querySelectorAll('.reveal');
    reveals.forEach(r => observer.observe(r));

    return () => observer.disconnect();
  }, [currentPage, activeZoneTab, activeConsejoTab, selectedZone, globalCommFilter, liveChapels]);

  // --- INTERACTION TRACKING ---
  const updateStat = (id: string, field: 'visits' | 'interactions') => {
    try {
      const mappedId = id === 'home' ? '/' : id.startsWith('/') ? id : `/${id}`;
      const deviceType = detectDeviceType();
      const s = [...store.stats.get()];
      let existing = s.find(x => x.page === mappedId);

      if (!existing) {
        existing = { page: mappedId, label: humanizeStatLabel(mappedId), visits: 0, interactions: 0, desktopVisits: 0, tabletVisits: 0, mobileVisits: 0 };
        s.push(existing);
      }

      existing[field] += 1;
      if (field === 'visits') {
        if (deviceType === 'desktop') existing.desktopVisits = (existing.desktopVisits || 0) + 1;
        if (deviceType === 'tablet') existing.tabletVisits = (existing.tabletVisits || 0) + 1;
        if (deviceType === 'mobile') existing.mobileVisits = (existing.mobileVisits || 0) + 1;
      }
      store.stats.set(s);
    } catch (e) {}
  };

  const trackVisit = (id: string) => {
    updateStat(id, 'visits');
  };

  const trackInteraction = (id: string) => {
    try {
      const mappedId = id === 'home' ? '/' : `/${id}`;
      updateStat(mappedId, 'interactions');
    } catch (e) {}
  };

  useEffect(() => {
    trackVisit(currentPage);
  }, [currentPage]);

  // --- VATICAN WIDGET SCRIPT ---
  useEffect(() => {
    const scriptId = 'vatican-news-script';
    if (document.getElementById(scriptId)) return;
    
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = "https://www.vaticannews.va/etc.clientlibs/vaticannews/clientlibs/vaticannews-widgets/vaticannews-widget.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // --- UI ACTIONS ---
  const navigate = (id: string, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    trackInteraction(id);
    
    // Si ya estamos en la página y es 'zonas', reseteamos la selección
    if (id === 'zonas') setSelectedZone(null);
    
    // Si es un ID de sección (ancla), desplazamos suavemente
    const section = document.getElementById(id);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    router.push(`/?page=${id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleContrast = () => setIsHighContrast(!isHighContrast);
  const changeFont = (delta: number) => setFontSize((prev) => Math.max(12, Math.min(24, prev + delta)));

  const handleDownload = (data: string, filename: string) => {
    if (!data) return;
    const link = document.createElement('a');
    link.href = data;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Truncate bio to first sentence or 120 chars, with ellipsis
  const truncateBio = (bio: string, limit = 110) => {
    if (!bio) return '';
    const dot = bio.indexOf('.');
    const cut = dot > 0 && dot < limit ? dot + 1 : limit;
    return bio.length <= cut ? bio : bio.slice(0, cut).trimEnd() + '...';
  };

  // --- DATA ---
  const zonasInfo = [
    { id: 1, name: 'San Miguel' },
    { id: 2, name: 'San Rafael' },
    { id: 3, name: 'San Gabriel' },
    { id: 4, name: 'Zona Urbana' }
  ];

  const councilTabs = [
    { id: 'coordinacion', label: 'Coordinación' },
    { id: 'efo', label: 'EFO' },
    { id: 'ecomu', label: 'ECOMU' },
    { id: 'eli', label: 'ELI' },
    { id: 'mmpjl', label: 'Música' },
    { id: 'representantes', label: 'Representantes' }
  ];

  const zoneColors = {
    1: branding.zona1Color || '#C8973A',
    2: branding.zona2Color || '#C8973A',
    3: branding.zona3Color || '#C8973A',
    4: branding.zona4Color || '#C8973A'
  };
  const activeHeroSlide = liveHeroImages[liveHeroIndex];
  const activeHeroPosition = activeHeroSlide
    ? mapHeroPosition(typeof window !== 'undefined' && window.innerWidth <= 768 ? activeHeroSlide.mobilePosition : activeHeroSlide.desktopPosition)
    : 'center center';

  return (
    <div className={isHighContrast ? 'high-contrast' : ''} style={{ '--font-size-base': `${fontSize}px` } as React.CSSProperties}>
      
      {/* FLOATING PERSISTENT LOGO */}
      {branding.mainLogo && (
        <div style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          width: '60px',
          height: '60px',
          zIndex: 9999,
          borderRadius: '50%',
          background: 'var(--white)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          padding: '8px',
          border: '2px solid var(--gold-pale)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }} 
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1) rotate(5deg)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1) rotate(0deg)')}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        title="Volver al inicio"
        >
          <img
            src={branding.mainLogo}
            className="logo-img-circular"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            alt="Logo flotante"
          />
        </div>
      )}

      {/* BRANDING WATERMARK */}
      {branding.logoWatermark && branding.mainLogo && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '800px',
          height: '800px',
          backgroundImage: `url(${branding.mainLogo})`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.02,
          pointerEvents: 'none',
          zIndex: -1
        }}></div>
      )}

      {/* 1. TOPBAR ACCESIBILIDAD */}
      <div className="a11y-bar">
        <div className="container">
          <button onClick={() => changeFont(1)} className="a11y-btn">A+</button>
          <button onClick={() => changeFont(-1)} className="a11y-btn">A-</button>
          <button onClick={toggleContrast} className="a11y-btn">Alto Contraste</button>
          <Link href="/admin" className="a11y-btn">⚙ Panel Admin</Link>
        </div>
      </div>

      {/* 2. NAVBAR REFINADA */}
      <nav className="top-nav">
        <div className="container nav-content">
          <div className="logo-area" style={{ cursor: 'pointer' }} onClick={() => navigate('home')}>
            {branding.mainLogo ? <img src={branding.mainLogo} className="logo-img-circular" style={{ height: '60px', width: '60px' }} alt="Logotipo Principal PJL" /> : <div style={{ fontSize: '30px' }}>†</div>}
            <div>
              <h1>PJL LUQUE</h1>
              <p>Pastoral Juvenil Luqueña</p>
            </div>
          </div>
          <button 
            className={`mobile-menu-toggle ${isMobileMenuOpen ? 'active' : ''}`} 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Abrir menú"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          <ul className="nav-links">
            <li className="nav-item">
              <Link href="/" onClick={(e) => navigate('home', e)} className="nav-btn">🏠 Inicio</Link>
            </li>
            <li className="nav-item">
              <a href="#" className="nav-btn">📖 Nosotros ▾</a>
              <div className="dropdown-pjl">
                <Link href="/" onClick={(e) => navigate('estatuto', e)} className="dropdown-link">Estatuto</Link>
                <Link href="/" onClick={(e) => navigate('historia', e)} className="dropdown-link">Nuestra Historia</Link>
                <Link href="/" onClick={(e) => navigate('institucional', e)} className="dropdown-link">Institucional</Link>
              </div>
            </li>
            <li className="nav-item">
              <a href="#" onClick={(e) => navigate('consejo', e)} className="nav-btn" data-tooltip="Conoce la estructura y líderes">👥 Consejo PJL ▾</a>
              <div className="dropdown-pjl">
                {councilTabs.map(t => (
                  <Link key={t.id} href="/" onClick={(e) => { navigate('consejo', e); setActiveConsejoTab(t.id); }} className="dropdown-link">{t.label}</Link>
                ))}
              </div>
            </li>
            <li className="nav-item">
              <a href="#" onClick={(e) => navigate('zonas', e)} className="nav-btn" data-tooltip="Explorar nuestras comunidades">🗺️ Zonas ▾</a>
              <div className="dropdown-pjl">
                {zonasInfo.map(z => (
                  <Link key={z.id} href="/" onClick={(e) => { setSelectedZone(z.id); navigate('zonas', e); }} className="dropdown-link">Zona {z.id} – {z.name}</Link>
                ))}
              </div>
            </li>
            <li className="nav-item">
              <Link href="/" onClick={(e) => navigate('agenda', e)} className="nav-btn">📅 Agenda</Link>
            </li>
            <li className="nav-item">
              <Link href="/" onClick={(e) => navigate('noticias', e)} className="nav-btn">📰 Noticias</Link>
            </li>
            <li className="nav-item">
              <Link href="/" onClick={(e) => navigate('contacto', e)} className="nav-btn">✉️ Contacto</Link>
            </li>

            <li className="nav-item">
              <a href="#" className="nav-btn">🇻🇦 Vaticano ▾</a>
              <div className="dropdown-pjl" style={{ minWidth: '220px', padding: '15px' }}>
                {/* @ts-ignore */}
                <vaticannews-widget lang="es" fontSize="18"></vaticannews-widget>
              </div>
            </li>
          </ul>
        </div>
      </nav>

      {/* MOBILE DRAWER */}
      {isMobileMenuOpen && (
        <div className="drawer-backdrop" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}
      <div className={`mobile-nav-drawer ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <div className="logo-area" style={{ cursor: 'pointer' }} onClick={() => { navigate('home'); setIsMobileMenuOpen(false); }}>
            {branding.mainLogo ? <img src={branding.mainLogo} className="logo-img-circular" style={{ height: '50px', width: '50px' }} alt="Logotipo Principal PJL" /> : <div style={{ fontSize: '24px' }}>†</div>}
            <div>
              <h2>PJL LUQUE</h2>
              <p>Pastoral Juvenil</p>
            </div>
          </div>
          <button className="drawer-close" onClick={() => setIsMobileMenuOpen(false)} aria-label="Cerrar menú">✕</button>
        </div>
        <div className="drawer-body">
          <ul className="drawer-links">
            <li>
              <Link href="/" onClick={(e) => { navigate('home', e); setIsMobileMenuOpen(false); }} className="drawer-btn">🏠 Inicio</Link>
            </li>
            
            <li>
              <button onClick={() => toggleMobileSubmenu('nosotros')} className="drawer-btn dropdown-toggle">
                <span>📖 Nosotros</span>
                <span>{mobileSubmenuOpen['nosotros'] ? '▴' : '▾'}</span>
              </button>
              {mobileSubmenuOpen['nosotros'] && (
                <ul className="drawer-sublinks">
                  <li>
                    <Link href="/" onClick={(e) => { navigate('estatuto', e); setIsMobileMenuOpen(false); }} className="drawer-sublink">Estatuto</Link>
                  </li>
                  <li>
                    <Link href="/" onClick={(e) => { navigate('historia', e); setIsMobileMenuOpen(false); }} className="drawer-sublink">Nuestra Historia</Link>
                  </li>
                  <li>
                    <Link href="/" onClick={(e) => { navigate('institucional', e); setIsMobileMenuOpen(false); }} className="drawer-sublink">Institucional</Link>
                  </li>
                </ul>
              )}
            </li>

            <li>
              <button onClick={() => toggleMobileSubmenu('consejo')} className="drawer-btn dropdown-toggle">
                <span>👥 Consejo PJL</span>
                <span>{mobileSubmenuOpen['consejo'] ? '▴' : '▾'}</span>
              </button>
              {mobileSubmenuOpen['consejo'] && (
                <ul className="drawer-sublinks">
                  {councilTabs.map(t => (
                    <li key={t.id}>
                      <Link href="/" onClick={(e) => { navigate('consejo', e); setActiveConsejoTab(t.id); setIsMobileMenuOpen(false); }} className="drawer-sublink">{t.label}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>

            <li>
              <button onClick={() => toggleMobileSubmenu('zonas')} className="drawer-btn dropdown-toggle">
                <span>🗺️ Zonas</span>
                <span>{mobileSubmenuOpen['zonas'] ? '▴' : '▾'}</span>
              </button>
              {mobileSubmenuOpen['zonas'] && (
                <ul className="drawer-sublinks">
                  {zonasInfo.map(z => (
                    <li key={z.id}>
                      <Link href="/" onClick={(e) => { setSelectedZone(z.id); navigate('zonas', e); setIsMobileMenuOpen(false); }} className="drawer-sublink">Zona {z.id} – {z.name}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>

            <li>
              <Link href="/" onClick={(e) => { navigate('agenda', e); setIsMobileMenuOpen(false); }} className="drawer-btn">📅 Agenda</Link>
            </li>
            <li>
              <Link href="/" onClick={(e) => { navigate('noticias', e); setIsMobileMenuOpen(false); }} className="drawer-btn">📰 Noticias</Link>
            </li>
            <li>
              <Link href="/" onClick={(e) => { navigate('contacto', e); setIsMobileMenuOpen(false); }} className="drawer-btn">✉️ Contacto</Link>
            </li>

            <li>
              <button onClick={() => toggleMobileSubmenu('vaticano')} className="drawer-btn dropdown-toggle">
                <span>🇻🇦 Vaticano</span>
                <span>{mobileSubmenuOpen['vaticano'] ? '▴' : '▾'}</span>
              </button>
              {mobileSubmenuOpen['vaticano'] && (
                <div className="drawer-vatican-widget" style={{ padding: '10px 15px' }}>
                  {/* @ts-ignore */}
                  <vaticannews-widget lang="es" fontSize="16"></vaticannews-widget>
                </div>
              )}
            </li>
          </ul>
        </div>
      </div>

      {/* VATICAN SCRIPT */}
      <Script src="https://www.vaticannews.va/widget.js" strategy="lazyOnload" />

      {/* 3. CONTENIDO PRINCIPAL */}
      <main>
        

        {/* HOME PAGE */}
        {currentPage === 'home' && (
          <>
            <section className="hero-pjl" id="hero">
              <div className="hero-ornament"></div>
              
              {/* Images layer — absolute, full cover */}
              <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
                {liveHeroImages.map((slide, i) => (
                  <div key={slide.id || i} style={{ position: 'absolute', inset: 0, opacity: i === liveHeroIndex ? 1 : 0, transition: 'opacity 1.2s ease-in-out' }}>
                    <img src={slide.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: i === liveHeroIndex ? activeHeroPosition : 'center center', display: 'block' }} alt="" />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg, rgba(26,39,68,0.88) 0%, rgba(26,39,68,0.55) 55%, rgba(26,39,68,0.25) 100%)' }} />
                  </div>
                ))}
                {liveHeroImages.length === 0 && <div style={{ position: 'absolute', inset: 0, background: 'var(--navy)' }} />}
              </div>

              {/* Content layer — always above images */}
              <div className="container" style={{ position: 'relative', zIndex: 10, padding: '130px 30px 170px' }}>
                {liveHeroImages.length > 0 && (
                  <div className="reveal hero-slide-meta" style={{ animationDelay: '0.1s' }}>
                    Slide {liveHeroIndex + 1} de {liveHeroImages.length}
                  </div>
                )}
                <span className="hero-tag reveal">{siteContent.heroTag}</span>
                <h2 className="reveal" style={{ animationDelay: '0.2s', marginBottom: '20px', fontSize: '68px', lineHeight: 1.05, color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 900 }}>
                  {activeHeroSlide?.title
                    ? <span dangerouslySetInnerHTML={{ __html: activeHeroSlide.title }} />
                    : <span dangerouslySetInnerHTML={{ __html: siteContent.heroTitle || '' }} />
                  }
                </h2>
                <p className="reveal" style={{ animationDelay: '0.4s', marginBottom: '35px', fontSize: '1.15rem', maxWidth: '580px', lineHeight: '1.75', color: 'rgba(255,255,255,0.85)' }}>
                  {activeHeroSlide?.subtitle || siteContent.heroText}
                </p>
                <div className="reveal hero-cta-group" style={{ animationDelay: '0.6s', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  {activeHeroSlide?.buttonText ? (
                    <button className="btn-pjl hero-primary-cta" style={{ padding: '15px 40px', background: 'var(--gold)', color: 'var(--navy)', fontWeight: 700, borderRadius: '8px' }} onClick={() => navigate(activeHeroSlide.buttonLink?.replace('/', '') || 'contacto')}>{activeHeroSlide.buttonText}</button>
                  ) : (
                    <>
                      <button className="btn-pjl hero-primary-cta" style={{ padding: '15px 40px', background: 'var(--gold)', color: 'var(--navy)', fontWeight: 700, borderRadius: '8px' }} onClick={() => navigate('estatuto')}>Conocer Estatuto</button>
                      <button className="btn-pjl hero-secondary-cta" style={{ padding: '15px 40px', border: '2px solid rgba(255,255,255,0.8)', color: '#fff', borderRadius: '8px' }} onClick={() => navigate('contacto')}>Contáctanos</button>
                    </>
                  )}
                </div>
                {liveHeroImages.length > 1 && (
                  <div className="hero-controls" style={{ display: 'flex', gap: '8px', marginTop: '50px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="hero-nav-arrow"
                      onClick={() => setLiveHeroIndex(prev => (prev - 1 + liveHeroImages.length) % liveHeroImages.length)}
                      aria-label="Slide anterior"
                    >
                      ‹
                    </button>
                    {liveHeroImages.map((_, i) => (
                      <button key={i} onClick={() => setLiveHeroIndex(i)} style={{ width: i === liveHeroIndex ? '28px' : '8px', height: '8px', borderRadius: '4px', background: i === liveHeroIndex ? 'var(--gold)' : 'rgba(255,255,255,0.35)', border: 'none', cursor: 'pointer', transition: 'all 0.3s ease', padding: 0 }} />
                    ))}
                    <button
                      type="button"
                      className="hero-nav-arrow"
                      onClick={() => setLiveHeroIndex(prev => (prev + 1) % liveHeroImages.length)}
                      aria-label="Slide siguiente"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* MISIÓN VISIÓN VALORES */}
            <section className="section-pjl" style={{ background: 'var(--cream)' }} id="identidad">
              <div className="container">
                <div className="section-head reveal" onClick={() => navigate('identidad')} style={{ cursor: 'pointer' }}>
                  <span style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 700, letterSpacing: '2px', color: 'var(--gold)', textTransform: 'uppercase' }}>NUESTRA IDENTIDAD</span>
                  <h3 style={{ margin: '10px 0' }}>Misión, <i style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)', fontWeight: 400 }}>Visión</i> y Valores</h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Los pilares que guían el caminar de la Pastoral Juvenil Luqueña.</p>
                  <div className="line" style={{ margin: '0 auto' }}></div>
                </div>
                <div className="mvv-grid">
                  <div className="mvv-card reveal glass-panel" style={{ animationDelay: '0.1s' }}>
                    <h4>Misión</h4>
                    <p>{siteContent.mision || 'Acompañar a los jóvenes de la ciudad de Luque en su proceso de fe, formación integral y compromiso cristiano, desde los valores del Evangelio.'}</p>
                  </div>
                  <div className="mvv-card reveal glass-panel" style={{ animationDelay: '0.2s' }}>
                    <h4>Visión</h4>
                    <p>{siteContent.vision || 'Ser una pastoral juvenil dinámica, inclusiva y transformadora, que forme jóvenes líderes capaces de incidir positivamente en su comunidad.'}</p>
                  </div>
                  <div className="mvv-card reveal glass-panel" style={{ animationDelay: '0.3s' }}>
                    <h4>Valores</h4>
                    <p>{siteContent.valores || 'Empatía, Servicio, Responsabilidad, Amor al prójimo, Respeto, Trabajo en equipo y Alegría cristiana.'}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* INSTITUCIONAL SECTION */}
            <section className="section-pjl" style={{ overflow: 'hidden' }} id="institucional">
              <div className="container">
                <div className="insti-premium-layout reveal">
                  <div className="insti-text-side">
                    <div className="section-head" onClick={() => navigate('institucional')} style={{ textAlign: 'left', padding: '0', background: 'none', border: 'none', boxShadow: 'none', margin: '0 0 40px 0', maxWidth: '100%', cursor: 'pointer' }}>
                      <span className="premium-label" style={{ color: 'var(--gold)' }}>HISTORIA Y LEGADO</span>
                      <h3 style={{ fontSize: '2.5rem', marginBottom: '15px' }}>{siteContent.instiTitulo || 'Nuestra Institución'}</h3>
                      <div className="line" style={{ width: '80px', marginLeft: '0' }}></div>
                    </div>
                    <div className="insti-description" style={{ fontSize: '1.1rem', lineHeight: '1.8', color: 'var(--navy)', marginBottom: '40px', textAlign: 'justify', maxHeight: '400px', overflowY: 'auto', paddingRight: '15px' }}>
                      {siteContent.instiDesc}
                    </div>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                      <button className="btn-premium btn-premium-gold" onClick={() => navigate('historia')}>NUESTRA TRAYECTORIA</button>
                      <button className="btn-premium btn-premium-outline" onClick={() => navigate('estatuto')}>MARCO LEGAL</button>
                    </div>
                  </div>
                  <div className="insti-visual-side">
                    <div className="image-frame">
                      <div className="frame-decoration"></div>
                      <img src={siteContent.instiFoto || 'https://images.unsplash.com/photo-1544427928-c49cdfebf193?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80'} alt="Imagen Institucional PJL" className="main-insti-img" />
                      <div className="years-badge">
                        <span className="number">{siteContent.statsAnos || '20'}</span>
                        <span className="label">AÑOS DE FE</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* EQUIPOS Y CONSEJO */}
            <section className="section-pjl" id="equipos">
              <div className="container">
                <div className="section-head reveal" onClick={() => navigate('equipos')} style={{ textAlign: 'center', cursor: 'pointer' }}>
                  <span style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 700, letterSpacing: '2px', color: 'var(--gold)', textTransform: 'uppercase' }}>{siteContent.equiposTag}</span>
                  <h3 style={{ margin: '10px 0' }} dangerouslySetInnerHTML={{ __html: siteContent.equiposTitle || '' }}></h3>
                  <div className="line" style={{ margin: '0 auto' }}></div>
                </div>
                <div className="mvv-grid">
                  {/* EFO */}
                  <div className="mvv-card reveal" style={{ textAlign: 'center' }}>
                    <h4>Equipo de Formación</h4>
                    <p style={{ marginBottom: '25px', minHeight: '90px' }}>Responsable de los procesos formativos, retiros, talleres y capacitaciones para los jóvenes de la PJL.</p>
                    <button className="btn-pjl" style={{ padding: '8px 25px', border: '1px solid var(--gold-pale)', color: 'var(--navy)', fontSize: '14px', borderRadius: '4px', fontWeight: 600 }} onClick={() => { setActiveConsejoTab('efo'); navigate('consejo'); }}>Explorar EFO</button>
                  </div>
                  {/* ECO */}
                  <div className="mvv-card reveal" style={{ textAlign: 'center', animationDelay: '0.1s' }}>
                    <h4>Equipo de Comunicación</h4>
                    <p style={{ marginBottom: '25px', minHeight: '90px' }}>Gestiona las redes sociales, el boletín parroquial y toda la comunicación institucional de la PJL.</p>
                    <button className="btn-pjl" style={{ padding: '8px 25px', border: '1px solid var(--gold-pale)', color: 'var(--navy)', fontSize: '14px', borderRadius: '4px', fontWeight: 600 }} onClick={() => { setActiveConsejoTab('ecomu'); navigate('consejo'); }}>Explorar ECOMU</button>
                  </div>
                  {/* CPJ */}
                  <div className="mvv-card reveal" style={{ textAlign: 'center', animationDelay: '0.2s' }}>
                    <h4>Consejo Pastoral</h4>
                    <p style={{ marginBottom: '25px', minHeight: '90px' }}>Órgano de gobierno y planificación estratégica de la Pastoral Juvenil Luqueña a nivel general.</p>
                    <button className="btn-pjl" style={{ padding: '8px 25px', border: '1px solid var(--gold-pale)', color: 'var(--navy)', fontSize: '14px', borderRadius: '4px', fontWeight: 600 }} onClick={() => { setActiveConsejoTab('coordinacion'); navigate('consejo'); }}>Ver Miembros</button>
                  </div>
                </div>
              </div>
            </section>

            {/* GRID DE ZONAS */}
            <section className="section-pjl" style={{ background: '#fff' }}>
              <div className="container">
                <div className="section-head reveal">
                  <span className="premium-label">{siteContent.zonasTag}</span>
                  <h3 dangerouslySetInnerHTML={{ __html: siteContent.zonasTitle || '' }}></h3>
                  <div className="line"></div>
                </div>
                <div className="zone-grid">
                  {zonasInfo.map((z, idx) => {
                    const zoneChapels = liveChapels.filter(chap => chap.zonaId === z.id);
                    const total = zoneChapels.length;
                    const activos = zoneChapels.filter(c => c.estadoComunidad === 'Activo').length;
                    const nucleacion = zoneChapels.filter(c => c.estadoComunidad === 'Nucleación').length;

                    return (
                      <div key={z.id} className="zone-card reveal" style={{ animationDelay: `${idx * 0.1}s` }}>
                        <div className="zone-card-header">
                          <h4>Zona {z.id}</h4>
                          {branding[`zona${z.id}Logo`] && <img src={branding[`zona${z.id}Logo`] as string} className="logo-img-circular" style={{ height: '40px', width: '40px' }} alt={`Logo zona ${z.id}`} />}
                        </div>
                        <div className="zone-card-body">
                          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--gold)', marginBottom: '5px', fontSize: '18px' }}>{z.name}</p>

                          <div className="zone-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '18px', color: 'var(--navy)', fontSize: '13px', fontWeight: 600 }}>
                            <span>{total} comunidades</span>
                            <span>{activos} activas</span>
                            <span>{nucleacion} nucleación</span>
                          </div>

                          <div style={{ marginTop: '0', marginBottom: '20px' }}>
                            <button className="btn-premium btn-premium-gold" style={{ width: '100%', fontSize: '12px', borderRadius: '999px', padding: '14px 18px' }} onClick={() => { setSelectedZone(z.id); navigate('zonas'); }}>
                              VER COMUNIDADES
                            </button>
                          </div>

                          <div className="zone-info" style={{ maxHeight: '140px', overflowY: 'auto', marginBottom: '15px' }}>
                            {zoneChapels.slice(0, 3).map((c, i) => (
                              <div key={i} className="zone-info-row">
                                <span>{c.name}</span>
                              </div>
                            ))}
                            {total > 3 && <p style={{ fontSize: '12px', color: 'var(--navy)', margin: '10px 0 0' }}>+ {total - 3} más...</p>}
                          </div>
                          <button className="pjl-link" style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--gold)', border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => { setSelectedZone(z.id); navigate('zonas'); }}>Explorar zona →</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* NOTICIAS Y AGENDA SECTION */}
            <section className="section-pjl" style={{ background: 'var(--cream)' }}>
              <div className="container agenda-split">
                {/* Column 1: News */}
                <div>
                  {/* VATICAN WIDGET EN NOTICIAS */}
                  <div className="vatican-widget-shell" style={{ marginBottom: '30px', background: 'var(--white)', padding: '15px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', overflow: 'hidden', width: '100%', maxHeight: '400px' }}>
                     {/* @ts-ignore */}
                     <vaticannews-widget lang="es" fontSize="18"></vaticannews-widget>
                  </div>

                  <div className="section-head reveal">
                    <span style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 700, letterSpacing: '2px', color: 'var(--gold)', textTransform: 'uppercase' }}>{siteContent.newsTag}</span>
                    <h3 style={{ margin: '10px 0' }} dangerouslySetInnerHTML={{ __html: siteContent.newsTitle || '' }}></h3>
                    <div className="line"></div>
                  </div>
                  <div style={{ display: 'grid', gap: '30px' }}>
                    {liveNews.slice(0, 2).map((n, i) => (
                      <div key={n.id} className="news-highlight reveal" style={{ animationDelay: `${i * 0.1}s`, cursor: 'pointer', transition: '0.3s transform' }}
                           onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
                           onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                           onClick={() => navigate('noticias')}>
                        <span className="date">
                          {new Date(n.date).toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </span>
                        <h4>{n.title}</h4>
                        <p>{n.body.substring(0, 150)}...</p>
                        <Link href="/" onClick={(e) => { e.stopPropagation(); navigate('noticias', e); }}>Leer artículo completo <span style={{ fontSize: '16px' }}>➞</span></Link>
                      </div>
                    ))}
                    {liveNews.length === 0 && <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay noticias publicadas aún.</p>}
                  </div>
                  <div style={{ marginTop: '30px' }}>
                    <button className="btn-pjl" style={{ padding: '12px 30px', border: '1px solid var(--navy)', color: 'var(--navy)', background: 'transparent', fontWeight: 600, display: 'inline-block' }} onClick={() => navigate('noticias')}>+ Ver Todas las Noticias</button>
                  </div>
                </div>

                {/* Column 2: Agenda */}
                <div>
                  <div className="section-head reveal">
                    <span style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 700, letterSpacing: '2px', color: 'var(--gold)', textTransform: 'uppercase' }}>{siteContent.agendaTag}</span>
                    <h3 style={{ margin: '10px 0' }} dangerouslySetInnerHTML={{ __html: siteContent.agendaTitle || '' }}></h3>
                    <div className="line"></div>
                  </div>
                  <div className="timeline">
                    {liveActivities.slice(0, 3).map((a, i) => {
                      const dateObj = new Date(a.date);
                      return (
                        <div key={a.id} className="timeline-item reveal" style={{ animationDelay: `${i * 0.1}s` }}>
                          <div className="timeline-dot"></div>
                          <span className="timeline-date">{dateObj.toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                          <div className="timeline-card" onClick={() => navigate('agenda')} style={{ cursor: 'pointer', transition: '0.3s transform' }}
                               onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
                               onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
                            <h4>{a.title}</h4>
                            <p>{a.description || a.category}</p>
                          </div>
                        </div>
                      );
                    })}
                    {liveActivities.length === 0 && <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay eventos próximos agendados.</p>}
                  </div>

                  <div style={{ marginTop: '40px' }}>
                    <button className="btn-pjl" style={{ width: '100%', padding: '15px', background: 'var(--gold)', color: 'var(--navy)', fontWeight: 700, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }} onClick={() => navigate('agenda')}>
                      Ir a la Agenda Completa →
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ESTATUTO / OBJETIVO */}
        {currentPage === 'estatuto' && (
          <section className="section-pjl">
            <div className="container">
              <div className="section-head">
                <span className="premium-label">NORMATIVA</span>
                <h3>Estatuto y <i>Objetivos</i></h3>
                <div className="line"></div>
              </div>
              <div className="mvv-grid" style={{ marginBottom: '60px' }}>
                <div className="mvv-card" style={{ gridColumn: 'span 2' }}>
                  <h4>Objetivo General</h4>
                  <p>{siteContent.objetivoGeneral || DEFAULT_CONTENT.objetivoGeneral}</p>
                </div>
                <div className="mvv-card">
                  <h4>Líneas de Acción</h4>
                  <p>{siteContent.lineasAccion || DEFAULT_CONTENT.lineasAccion}</p>
                </div>
              </div>
              <div className="mvv-card" style={{ borderLeft: 'none', borderRight: '4px solid var(--gold)' }}>
                <h4>Cuerpo del Estatuto</h4>
                <p style={{ whiteSpace: 'pre-line' }}>{siteContent.estatuto || DEFAULT_CONTENT.estatuto}</p>
              </div>
            </div>
          </section>
        )}

        {/* HISTORIA - TIMELINE */}
        {currentPage === 'historia' && (
          <section className="section-pjl history-premium-section">
            <div className="container">
              <div className="section-head history-premium-head">
                <span className="premium-label">LEGADO</span>
                <h3>Nuestra <i>Historia</i></h3>
                <p style={{ color: 'var(--text-muted)', maxWidth: '640px', margin: '14px auto 0', fontSize: '15px', lineHeight: 1.8 }}>
                  Una línea de tiempo más visual y memorable para mostrar el crecimiento de la Pastoral Juvenil Luqueña.
                </p>
                <div className="line"></div>
              </div>
              <div className="timeline">
                {siteContent.historiaTimeline && siteContent.historiaTimeline.length > 0 ? (
                  siteContent.historiaTimeline.map((item, i) => (
                    <div 
                      key={item.id} 
                      className="timeline-item reveal" 
                      style={{ animationDelay: `${i * 0.1}s`, cursor: 'pointer' }}
                      onClick={() => setSelectedHistoryItem(item)}
                    >
                      <div className="timeline-dot" style={{ background: item.accentColor || 'var(--gold)' }}></div>
                      <span className="timeline-date">{item.title}</span>
                      <div
                        className="timeline-premium-card"
                        style={{ '--timeline-accent': item.accentColor || 'var(--gold)' } as any}
                      >
                        {item.image && (
                          <div className="timeline-premium-media">
                            <img src={item.image} alt={item.title} />
                          </div>
                        )}
                        <div className="timeline-premium-body">
                          <div className="timeline-premium-topline">
                            <span>Memoria pastoral</span>
                            <span>{String(i + 1).padStart(2, '0')}</span>
                          </div>
                          <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{item.text}</p>
                          <div className="timeline-premium-footer">
                            <span>Haz clic para ampliar</span>
                            <strong>Ver detalle</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '80px 0' }}>
                    <div style={{ fontSize: '60px', marginBottom: '20px' }}>📜</div>
                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '18px' }}>Nuestra historia se está escribiendo en el corazón de los jóvenes...</p>
                    <p style={{ fontSize: '14px', marginTop: '10px' }}>El administrador puede añadir eventos históricos desde el Panel Admin.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* --- PAGE: INSTITUCIONAL --- */}
        {currentPage === 'institucional' && (
          <section className="section-pjl">
             <div className="container">
                <div className="section-head reveal">
                  <span className="premium-label">ORGANIZACIÓN</span>
                  <h3>Estructura <i>Institucional</i></h3>
                  <div className="line"></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '60px', alignItems: 'center' }}>
                  <div className="reveal">
                    <h4 className="serif" style={{ fontSize: '32px', color: 'var(--navy)', marginBottom: '25px' }}>{siteContent.instiTitulo}</h4>
                    <p style={{ fontSize: '1.1rem', lineHeight: '1.8', color: 'var(--text-muted)', textAlign: 'justify', whiteSpace: 'pre-line' }}>{siteContent.instiDesc}</p>
                  </div>
                  <div className="reveal" style={{ animationDelay: '0.2s' }}>
                    <img src={siteContent.instiFoto} style={{ width: '100%', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }} alt="Imagen Institucional Secundaria" />
                  </div>
                </div>
             </div>
          </section>
        )}

        {/* ZONAS OVERVIEW - when no zone selected */}
        {currentPage === 'zonas' && !selectedZone && (
          <section className="section-pjl" id="zonas">
            <div className="container">
              <div className="section-head reveal" onClick={() => navigate('zonas')}>
                <span className="premium-label">TERRITORIO</span>
                <h3>Nuestras <i>Zonas Pastorales</i></h3>
                <div className="line"></div>
              </div>

              <div className="zone-grid">
                {zonasInfo.map((z, idx) => {
                  const zoneChapels = liveChapels.filter(chap => chap.zonaId === z.id);
                  const total = zoneChapels.length;
                  const activos = zoneChapels.filter(c => c.estadoComunidad === 'Activo').length;
                  const nucleacion = zoneChapels.filter(c => c.estadoComunidad === 'Nucleación').length;

                  return (
                    <div key={z.id} className="zone-card reveal" style={{ animationDelay: `${idx * 0.1}s`, cursor: 'pointer' }}
                         onClick={() => { setActiveZoneTab('capillas'); setSelectedZone(z.id); }}>
                      <div className="zone-card-header">
                        <h4>Zona {z.id}</h4>
                        {branding[`zona${z.id}Logo`] && <img src={branding[`zona${z.id}Logo`] as string} className="logo-img-circular" style={{ height: '40px', width: '40px' }} alt={`Logotipo de la Zona ${z.id}`} />}
                      </div>
                      <div className="zone-card-body">
                        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--gold)', marginBottom: '5px', fontSize: '18px' }}>{z.name}</p>
                        
                        {/* Estadísticas de Zona (Igual a Foto 2) */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px', marginTop: '15px', marginBottom: '15px' }}>
                          <div style={{ background: 'var(--cream)', padding: '10px 5px', borderRadius: '10px', textAlign: 'center', border: '1px solid var(--gold-pale)' }}>
                            <p style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--navy)' }}>{total}</p>
                            <p style={{ margin: 0, fontSize: '8px', fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase' }}>Total</p>
                          </div>
                          <div style={{ background: 'var(--cream)', padding: '10px 5px', borderRadius: '10px', textAlign: 'center', border: '1px solid var(--gold-pale)' }}>
                            <p style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--navy)' }}>{activos}</p>
                            <p style={{ margin: 0, fontSize: '8px', fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase' }}>Activos</p>
                          </div>
                          <div style={{ background: 'var(--cream)', padding: '10px 5px', borderRadius: '10px', textAlign: 'center', border: '1px solid var(--gold-pale)' }}>
                            <p style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--navy)' }}>{nucleacion}</p>
                            <p style={{ margin: 0, fontSize: '8px', fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase' }}>Nuc.</p>
                          </div>
                        </div>

                        <div className="zone-info" style={{ maxHeight: '100px', overflowY: 'auto', marginBottom: '15px' }}>
                          {zoneChapels.slice(0, 3).map((c, i) => (
                            <div key={i} style={{ marginBottom: '5px', fontSize: '12px' }}>
                              <span style={{ color: 'var(--navy)', fontWeight: 600 }}>{c.name}</span>
                            </div>
                          ))}
                          {total > 3 && <p style={{ fontSize: '11px', color: 'var(--gold)', margin: 0 }}>+ {total - 3} más...</p>}
                        </div>
                        <button className="btn-premium btn-premium-gold" style={{ marginTop: 'auto', width: '100%' }}
                                onClick={(e) => { e.stopPropagation(); setActiveZoneTab('capillas'); setSelectedZone(z.id); }}>
                          VER ZONA {z.id} →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* MAPA GENERAL DE ZONAS */}
              <div className="reveal" style={{ marginTop: '80px', marginBottom: '0' }}>
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                  <span className="premium-label" style={{ background: 'var(--cream)', color: 'var(--gold)', padding: '5px 15px', borderRadius: '20px' }}>MAPA TERRITORIAL</span>
                  <h3 className="serif" style={{ fontSize: '28px', color: 'var(--navy)', margin: '12px 0 8px' }}>Distribución de <i>Zonas Pastorales</i></h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Cada zona coloreada representa un territorio pastoral. Haz clic en los íconos para ver las capillas.</p>
                </div>
                <div style={{ borderRadius: '16px', overflow: 'hidden', border: '2px solid var(--gold-pale)', boxShadow: '0 15px 50px rgba(0,0,0,0.07)' }}>
                  <ZonaMap
                    chapels={liveChapels.map(c => ({ id: c.id, name: c.name, lat: c.lat, lng: c.lng, zonaId: c.zonaId, estadoComunidad: c.estadoComunidad, comunidadNombre: c.comunidadNombre }))}
                    selectedZone={null}
                    zoneColors={zoneColors}
                    height="480px"
                  />
                </div>
              </div>

              {/* LISTA GLOBAL DE COMUNIDADES (SOLICITADO) */}
              <div className="reveal" style={{ marginTop: '100px', background: '#fff', borderRadius: '24px', padding: '50px', border: '1px solid var(--gold-pale)', boxShadow: '0 20px 60px rgba(0,0,0,0.03)' }}>

                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                  <span className="premium-label" style={{ background: 'var(--cream)', color: 'var(--gold)', padding: '5px 15px', borderRadius: '20px' }}>ORGANIZACIÓN</span>
                  <h3 className="serif" style={{ fontSize: '32px', color: 'var(--navy)', margin: '15px 0' }}>Directorio General de <i>Comunidades</i></h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Encuentra a todos los grupos juveniles activos en nuestro territorio pastoral.</p>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '40px', flexWrap: 'wrap' }}>
                  <button onClick={() => setGlobalCommFilter('all')} className={`btn-premium ${globalCommFilter === 'all' ? 'btn-premium-gold' : 'btn-premium-outline'}`} style={{ padding: '8px 20px', fontSize: '13px' }}>Todas</button>
                  {[1,2,3,4].map(zId => (
                    <button key={zId} onClick={() => setGlobalCommFilter(zId)} className={`btn-premium ${globalCommFilter === zId ? 'btn-premium-gold' : 'btn-premium-outline'}`} style={{ padding: '8px 20px', fontSize: '13px' }}>Zona {zId}</button>
                  ))}
                </div>

                <div key={globalCommFilter} className="zone-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', animation: 'fadeOverlay 0.5s ease both' }}>
                  {liveChapels
                    .filter(c => c.comunidadNombre && (globalCommFilter === 'all' || c.zonaId == globalCommFilter))
                    .sort((a, b) => a.zonaId - b.zonaId || a.comunidadNombre.localeCompare(b.comunidadNombre))
                    .map((c, i) => (
                    <div key={c.id} style={{ 
                      padding: '20px', 
                      background: 'var(--cream)', 
                      borderRadius: '16px', 
                      border: '1px solid var(--gold-pale)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      cursor: 'pointer',
                      transition: '0.3s',
                      animation: `slideUpModal 0.4s ease both ${i * 0.05}s`
                    }} onClick={() => { setSelectedZone(c.zonaId); setActiveZoneTab('capillas'); }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px' }}>Zona {c.zonaId}</span>
                         <span style={{ fontSize: '10px', color: c.estadoComunidad === 'Activo' ? '#2ecc71' : 'var(--gold)', fontWeight: 700 }}>● {c.estadoComunidad}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        {c.logoUrl ? (
                          <div style={{ width: '50px', height: '50px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid var(--gold-pale)' }}>
                            <img src={c.logoUrl} alt={`Escudo de la Comunidad ${c.comunidadNombre}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ) : (
                          <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--white)', border: '2px solid var(--gold-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '20px' }}>
                            ⛪
                          </div>
                        )}
                        <div>
                          <h4 style={{ margin: 0, color: 'var(--navy)', fontSize: '18px' }}>{c.comunidadNombre}</h4>
                          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{c.name}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {liveChapels.filter(c => c.comunidadNombre && (globalCommFilter === 'all' || c.zonaId == globalCommFilter)).length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px', fontStyle: 'italic' }}>No se encontraron comunidades con los criterios seleccionados.</p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ZONAS DETAIL - zone selected */}
        {currentPage === 'zonas' && selectedZone && (
          <>
            <section className="zone-hero">
               <div className="container">
                  <button onClick={() => setSelectedZone(null)} style={{ color: 'var(--gold)', fontWeight: 700, marginBottom: '35px', background: 'rgba(255,255,255,0.05)', padding: '10px 24px', borderRadius: '30px', border: '1px solid rgba(200,151,58,0.3)', cursor: 'pointer', transition: '0.3s', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    ← Volver a Zonas
                  </button>
                  
                  {branding[`zona${selectedZone}Logo`] && (
                    <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'center' }}>
                      <img src={branding[`zona${selectedZone}Logo`] as string} className="logo-img-circular" style={{ height: '140px', width: '140px', border: '3px solid var(--gold)' }} alt={`Logo zona ${selectedZone}`} />
                    </div>
                  )}

                  <span className="premium-label">DIÓCESIS DE SAN LORENZO</span>
                  <h2 className="serif">Zona Pastoral {selectedZone}</h2>
                  <div className="line" style={{ margin: '20px auto 30px', background: 'var(--gold)', width: '120px', height: '4px' }}></div>
                  <p style={{ fontSize: '1.8rem', color: 'rgba(255,255,255,0.9)', letterSpacing: '1px', fontFamily: 'var(--font-display)', fontWeight: 300 }}>
                    {zonasInfo.find(z => z.id === selectedZone)?.name}
                  </p>
               </div>
            </section>

            <section className="section-pjl">
              <div className="container">
                <div style={{ display: 'flex', gap: '15px', marginBottom: '60px', justifyContent: 'center' }}>
                  <button onClick={() => setActiveZoneTab('capillas')} className={`btn-premium ${activeZoneTab === 'capillas' ? 'btn-premium-gold' : 'btn-premium-outline'}`}>⛪ Capillas</button>
                  <button onClick={() => setActiveZoneTab('coordination')} className={`btn-premium ${activeZoneTab === 'coordination' ? 'btn-premium-gold' : 'btn-premium-outline'}`}>👥 Coordinadores</button>
                  <button onClick={() => setActiveZoneTab('comunidades')} className={`btn-premium ${activeZoneTab === 'comunidades' ? 'btn-premium-gold' : 'btn-premium-outline'}`}>✨ Comunidades</button>
                  <button onClick={() => setActiveZoneTab('mapa')} className={`btn-premium ${activeZoneTab === 'mapa' ? 'btn-premium-gold' : 'btn-premium-outline'}`}>🗺️ Mapa</button>
                </div>

                {activeZoneTab === 'capillas' && (
                  <div className="zone-grid">
                    {liveChapels.filter(c => c.zonaId === selectedZone).map((c, i) => (
                      <div key={c.id} className="chapel-premium-card reveal" style={{ animationDelay: `${i * 0.1}s` }}>
                        <div className="chapel-photo">
                          <img src={c.photo || 'https://images.unsplash.com/photo-1548625361-195fe5772323?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80'} alt={`Foto de la Capilla ${c.name}`} />
                          <span className={`chapel-status-tag ${c.estadoComunidad === 'Activo' ? 'is-active' : 'is-nucleation'}`}>
                            {c.estadoComunidad}
                          </span>
                        </div>
                        <div className="chapel-details">
                          <h4 style={{ fontSize: '1.2rem', color: 'var(--navy)', marginBottom: '10px' }}>{c.name}</h4>
                          <div className="detail-item" style={{ alignItems: 'center' }}>
                            {c.logoUrl ? (
                               <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--gold-pale)' }}>
                                 <img src={c.logoUrl} alt={`Logo de la Comunidad ${c.comunidadNombre}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                               </div>
                            ) : (
                               <span className="icon">👥</span>
                            )}
                            <div>
                              <p className="label">COMUNIDAD JUVENIL</p>
                              <p className="value">{c.comunidadNombre || 'En formación'}</p>
                            </div>
                          </div>
                          {c.address && (
                            <div className="detail-item">
                              <span className="icon">📍</span>
                              <div>
                                <p className="label">DIRECCIÓN</p>
                                <p className="value">{c.address}</p>
                              </div>
                            </div>
                          )}
                          {c.locationUrl && (
                            <a href={c.locationUrl} target="_blank" rel="noreferrer" className="btn-premium btn-premium-gold" style={{ marginTop: '20px', width: '100%', fontSize: '0.75rem', padding: '12px' }}>
                              VER EN GOOGLE MAPS
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                    {liveChapels.filter(c => c.zonaId === selectedZone).length === 0 && (
                      <p style={{ textAlign: 'center', gridColumn: 'span 3', color: 'var(--text-muted)', padding: '40px', fontStyle: 'italic' }}>No hay capillas registradas en esta zona.</p>
                    )}
                  </div>
                )}

                {activeZoneTab === 'coordination' && (
                  <div className="zone-grid" style={{ justifyContent: 'center' }}>
                    {liveProfiles.filter(p => p.teamKey === `zona${selectedZone}`).map((p, idx) => (
                      <div key={p.id} className="profile-card reveal" style={{ animationDelay: `${idx * 0.1}s` }}>
                        <div className="profile-card-top">
                           <img src={p.photo || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'} className="profile-icon-3d" alt={p.name} />
                        </div>
                        <div className="profile-card-bottom">
                          <h4>{p.name}</h4>
                          <p className="profile-card-role">{p.role}</p>
                          <div className="profile-card-bio" style={{ textAlign: 'center', minHeight: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            {p.bio ? (
                              <>
                                {truncateBio(p.bio)}{' '}
                                <button onClick={() => setSelectedProfile(p)} style={{ background:'none', border:'none', color:'var(--gold)', fontWeight:700, fontSize:'13px', cursor:'pointer', padding:0 }}>Leer más</button>
                              </>
                            ) : (
                              <p style={{ fontStyle: 'italic', fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Responsable de la animación y comunión en esta zona.</p>
                            )}
                          </div>
                          <button onClick={() => p.cvUrl && handleDownload(p.cvUrl, `CV_${p.name}.pdf`)} className="btn-cv-pjl">
                            <span>📄</span> Currículum Pastoral
                          </button>
                        </div>
                      </div>
                    ))}
                    {liveProfiles.filter(p => p.teamKey === `zona${selectedZone}`).length === 0 && (
                       <p style={{ textAlign: 'center', gridColumn: 'span 3', color: 'var(--text-muted)', padding: '40px', fontStyle: 'italic' }}>No hay coordinadores registrados en esta zona.</p>
                    )}
                  </div>
                )}

                {activeZoneTab === 'mapa' && (
                  <div>
                    <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0, color: 'var(--navy)' }}>🗺️ Mapa Zona {selectedZone}</h4>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Las capillas aparecen marcadas con íconos de color. Haz clic en cada marcador para ver los detalles.</span>
                    </div>
                    <div style={{ borderRadius: '14px', overflow: 'hidden', border: '2px solid var(--gold-pale)', boxShadow: '0 10px 40px rgba(0,0,0,0.06)' }}>
                      <ZonaMap
                        chapels={liveChapels.map(c => ({ 
                          id: c.id, 
                          name: c.name, 
                          lat: c.lat, 
                          lng: c.lng, 
                          zonaId: c.zonaId, 
                          estadoComunidad: c.estadoComunidad, 
                          comunidadNombre: c.comunidadNombre,
                          markerColor: c.markerColor
                        }))}
                        selectedZone={selectedZone}
                        zoneColors={zoneColors}
                        showAllZones={branding.showAllZones}
                        height="520px"
                      />
                    </div>
                  </div>
                )}



                {activeZoneTab === 'comunidades' && (
                  <div className="zone-grid">
                    {liveChapels.filter(c => c.zonaId === selectedZone && c.comunidadNombre).map((c, i) => (
                      <div key={c.id} className="chapel-premium-card reveal" style={{ animationDelay: `${i * 0.1}s`, cursor: 'pointer' }} onClick={() => setActiveZoneTab('capillas')}>
                        <div className="chapel-details" style={{ padding: '30px' }}>
                          <span style={{ color: 'var(--gold)', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px' }}>Comunidad Juvenil</span>
                          <h4 style={{ fontSize: '1.5rem', color: 'var(--navy)', margin: '10px 0 20px', overflowWrap: 'break-word', wordBreak: 'break-word' }}>{c.comunidadNombre}</h4>
                          
                          <div className="line" style={{ width: '40px', background: 'var(--gold-pale)', marginBottom: '20px' }}></div>
                          
                          <div className="detail-item">
                            <span className="icon">⚡</span>
                            <div>
                              <p className="label">ESTADO ACTUAL</p>
                              <p className="value" style={{ color: c.estadoComunidad === 'Activo' ? '#2ecc71' : 'var(--gold)', fontWeight: 700 }}>
                                {c.estadoComunidad}
                              </p>
                            </div>
                          </div>
                          
                          <p style={{ marginTop: '20px', fontSize: '12px', color: 'var(--gold)', fontWeight: 700, fontStyle: 'italic' }}>
                             Ir a la capilla →
                          </p>
                        </div>
                      </div>
                    ))}
                    {liveChapels.filter(c => c.zonaId === selectedZone && c.comunidadNombre).length === 0 && (
                      <p style={{ textAlign: 'center', gridColumn: 'span 3', color: 'var(--text-muted)', padding: '40px', fontStyle: 'italic' }}>No hay comunidades registradas con nombre en esta zona.</p>
                    )}
                  </div>
                )}
                
                {/* LISTA GLOBAL TAMBIÉN AQUÍ (SOLICITADO) */}
                <div className="reveal" style={{ marginTop: '80px', borderTop: '2px solid var(--gold-pale)', paddingTop: '60px' }}>
                  <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h4 className="serif" style={{ fontSize: '1.8rem', color: 'var(--navy)' }}>Directorio de todas las <i>Zonas</i></h4>
                    <p style={{ color: 'var(--gold)', fontSize: '14px' }}>Buscador general de comunidades juveniles</p>
                  </div>
                  
                  <div className="pjl-table-container">
                    <table className="pjl-table">
                      <thead>
                        <tr>
                          <th>COMUNIDAD</th>
                          <th>CAPILLA</th>
                          <th>ZONA</th>
                          <th>ESTADO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveChapels
                          .filter(c => c.comunidadNombre)
                          .map(c => (
                          <tr key={c.id}>
                            <td style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {c.logoUrl ? (
                                <img src={c.logoUrl} alt={`Logo de ${c.comunidadNombre}`} style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                <span style={{ fontSize: '1.2rem' }}>⛪</span>
                              )}
                              {c.comunidadNombre}
                            </td>
                            <td>{c.name}</td>
                            <td><span className="premium-label" style={{ fontSize: '0.6rem' }}>Zona {c.zonaId}</span></td>
                            <td>
                              <span style={{ 
                                padding: '4px 10px', 
                                borderRadius: '20px', 
                                fontSize: '10px', 
                                fontWeight: 800,
                                background: c.estadoComunidad === 'Activo' ? 'rgba(46,204,113,0.1)' : 'rgba(200,151,58,0.1)',
                                color: c.estadoComunidad === 'Activo' ? '#27ae60' : 'var(--gold)'
                              }}>
                                {c.estadoComunidad}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* CONSEJO PJL */}
        {currentPage === 'consejo' && (
          <section className="section-pjl">
            <div className="container">
              <div className="section-head reveal">
                <span className="premium-label">EQUIPO LÍDER</span>
                <h3>Consejo <i>PJL Luque</i></h3>
                <div className="line"></div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '60px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {councilTabs.map(t => (
                  <button key={t.id} onClick={() => setActiveConsejoTab(t.id)}
                          className={`btn-premium ${activeConsejoTab === t.id ? 'btn-premium-gold' : 'btn-premium-outline'}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Representantes: show one coordinator per zone + team leads */}
              {activeConsejoTab === 'representantes' ? (
                <div>
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '40px', fontStyle: 'italic' }}>Coordinadores Zonales y líderes de cada equipo</p>
                  <div className="zone-grid" style={{ justifyContent: 'center' }}>
                    {/* Zone coordinators */}
                    {zonasInfo.map((z, idx) => {
                      const coord = liveProfiles.find(p => p.teamKey === `zona${z.id}`);
                      if (!coord) return null;
                      return (
                        <div key={`zona${z.id}`} className="profile-card reveal" style={{ animationDelay: `${idx * 0.1}s` }}>
                          <div className="profile-card-top" style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', top: '15px', left: '15px', background: 'var(--gold)', color: 'var(--navy)', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>Zona {z.id}</div>
                            <img src={coord.photo || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'} className="profile-icon-3d" alt={coord.name} />
                          </div>
                          <div className="profile-card-bottom">
                            <h4>{coord.name}</h4>
                            <p className="profile-card-role">{z.name}</p>
                            <p className="profile-card-bio" style={{ textAlign: 'center' }}>
                              {truncateBio(coord.bio)}{' '}
                              <button onClick={() => setSelectedProfile(coord)} style={{ background:'none', border:'none', color:'var(--gold)', fontWeight:700, fontSize:'13px', cursor:'pointer', padding:0 }}>Leer más</button>
                            </p>
                            {coord.cvUrl && (
                              <button onClick={() => handleDownload(coord.cvUrl!, `CV_${coord.name}.pdf`)} className="btn-cv-pjl">
                                <span>📄</span> Currículum Pastoral
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {/* Team coordinators */}
                    {(['coordinacion', 'efo', 'ecomu', 'eli', 'mmpjl'] as const).map((tk, idx) => {
                      const coord = liveProfiles.find(p => p.teamKey === tk);
                      if (!coord) return null;
                      return (
                        <div key={tk} className="profile-card reveal" style={{ animationDelay: `${(idx + 4) * 0.1}s` }}>
                          <div className="profile-card-top">
                            <img src={coord.photo || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'} className="profile-icon-3d" alt={coord.name} />
                          </div>
                          <div className="profile-card-bottom">
                            <h4>{coord.name}</h4>
                            <p className="profile-card-role">{tk.toUpperCase()}</p>
                            <p className="profile-card-bio" style={{ textAlign: 'center' }}>
                              {truncateBio(coord.bio)}{' '}
                              <button onClick={() => setSelectedProfile(coord)} style={{ background:'none', border:'none', color:'var(--gold)', fontWeight:700, fontSize:'13px', cursor:'pointer', padding:0 }}>Leer más</button>
                            </p>
                            {coord.cvUrl && (
                              <button onClick={() => handleDownload(coord.cvUrl!, `CV_${coord.name}.pdf`)} className="btn-cv-pjl">
                                <span>📄</span> Currículum Pastoral
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="zone-grid" style={{ justifyContent: 'center' }}>
                  {liveProfiles.filter(p => p.teamKey === activeConsejoTab).map((p, idx) => (
                    <div key={p.id} className="profile-card reveal" style={{ animationDelay: `${idx * 0.2}s` }}>
                      <div className="profile-card-top">
                        <img src={p.photo || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'} className="profile-icon-3d" alt={p.name} />
                      </div>
                      <div className="profile-card-bottom">
                        <h4>{p.name}</h4>
                        <p className="profile-card-role">{p.role}</p>
                        <div className="profile-card-bio" style={{ textAlign: 'center', minHeight: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          {p.bio ? (
                            <>
                              {truncateBio(p.bio)}{' '}
                              <button onClick={() => setSelectedProfile(p)} style={{ background:'none', border:'none', color:'var(--gold)', fontWeight:700, fontSize:'13px', cursor:'pointer', padding:0 }}>Leer más</button>
                            </>
                          ) : (
                            <p style={{ fontStyle: 'italic', fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Colaborador activo del Consejo PJL Luque.</p>
                          )}
                        </div>
                        {(p.quote && p.quote !== '') && (
                          <div className="profile-quote">
                            <span className="quote-mark">&#8220;</span>
                            {p.quote.replace(/"/g, '')}
                          </div>
                        )}
                        {p.cvUrl && (
                          <button onClick={() => handleDownload(p.cvUrl!, `CV_${p.name}.pdf`)} className="btn-cv-pjl">
                            <span>📄</span> Currículum Pastoral
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* INSTITUCIONAL */}
        {currentPage === 'institucional' && (
          <section className="section-pjl" id="info-institucional">
            <div className="container">
              <div className="section-head reveal" onClick={() => navigate('institucional')}>
                <h3>Información Institucional</h3>
                <div className="line"></div>
              </div>
              <div className="mvv-grid">
                <div className="mvv-card">
                  <h4>Parroquia</h4>
                  <p>{siteContent.parroquia}</p>
                  <h4 style={{ marginTop: '20px' }}>Decanato</h4>
                  <p>{siteContent.decanato}</p>
                </div>
                <div className="mvv-card">
                  <h4>Secretaría</h4>
                  <p style={{ whiteSpace: 'pre-line' }}>{siteContent.horariosSecretaria}</p>
                </div>
                <div className="mvv-card">
                  <h4>Misas y Confesiones</h4>
                  <p style={{ whiteSpace: 'pre-line' }}>{siteContent.horariosMisa}</p>
                  <h4 style={{ marginTop: '20px' }}>Atención Sacerdotal</h4>
                  <p>{siteContent.atencionSacerdotal}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* --- PAGE: AGENDA --- */}
        {currentPage === 'agenda' && (
          <section className="section-pjl" style={{ background: 'linear-gradient(135deg, var(--cream) 0%, #fff 100%)' }} id="agenda">
            <div className="container agenda-split">
              {/* Timeline (Left Column) */}
              <div>
                <div className="section-head reveal" onClick={() => navigate('agenda')}>
                  <span style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 700, letterSpacing: '2px', color: 'var(--gold)', textTransform: 'uppercase' }}>CRONOGRAMA</span>
                  <h3 style={{ margin: '10px 0' }}>Agenda Pastoral</h3>
                  <div className="line"></div>
                </div>
                <div className="timeline">
                  {liveActivities.length > 0 ? liveActivities.map((a, i) => {
                    const dateObj = new Date(a.date);
                    return (
                      <div key={a.id} className="timeline-item reveal" style={{ animationDelay: `${i * 0.1}s` }}>
                        <div className="timeline-dot"></div>
                        <span className="timeline-date">{dateObj.toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        <div className="timeline-card">
                          <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>{a.category}</span>
                          <h4 style={{ margin: '8px 0' }}>{a.title}</h4>
                          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>{a.description || 'Consulta los detalles de este evento.'}</p>
                          {a.inscription && (
                            <button className="btn-pjl" style={{ marginTop: '15px', padding: '10px 20px', border: '1px solid var(--navy)', color: 'var(--navy)', background: 'transparent', fontSize: '13px', borderRadius: '4px', fontWeight: 600 }}>Inscribirse al Evento</button>
                          )}
                        </div>
                      </div>
                    );
                  }) : <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay actividades programadas por el momento.</p>}
                </div>
              </div>
              
              {/* Google Calendar (Right Column) */}
              <div>
                <div className="section-head reveal" onClick={() => navigate('agenda')}>
                  <span style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 700, letterSpacing: '2px', color: 'var(--gold)', textTransform: 'uppercase' }}>SINCRONIZACIÓN</span>
                  <h3 style={{ margin: '10px 0' }}>Google Calendar</h3>
                  <div className="line"></div>
                </div>
                <div className="reveal calendar-wrapper" style={{ animationDelay: '0.2s', height: '650px' }}>
                  <div className="calendar-inner">
                    {siteContent.googleCalendarUrl ? (
                      <iframe src={siteContent.googleCalendarUrl} style={{ border: 0, width: '100%', height: '100%', borderRadius: '8px' }} scrolling="no"></iframe>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '48px', marginBottom: '20px', color: 'var(--gold)' }}>📅</div>
                        <p style={{ fontWeight: 600, color: 'var(--navy)' }}>Calendario no vinculado</p>
                        <p style={{ fontSize: '14px', marginTop: '10px', textAlign: 'center', maxWidth: '250px' }}>El administrador debe agregar la URL pública de Google Calendar en el panel.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* --- PAGE: NOTICIAS --- */}
        {currentPage === 'noticias' && (
          <section className="section-pjl" style={{ background: 'var(--cream)' }} id="noticias">
            <div className="container">
              <div className="section-head reveal" onClick={() => navigate('noticias')}>
                <span className="premium-label">COMUNIDAD</span>
                <h3>Boletín de <i>Noticias</i></h3>
                <div className="line"></div>
              </div>
              
              {/* VATICAN WIDGET DESTACADO EN LA PÁGINA DE NOTICIAS */}
              <div className="reveal vatican-widget-shell" style={{ marginBottom: '40px', background: 'var(--white)', padding: '20px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '1px solid var(--gold-pale)' }}>
                <h4 style={{ marginBottom: '15px', color: 'var(--navy)', fontSize: '1.2rem', textAlign: 'center' }}>Noticias del Vaticano</h4>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                   {/* @ts-ignore */}
                   <vaticannews-widget lang="es" fontSize="18"></vaticannews-widget>
                </div>
              </div>

              <div className="mvv-grid">
                {liveNews.map((n, i) => (
                  <div key={n.id} className="mvv-card reveal" style={{ animationDelay: `${i * 0.1}s`, cursor: 'pointer' }} onClick={() => setSelectedNews(n)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <span style={{ color: 'var(--gold)', fontSize: '13px', fontWeight: 700 }}>{new Date(n.date).toLocaleDateString()}</span>
                      <span style={{ fontSize: '18px' }}>📰</span>
                    </div>
                    <h4 style={{ margin: '0 0 15px', lineHeight: 1.3 }}>{n.title}</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.body}</p>
                    <button className="btn-premium btn-premium-outline" style={{ marginTop: '20px', padding: '8px 15px', fontSize: '0.7rem' }}>LEER NOTICIA COMPLETA</button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* --- PAGE: FAQ --- */}
        {currentPage === 'faq' && (
          <section className="section-pjl" id="preguntas">
            <div className="container" style={{ maxWidth: '900px' }}>
              <div className="section-head reveal" onClick={() => navigate('faq')}>
                <span className="premium-label">AYUDA</span>
                <h3>Preguntas <i>Frecuentes</i></h3>
                <div className="line"></div>
              </div>
              <div className="faq-container">
                {liveFaq.map((f, i) => (
                  <div key={f.id} className={`faq-item ${openFaq === i ? 'active' : ''}`}>
                    <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                      {f.question}
                      <span>{openFaq === i ? '−' : '+'}</span>
                    </button>
                    <div className="faq-a">
                      <p>{f.answer}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* --- PAGE: CONTACTO --- */}
        {currentPage === 'contacto' && (
          <section className="section-pjl" style={{ background: 'var(--cream)' }} id="contacto">
            <div className="container">
              <div className="section-head reveal" onClick={() => navigate('contacto')}>
                <span className="premium-label">CONÉCTATE</span>
                <h3>Canales de <i>Comunicación</i></h3>
                <div className="line"></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px', marginBottom: '60px' }}>
                <div className="contact-card reveal" style={{ animationDelay: '0.1s' }}>
                  <div className="icon-box">📱</div>
                  <h4 className="serif">Redes Sociales</h4>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '25px', fontSize: '14px' }}>Síguenos para estar al día con todas nuestras actividades.</p>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <a href={liveSocial.instagram} target="_blank" rel="noreferrer" className="btn-premium btn-premium-outline" style={{ padding: '10px 20px' }}>IG</a>
                    <a href={liveSocial.facebook} target="_blank" rel="noreferrer" className="btn-premium btn-premium-outline" style={{ padding: '10px 20px' }}>FB</a>
                  </div>
                </div>
                
                <div className="contact-card reveal" style={{ animationDelay: '0.2s' }}>
                  <div className="icon-box">💬</div>
                  <h4 className="serif">WhatsApp</h4>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '25px', fontSize: '14px' }}>Escríbenos directamente para consultas rápidas.</p>
                  <a href={`https://wa.me/${liveSocial.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="btn-premium btn-premium-gold" style={{ width: '100%', padding: '15px' }}>ENVIAR MENSAJE</a>
                </div>

                <div className="contact-card reveal" style={{ animationDelay: '0.3s' }}>
                  <div className="icon-box">📍</div>
                  <h4 className="serif">Presencial</h4>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '15px', fontSize: '14px' }}>Catedral Virgen del Rosario - Luque</p>
                  <p style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--gold)' }}>Sábados de 15:00 a 18:00 hs</p>
                </div>
              </div>

              <div className="mvv-card reveal" style={{ maxWidth: '800px', margin: '0 auto', padding: '60px', animationDelay: '0.4s' }}>
                <h4 className="serif" style={{ marginBottom: '30px', textAlign: 'center', fontSize: '24px' }}>Envíanos un Correo</h4>
                <form className="pjl-form" onSubmit={(e) => e.preventDefault()}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                      <label className="premium-label" style={{ fontSize: '10px', marginBottom: '8px', display: 'block' }}>TU NOMBRE</label>
                      <input type="text" placeholder="Ej: Juan Pérez" required className="pjl-input" />
                    </div>
                    <div className="form-group">
                      <label className="premium-label" style={{ fontSize: '10px', marginBottom: '8px', display: 'block' }}>TU EMAIL</label>
                      <input type="email" placeholder="ejemplo@correo.com" required className="pjl-input" />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: '20px' }}>
                    <label className="premium-label" style={{ fontSize: '10px', marginBottom: '8px', display: 'block' }}>MENSAJE</label>
                    <textarea placeholder="¿En qué podemos ayudarte?" rows={6} required className="pjl-input"></textarea>
                  </div>
                  <button type="submit" className="btn-premium btn-premium-gold" style={{ marginTop: '30px', width: '100%', padding: '20px', fontSize: '1rem' }}>ENVIAR MENSAJE A SECRETARÍA</button>
                </form>
              </div>
            </div>
          </section>
        )}

      </main>

      {/* PROFILE DETAIL MODAL */}
      {selectedProfile && (
        <div
          onClick={() => setSelectedProfile(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(14, 22, 50, 0.85)',
            backdropFilter: 'blur(12px)',
            zIndex: 9000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
            animation: 'fadeOverlay 0.3s ease both',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '24px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              overflowX: 'hidden',
              boxShadow: '0 40px 80px rgba(0,0,0,0.4)',
              animation: 'slideUpModal 0.35s cubic-bezier(0.2,0.8,0.2,1) both',
              position: 'relative',
              overscrollBehavior: 'contain',
            }}
            className="modal-scroll"
          >
            {/* Top gradient bar */}
            <div style={{ background: 'linear-gradient(135deg, var(--navy) 0%, #2E3F6B 100%)', padding: '40px 40px 30px', textAlign: 'center', position: 'relative' }}>
              <button
                onClick={() => setSelectedProfile(null)}
                style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', color: '#fff', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}
              >×</button>
                <img
                  src={selectedProfile.photo || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'}
                  alt={`Detalle de Perfil: ${selectedProfile.name}`}
                  style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '4px solid var(--gold)', boxShadow: '0 8px 30px rgba(0,0,0,0.3)', marginBottom: '16px' }}
                />
              <h3 style={{ color: '#fff', fontFamily: 'var(--font-display)', fontSize: '1.4rem', margin: '0 0 6px' }}>{selectedProfile.name}</h3>
              <p style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>{selectedProfile.role}</p>
            </div>
            
            <div style={{ padding: '30px 40px' }}>
              <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '10px', fontSize: '15px', lineHeight: 1.7, color: 'var(--text-muted)', textAlign: 'justify' }}>
                {selectedProfile.bio || 'Sin descripción adicional.'}
              </div>

              {selectedProfile.quote && selectedProfile.quote !== '' && (
                <div style={{ marginTop: '25px', padding: '15px', background: 'var(--cream)', borderRadius: '12px', fontStyle: 'italic', position: 'relative' }}>
                  <span style={{ position: 'absolute', top: '5px', left: '10px', fontSize: '30px', color: 'rgba(212,175,55,0.2)' }}>“</span>
                  <p style={{ margin: 0, padding: '0 10px', color: 'var(--navy)' }}>{selectedProfile.quote.replace(/"/g, '')}</p>
                </div>
              )}

              {selectedProfile.cvUrl && (
                <button
                  onClick={() => handleDownload(selectedProfile.cvUrl!, `CV_${selectedProfile.name}.pdf`)}
                  className="btn-cv-pjl"
                  style={{ width: '100%', marginTop: '25px', justifyContent: 'center' }}
                >
                  <span>📄</span> Descargar Currículum Pastoral
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HISTORY DETAIL MODAL */}
      {selectedHistoryItem && (
        <div
          onClick={() => setSelectedHistoryItem(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(14, 22, 50, 0.9)',
            backdropFilter: 'blur(15px)',
            zIndex: 9500,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
            animation: 'fadeOverlay 0.3s ease both',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '24px',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              overflowX: 'hidden',
              boxShadow: '0 40px 80px rgba(0,0,0,0.4)',
              animation: 'slideUpModal 0.35s cubic-bezier(0.2,0.8,0.2,1) both',
              position: 'relative',
              padding: '60px 50px',
            }}
            className="modal-scroll"
          >
            <button
              onClick={() => setSelectedHistoryItem(null)}
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--cream)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', color: 'var(--navy)', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}
            >×</button>
            <div style={{ textAlign: 'center' }}>
              <span style={{ color: selectedHistoryItem.accentColor || 'var(--gold)', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '3px', display: 'block', marginBottom: '15px' }}>NUESTRA HISTORIA</span>
              <h2 className="serif" style={{ fontSize: '2.5rem', color: 'var(--navy)', marginBottom: '20px' }}>{selectedHistoryItem.title}</h2>
              <div className="line" style={{ margin: '0 auto 30px', background: selectedHistoryItem.accentColor || 'var(--gold)' }}></div>
              {selectedHistoryItem.image && (
                <div style={{ borderRadius: '22px', overflow: 'hidden', marginBottom: '28px', boxShadow: '0 18px 40px rgba(0,0,0,0.12)' }}>
                  <img src={selectedHistoryItem.image} alt={selectedHistoryItem.title} style={{ width: '100%', maxHeight: '320px', objectFit: 'cover', display: 'block' }} />
                </div>
              )}
              <p style={{ color: 'var(--navy)', lineHeight: '1.8', fontSize: '1.1rem', textAlign: 'justify', whiteSpace: 'pre-line', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                {selectedHistoryItem.text}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* NEWS DETAIL MODAL */}
      {selectedNews && (
        <div
          onClick={() => setSelectedNews(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(14, 22, 50, 0.9)',
            backdropFilter: 'blur(15px)',
            zIndex: 9500,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
            animation: 'fadeOverlay 0.3s ease both',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '24px',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              overflowX: 'hidden',
              boxShadow: '0 40px 80px rgba(0,0,0,0.4)',
              animation: 'slideUpModal 0.35s cubic-bezier(0.2,0.8,0.2,1) both',
              position: 'relative',
              padding: '60px 50px',
            }}
            className="modal-scroll"
          >
            <button
              onClick={() => setSelectedNews(null)}
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--cream)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', color: 'var(--navy)', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}
            >×</button>
            <div style={{ textAlign: 'center' }}>
              <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '3px', display: 'block', marginBottom: '15px' }}>{new Date(selectedNews.date).toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              <h2 className="serif" style={{ fontSize: '2.5rem', color: 'var(--navy)', marginBottom: '30px', lineHeight: 1.2 }}>{selectedNews.title}</h2>
              <div className="line" style={{ margin: '0 auto 40px' }}></div>
              <div style={{ color: 'var(--navy)', lineHeight: '1.8', fontSize: '1.1rem', textAlign: 'justify', whiteSpace: 'pre-line', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                {selectedNews.body}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. FOOTER INSTITUCIONAL REFINADO */}
      <footer className="footer-pjl">
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.5fr', gap: '60px' }}>
            
            {/* Columna 1: Branding y Redes */}
            <div>
              <div className="logo-area" style={{ cursor: 'pointer', marginBottom: '20px' }} onClick={() => navigate('home')}>
                {branding.mainLogo && <img src={branding.mainLogo} className="logo-img-circular" style={{ height: '60px', width: '60px', marginRight: '15px' }} alt="Logo Footer PJL" />}
                <div>
                  <h2 className="serif" style={{ color: '#fff', fontSize: '24px', margin: 0, lineHeight: 1 }}>PJL</h2>
                  <p style={{ color: 'var(--gold)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>Pastoral Juvenil Luqueña</p>
                </div>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '1.8', marginBottom: '30px', maxWidth: '300px' }}>
                Jóvenes de Luque que caminan en la fe, crecen en comunidad y transforman el mundo desde el amor de Cristo.
              </p>
              <div className="footer-social-custom" style={{ display: 'flex', gap: '15px' }}>
                <a href={liveSocial.instagram} target="_blank" rel="noreferrer" className="btn-icon-minimalist">IG</a>
                <a href={liveSocial.facebook} target="_blank" rel="noreferrer" className="btn-icon-minimalist">FB</a>
                <a href={`https://wa.me/${liveSocial.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="btn-icon-minimalist">WA</a>
              </div>
            </div>

            {/* Columna 1: Navegación */}
            <div>
              <h4 style={{ color: 'var(--gold)', marginBottom: '25px', letterSpacing: '2px', fontSize: '13px', textTransform: 'uppercase' }}>🧭 Navegación</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '15px' }}>
                <li><button className="footer-link-btn" onClick={() => navigate('home')}>Inicio</button></li>
                <li><button className="footer-link-btn" onClick={() => navigate('estatuto')}>Estatuto</button></li>
                <li><button className="footer-link-btn" onClick={() => navigate('consejo')}>Consejo PJL</button></li>
                <li><button className="footer-link-btn" onClick={() => navigate('zonas')}>Zonas</button></li>
              </ul>
            </div>

            {/* Columna 2: Comunidad */}
            <div>
              <h4 style={{ color: 'var(--gold)', marginBottom: '25px', letterSpacing: '2px', fontSize: '13px', textTransform: 'uppercase' }}>🌍 Comunidad</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '15px' }}>
                <li><button className="footer-link-btn" onClick={() => navigate('agenda')}>Agenda Pastoral</button></li>
                <li><button className="footer-link-btn" onClick={() => navigate('noticias')}>Últimas Noticias</button></li>
                <li><button className="footer-link-btn" onClick={() => navigate('contacto')}>Contacto</button></li>
                <li><button className="footer-link-btn" onClick={() => navigate('preguntas')}>Preguntas Frecuentes</button></li>
              </ul>
            </div>
            
            {/* Columna 3: Ubicación y Contacto */}
            <div>
              <h4 style={{ color: 'var(--gold)', marginBottom: '25px', letterSpacing: '2px', fontSize: '13px', textTransform: 'uppercase' }}>📍 Ubicación</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '15px', color: 'rgba(255,255,255,0.7)', fontSize: '14px', lineHeight: '1.6' }}>
                <li style={{ display: 'flex', gap: '8px' }}><span>⛪</span> Catedral Virgen del Rosario</li>
                <li style={{ display: 'flex', gap: '8px' }}><span>🇵🇾</span> Luque - Paraguay</li>
                <li style={{ display: 'flex', gap: '8px' }}><span>📧</span> pjl.luque@gmail.com</li>
              </ul>
            </div>
            
          </div>
          <div style={{ marginTop: '70px', paddingTop: '30px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
            © {new Date().getFullYear()} Pastoral Juvenil Luqueña. Desarrollado para la Gloria de Dios.
          </div>
        </div>
      </footer>
      
      {/* Styles inline for footer links just to keep it clean */}
      <style dangerouslySetInnerHTML={{__html: `
        .footer-link-btn {
          background: none;
          border: none;
          color: rgba(255,255,255,0.7);
          font-family: inherit;
          font-size: 14px;
          cursor: pointer;
          padding: 0;
          text-align: left;
          transition: 0.3s;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .footer-link-btn:hover {
          color: #fff;
          transform: translateX(8px);
        }
        /* Custom Scrollbar for Modals */
        .modal-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .modal-scroll::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.05);
          border-radius: 10px;
        }
        .modal-scroll::-webkit-scrollbar-thumb {
          background: var(--gold-pale);
          border-radius: 10px;
        }
        .modal-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--gold);
        }
      `}} />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="admin-login-screen"><div className="loading-pjl">Cargando...</div></div>}>
      <HomeContent />
    </Suspense>
  );
}
