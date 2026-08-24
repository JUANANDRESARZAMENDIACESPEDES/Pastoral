'use client';
import { useState, useEffect, useRef, Suspense, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import Link from 'next/link';
import {
  store,
  NewsItem, Activity, FaqItem, DocItem, GalleryItem,
  SiteContent, SocialLinks, ActiveSections, MemberProfile,
  Branding, ThemePalette, PageStat, Chapel, HeroSlide, User,
  DEFAULT_NEWS, DEFAULT_ACTIVITIES, DEFAULT_FAQ,
  DEFAULT_DOCS, DEFAULT_CONTENT, DEFAULT_SOCIAL, DEFAULT_SECTIONS, DEFAULT_BRANDING,
  DEFAULT_STATS, DEFAULT_THEME_PALETTE, DEFAULT_USERS, mergePageStats
} from '@/lib/pjlStore';
import { buildGoogleCalendarCreateUrl, buildGoogleCalendarEmbedUrl, DEFAULT_GOOGLE_CALENDAR_OPTIONS } from '@/lib/googleCalendar';
import { fetchStoreValue, upsertStoreValue, subscribeStoreChanges } from '@/lib/supabaseStore';
import { SupabaseProfile, fetchProfileByEmail, fetchAllProfiles, fetchPendingProfiles, approveProfile, signInProfile, signUpProfile, subscribeProfileChanges, deleteProfile, resendVerificationEmail, updateProfile } from '@/lib/supabaseProfiles';

const ZonaMap = dynamic(() => import('@/components/ZonaMap'), { 
  ssr: false,
  loading: () => <div style={{ height: '400px', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '25px', border: '1px solid var(--gold-pale)' }}>Cargando mapa interactivo...</div>
});

import { NewsArticleWithDetails } from '@/lib/newsTypes';

const NewsAdminTable = dynamic(() => import('@/components/admin/NewsAdminTable').then(mod => ({ default: mod.NewsAdminTable })), { loading: () => <div>Cargando tabla...</div> });
const NewsArticleForm = dynamic(() => import('@/components/admin/NewsArticleForm').then(mod => ({ default: mod.NewsArticleForm })), { loading: () => <div>Cargando formulario...</div> });
const NewsEventForm = dynamic(() => import('@/components/admin/NewsEventForm').then(mod => ({ default: mod.NewsEventForm })), { loading: () => <div>Cargando formulario de eventos...</div> });

type Module = 'dashboard' | 'identidad' | 'apariencia' | 'contenido' | 'actividades' | 'noticias' | 'usuarios' | 'documentos' | 'configuracion' | 'perfiles' | 'capillas' | 'asistente' | 'carrusel' | 'territorio' | 'logs';

// Read PageStat from pjlStore

const CREDS = { user: 'admin', pass: 'admin' };

const NAV_ITEMS = [
  { id: 'dashboard',      iconKey: 'adminIconDashboard', label: 'Dashboard', defaultIcon: '📊' },
  { id: 'identidad',      iconKey: 'adminIconIdentidad', label: 'Identidad', defaultIcon: '🎨' },
  { id: 'carrusel',       iconKey: 'adminIconCarrusel', label: 'Carrusel Hero', defaultIcon: '🖼️' },
  { id: 'apariencia',     iconKey: 'adminIconApariencia', label: 'Apariencia', defaultIcon: '✨' },
  { id: 'contenido',      iconKey: 'adminIconContenido', label: 'Contenido', defaultIcon: '📝' },
  { id: 'noticias',       iconKey: 'adminIconNoticias', label: 'Noticias', defaultIcon: '📰' },
  { id: 'actividades',    iconKey: 'adminIconActividades', label: 'Actividades', defaultIcon: '📅' },
  { id: 'capillas',       iconKey: 'adminIconCapillas', label: 'Capillas', defaultIcon: '⛪' },
  { id: 'perfiles',       iconKey: 'adminIconPerfiles', label: 'Currículos', defaultIcon: '👤' },
  { id: 'documentos',     iconKey: 'adminIconDocumentos', label: 'Documentos', defaultIcon: '📁' },
  { id: 'usuarios',       iconKey: 'adminIconUsuarios', label: 'Usuarios', defaultIcon: '👥' },
  { id: 'logs',           iconKey: 'adminIconLogs', label: 'Historial', defaultIcon: '📜' },
  { id: 'configuracion',  iconKey: 'adminIconConfiguracion', label: 'Configuración', defaultIcon: '⚙️' },
  { id: 'asistente',      iconKey: 'adminIconAsistente', label: 'Asistente IA', defaultIcon: '🤖' },
];

// Módulos que nunca se delegan desde la UI de permisos (solo acceso total)
const NON_DELEGABLE_MODULES: Module[] = ['usuarios', 'configuracion'];

const getDocPresentation = (doc: Partial<DocItem>) => {
  const lowerType = doc.type?.toLowerCase() || '';
  const lowerName = doc.name?.toLowerCase() || '';
  const lowerUrl = doc.url?.toLowerCase() || '';
  const source = `${lowerType} ${lowerName} ${lowerUrl}`;

  if (source.includes('pdf')) return { kind: 'pdf', icon: '📄', color: '#ef4444', label: 'PDF' };
  if (source.includes('doc') || source.includes('word')) return { kind: 'word', icon: '📝', color: '#2563eb', label: 'Word' };
  if (source.includes('xls') || source.includes('sheet') || source.includes('csv')) return { kind: 'sheet', icon: '📊', color: '#16a34a', label: 'Planilla' };
  if (source.includes('ppt')) return { kind: 'slides', icon: '🎞️', color: '#ea580c', label: 'Presentación' };
  if (source.includes('png') || source.includes('jpg') || source.includes('jpeg') || source.includes('webp') || source.includes('gif') || source.includes('image')) {
    return { kind: 'image', icon: '🖼️', color: '#0f766e', label: 'Imagen' };
  }
  return { kind: 'file', icon: '📁', color: '#C8973A', label: 'Archivo' };
};

const canPreviewInFrame = (doc: Partial<DocItem>) => {
  const kind = getDocPresentation(doc).kind;
  return kind === 'pdf' || kind === 'image';
};

/* Imagen a prueba de enlaces rotos: si la URL falla o está vacía,
   muestra un placeholder elegante en lugar del ícono de imagen rota. */
function SafeImg({ src, alt, style, fallback = '⛪', fallbackStyle }: {
  src?: string; alt: string; style?: React.CSSProperties;
  fallback?: string; fallbackStyle?: React.CSSProperties;
}) {
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [src]);
  if (!src || err) {
    return (
      <span
        aria-label={alt}
        role="img"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: 'linear-gradient(135deg, #f3ede0 0%, #e9dfc8 100%)', fontSize: '20px', ...fallbackStyle }}
      >
        {fallback}
      </span>
    );
  }
  return <img src={src} alt={alt} style={style} onError={() => setErr(true)} />;
}

/* Contador animado que sube hasta el valor real */
function CountUp({ value, duration = 1100 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') { setDisplay(value); return; }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{display.toLocaleString('es-ES')}</>;
}

/* Tarjeta KPI con brillo al hover y pulso al hacer click */
function KpiCard({ icon, label, value, sub, tone, delay, text }: {
  icon: string; label: string; value: number | string; sub: string;
  tone: 'navy' | 'gold' | 'green' | 'blue' | 'violet' | 'rose'; delay: number; text?: boolean;
}) {
  const [burst, setBurst] = useState(false);
  const handleClick = () => {
    setBurst(false);
    requestAnimationFrame(() => setBurst(true));
    setTimeout(() => setBurst(false), 700);
  };
  return (
    <div
      className={`kpi-card kpi-${tone} pop-in ${burst ? 'kpi-burst' : ''}`}
      style={{ animationDelay: `${delay}s` }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') handleClick(); }}
    >
      <span className="kpi-shine" aria-hidden="true"></span>
      <span className={`kpi-orb kpi-orb-${tone}`} aria-hidden="true"></span>
      <div className="kpi-top">
        <span className="kpi-icon" aria-hidden="true">{icon}</span>
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-value">
        {text ? <span className="kpi-text">{value}</span> : <CountUp value={Number(value) || 0} />}
      </div>
      <div className="kpi-sub">{sub}</div>
      {burst && <span className="kpi-ring" aria-hidden="true"></span>}
    </div>
  );
}

/* Gráfico de dona animado e interactivo */
const DONUT_COLORS = ['#1A2744', '#C8973A', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899'];
function DonutChart({ items }: { items: { label: string; visits: number }[] }) {
  const [drawn, setDrawn] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 250);
    return () => clearTimeout(t);
  }, []);
  const total = items.reduce((acc, s) => acc + (s.visits || 0), 0);
  if (!items.length || total === 0) {
    return <p style={{ color: '#bbb', textAlign: 'center', padding: '20px 0', fontSize: '13px', fontStyle: 'italic' }}>Sin datos de visitas aún</p>;
  }
  const r = 54, cx = 75, cy = 75, strokeW = 20;
  const circ = 2 * Math.PI * r;
  let cumulative = 0;
  const segs = items.map((s, i) => {
    const pct = (s.visits || 0) / total;
    const start = cumulative;
    cumulative += pct;
    return { ...s, pct, start, color: DONUT_COLORS[i % DONUT_COLORS.length] };
  });
  const activeSeg = active !== null ? segs[active] : null;
  return (
    <div className="donut-wrap">
      <div className="donut-svg-box">
        <svg viewBox="0 0 150 150" width="150" height="150" role="img" aria-label="Distribución de visitas por sección">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0ece4" strokeWidth={strokeW} />
          {segs.map((seg, i) => (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={active === i ? strokeW + 7 : strokeW}
              strokeLinecap="butt"
              strokeDasharray={`${drawn ? Math.max(seg.pct * circ - 2.5, 0) : 0} ${circ}`}
              strokeDashoffset={-(seg.start * circ)}
              transform={`rotate(-90 ${cx} ${cy})`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              style={{
                cursor: 'pointer',
                transition: `stroke-dasharray 1.1s cubic-bezier(0.22,1,0.36,1) ${i * 0.13}s, stroke-width 0.25s ease, opacity 0.25s ease`,
                opacity: active === null || active === i ? 1 : 0.28,
              }}
            />
          ))}
        </svg>
        <div className="donut-center">
          {activeSeg ? (
            <>
              <div className="donut-center-pct">{Math.round(activeSeg.pct * 100)}%</div>
              <div className="donut-center-label">{activeSeg.label}</div>
            </>
          ) : (
            <>
              <div className="donut-center-total"><CountUp value={total} /></div>
              <div className="donut-center-label">VISITAS</div>
            </>
          )}
        </div>
      </div>
      <div className="donut-legend">
        {segs.map((seg, i) => (
          <button
            key={i}
            className={`donut-legend-row ${active === i ? 'is-active' : ''}`}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
          >
            <span className="donut-dot" style={{ background: seg.color }} />
            <span className="donut-legend-label">{seg.label}</span>
            <span className="donut-legend-val">{Math.round(seg.pct * 100)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* Contraste WCAG entre dos colores hex */
function hexLuminance(hex: string): number {
  const h = (hex || '').replace('#', '');
  if (h.length !== 6) return 0;
  const rgb = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
function contrastRatio(a: string, b: string): number {
  const l1 = hexLuminance(a), l2 = hexLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
const NAVY_POOL = ['#1A2744', '#1A3B2B', '#3B1A3A', '#441A1A', '#0F1F3D', '#2C3E50', '#23306B', '#14343B'];
const GOLD_POOL = ['#C8973A', '#D4AF37', '#B8860B', '#DAA520', '#E6BE6A', '#A0783A', '#C9A227', '#D69E35'];

function useLS<T>(key: keyof typeof store, def: T) {
  const [val, setVal] = useState<T>(def);

  useEffect(() => {
    const syncFromStore = () => {
      const storeVal = (store[key].get as () => T)();
      setVal(storeVal);
    };

    const timer = setTimeout(syncFromStore, 0);
    const onStorage = (event: StorageEvent) => {
      if (event.key === `pjl_${String(key)}`) syncFromStore();
    };
    const onCustomUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (!detail?.key || detail.key === key) syncFromStore();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('pjl_store_update', onCustomUpdate as EventListener);

    const applyRemoteValue = (remoteValue: unknown) => {
      if (remoteValue === null || remoteValue === undefined) return;
      try {
        const parsed = remoteValue as T;
        const current = (store[key].get as () => T)();
        if (JSON.stringify(current) !== JSON.stringify(parsed)) {
          setVal(parsed);
          localStorage.setItem(`pjl_${String(key)}`, JSON.stringify(parsed));
          window.dispatchEvent(new CustomEvent('pjl_store_update', { detail: { key } }));
        }
      } catch {
        // Ignorar problemas de parseo remotos
      }
    };

    const loadRemoteValue = async () => {
      try {
        const remote = await fetchStoreValue<T>(String(key));
        if (remote !== null) {
          applyRemoteValue(remote);
        }
      } catch (error) {
        // Ignorar si Supabase no está disponible
      }
    };

    const unsubscribeRemote = subscribeStoreChanges((changedKey, changedValue) => {
      if (changedKey !== String(key)) return;
      applyRemoteValue(changedValue);
    });

    loadRemoteValue();

    return () => {
      clearTimeout(timer);
      unsubscribeRemote();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pjl_store_update', onCustomUpdate as EventListener);
    };
  }, [key]);

  const update = (v: T | ((prev: T) => T)) => {
    const next = typeof v === 'function'
      ? (v as (prev: T) => T)((store[key].get as () => T)())
      : v;

    setVal(next);
    const setter = store[key].set as (v: T) => void;
    setter(next);
    upsertStoreValue(String(key), next).catch(() => {
      // Fallback to local persistence if Supabase no está disponible
    });
  };
  return [val, update] as const;
}

// Page stats now managed in pjlStore

function AdminContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modParam = searchParams.get('mod') as Module || 'dashboard';

  // --- AUTH ---
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useLS<User[]>('users', DEFAULT_USERS);
  const [pendingProfiles, setPendingProfiles] = useState<SupabaseProfile[]>([]);
  const [registerMode, setRegisterMode] = useState<'login' | 'register'>('login');
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [registerErr, setRegisterErr] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');
  const [emailConfirmedMessage, setEmailConfirmedMessage] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isAuth = localStorage.getItem('pjl_admin_auth') === 'true';
      setLoggedIn(isAuth);
      if (isAuth) {
        const savedUser = localStorage.getItem('pjl_current_user');
        if (savedUser) {
          try {
            setCurrentUser(JSON.parse(savedUser));
          } catch (e) {
            // Fallback to first user if JSON is corrupt
            if (allUsers.length > 0) setCurrentUser(allUsers[0]);
          }
        } else if (allUsers.length > 0) {
          // Emergency fallback: if logged in but no user data, take first admin
          setCurrentUser(allUsers[0]);
        }
      }
    }
  }, [allUsers]);
  const [loginForm, setLoginForm] = useState({ user: '', pass: '' });
  const [loginErr, setLoginErr] = useState(false);
  const [loginErrorMessage, setLoginErrorMessage] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<{ ok: boolean; message: string; sample?: any } | null>(null);

  useEffect(() => {
    const confirmed = searchParams.get('confirmed');
    const type = searchParams.get('type');
    const errorDescription = searchParams.get('error_description') || searchParams.get('error');
    const gcal = searchParams.get('gcal');
    const gcalMessage = searchParams.get('gcal_message');
    const gcalAccount = searchParams.get('gcal_account');

    if (confirmed === 'true' || type === 'signup') {
      setRegisterMode('login');
      setRegisterSuccess('Correo confirmado. Ya puedes iniciar sesión.');
      setEmailConfirmedMessage('Tu correo ha sido confirmado con éxito. Inicia sesión para continuar.');
      router.replace('/admin');
      return;
    }

    if (errorDescription) {
      setLoginErr(true);
      setLoginErrorMessage(decodeURIComponent(errorDescription));
      router.replace('/admin');
      return;
    }

    if (gcal === 'connected') {
      setGoogleCalendarStatus({
        connected: true,
        account: gcalAccount || undefined,
      });
      showToast('Google Calendar conectado ✔');
      router.replace('/admin?mod=actividades');
      return;
    }

    if (gcal === 'error') {
      showToast(gcalMessage || 'No se pudo conectar Google Calendar.');
      router.replace('/admin?mod=actividades');
      return;
    }

    let mounted = true;
    const check = async () => {
      try {
        const res = await fetch('/api/supabase/status');
        const json = await res.json();
        if (mounted) setSupabaseStatus(json);
      } catch (e) {
        if (mounted) setSupabaseStatus({ ok: false, message: String(e) });
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => { mounted = false; clearInterval(interval); };
  }, [searchParams, router]);

  useEffect(() => {
    const initSession = async () => {
      try {
        const profiles = await fetchAllProfiles();
        if (profiles.length > 0) {
          setAllUsers(profiles.map(p => ({
            id: p.id,
            name: p.name,
            email: p.email,
            role: p.role,
            status: p.status,
            permissions: p.permissions,
            createdAt: p.created_at,
            authUid: p.auth_uid,
          })));
        }
        const pending = await fetchPendingProfiles();
        setPendingProfiles(pending);
      } catch (e) {
        console.error('Error cargando perfiles Supabase:', e);
      }
    };
    initSession();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeProfileChanges((profile, eventType) => {
      setAllUsers((prev: User[]) => {
        const existingIndex = prev.findIndex(u => u.id === profile.id);
        const updatedUser = {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          status: profile.status,
          permissions: profile.permissions,
          createdAt: profile.created_at,
          authUid: profile.auth_uid,
        };

        if (eventType === 'DELETE') {
          return prev.filter(u => u.id !== profile.id);
        }
        if (existingIndex >= 0) {
          return prev.map(u => u.id === profile.id ? updatedUser : u);
        }
        return [...prev, updatedUser];
      });

      setPendingProfiles(prev => {
        if (profile.status === 'pendiente') {
          const found = prev.find(p => p.id === profile.id);
          if (found) {
            return prev.map(p => p.id === profile.id ? profile : p);
          }
          return [...prev, profile];
        }
        return prev.filter(p => p.id !== profile.id);
      });
    });

    return () => unsubscribe();
  }, []);

  const hasPermission = (m: Module, action: 'view' | 'edit' | 'admin' = 'view') => {
    if (!loggedIn) return false;
    if (!currentUser) return true;
    if (currentUser.role === 'desarrollador' || currentUser.role === 'superadmin') return true;
    if (m === 'dashboard' && action === 'view') return true;

    // Módulos que no se pueden delegar desde la UI de permisos
    if (NON_DELEGABLE_MODULES.includes(m)) return false;

    const permissionKeys = m === 'territorio' ? ['capillas', 'territorio'] : [m];
    const explicitPermissions = currentUser.permissions || [];
    const hasExplicitRules = explicitPermissions.length > 0;

    if (currentUser.role === 'editor') {
      // Si el admin otorgó módulos explícitos, se respetan tal cual
      if (hasExplicitRules) return permissionKeys.some(key => explicitPermissions.includes(key));
      return true;
    }
    if (currentUser.role === 'viewer') {
      if (action !== 'view') return false;
      return hasExplicitRules
        ? permissionKeys.some(key => explicitPermissions.includes(key))
        : ['dashboard', 'logs', 'noticias', 'actividades', 'documentos', 'capillas', 'perfiles', 'territorio'].includes(m);
    }
    return false;
  };

  // --- PERSISTENT STATE ---
  const [news, setNews] = useLS<NewsItem[]>('news', DEFAULT_NEWS);
  const [activities, setActivities] = useLS<Activity[]>('activities', DEFAULT_ACTIVITIES);
  const [faq, setFaq] = useLS<FaqItem[]>('faq', DEFAULT_FAQ);
  const [docs, setDocs] = useLS<DocItem[]>('docs', DEFAULT_DOCS);
  const [content, setContent] = useLS<SiteContent>('content', DEFAULT_CONTENT);
  const [social, setSocial] = useLS<SocialLinks>('social', DEFAULT_SOCIAL);
  const [sections, setSections] = useLS<ActiveSections>('sections', DEFAULT_SECTIONS);
  const [profiles, setProfiles] = useLS<MemberProfile[]>('profiles', []);
  const [branding, setBranding] = useLS<Branding>('branding', DEFAULT_BRANDING);
  const [theme, setTheme] = useLS<ThemePalette>('theme', DEFAULT_THEME_PALETTE);
  const [liveHeroImages, setLiveHeroImages] = useLS<HeroSlide[]>('hero', []);
  const [heroIntervalSecs, setHeroIntervalSecs] = useLS<number>('heroInterval', 3);
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [chapels, setChapels] = useLS<Chapel[]>('chapels', []);
  const [pageStats, setPageStats] = useLS<PageStat[]>('stats', DEFAULT_STATS);
  const [logs, setLogs] = useLS<any[]>('logs', []);
  const calendarOptions = {
    ...DEFAULT_GOOGLE_CALENDAR_OPTIONS,
    showAgenda: false,
    ...(content.googleCalendarOptions ?? {}),
  };
  const calendarEmbedUrl = buildGoogleCalendarEmbedUrl(content.googleCalendarUrl, calendarOptions);
  const [googleCalendarStatus, setGoogleCalendarStatus] = useState<{ connected: boolean; account?: string } | null>(null);
  const [googleCalendarSyncing, setGoogleCalendarSyncing] = useState(false);

  useEffect(() => {
    const loadGoogleCalendarStatus = async () => {
      try {
        const response = await fetch('/api/google-calendar/status');
        const json = await response.json();
        setGoogleCalendarStatus(json);
      } catch {
        setGoogleCalendarStatus({ connected: false });
      }
    };

    loadGoogleCalendarStatus();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const updateStatsFromRemote = (remoteValue: unknown) => {
      if (!remoteValue) return;
      try {
        const currentStats = store.stats.get();
        const stats = mergePageStats(currentStats, remoteValue as PageStat[]);
        setPageStats(stats);
        const serialized = JSON.stringify(stats);
        const current = localStorage.getItem('pjl_stats');
        if (current !== serialized) {
          localStorage.setItem('pjl_stats', serialized);
          window.dispatchEvent(new CustomEvent('pjl_store_update', { detail: { key: 'stats' } }));
        }
      } catch (error) {
        console.error('Error parsing remote dashboard stats:', error);
      }
    };

    const fetchInitialStats = async () => {
      try {
        const remoteStats = await fetchStoreValue<PageStat[]>('stats');
        if (!isMounted || !remoteStats) return;
        updateStatsFromRemote(remoteStats);
      } catch (error) {
        console.error('Error cargando estadísticas iniciales:', error);
      }
    };

    fetchInitialStats();

    const unsubscribe = subscribeStoreChanges((changedKey, changedValue) => {
      if (changedKey !== 'stats') return;
      updateStatsFromRemote(changedValue);
    });

    return () => {
      isMounted = false;
      try { unsubscribe(); } catch (e) {}
    };
  }, []);

  // --- LOGGING HELPER ---
  const addLog = (action: string, module: string, details?: string) => {
    const newLog = {
      id: Date.now().toString(),
      userId: currentUser?.id || 'guest',
      userName: currentUser?.name || 'Invitado',
      action,
      module,
      details,
      timestamp: new Date().toISOString()
    };
    setLogs([newLog, ...logs.slice(0, 49)]);
  };

  // --- LOCAL UI STATE ---
  const tabParam = searchParams.get('tab') === 'territorio' ? 'territorio' : 'capillas';
  const [mod, setMod] = useState<Module>(modParam === 'territorio' ? 'capillas' : modParam);
  const [capillasView, setCapillasView] = useState<'capillas' | 'territorio'>(tabParam);
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<null | Module>(null);
  const [editId, setEditId] = useState<number | string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const validStats = Array.isArray(pageStats) ? pageStats : [];
  const liveVisits = validStats.reduce((acc, stat) => acc + (stat?.visits || 0), 0);
  const maxVisits = Math.max(...validStats.map(s => s?.visits || 0), 1);
  const maxInteractions = Math.max(...validStats.map(s => s?.interactions || 0), 1);
  const [navyHex, setNavyHex] = useState(theme.navy);
  const [goldHex, setGoldHex] = useState(theme.gold);
  const [savedPalettes, setSavedPalettes] = useState<{navy: string; gold: string}[]>([]);

  useEffect(() => {
    if (!currentUser || currentUser.id === 'master') return;

    const freshUser = allUsers.find(u => u.id === currentUser.id || u.email === currentUser.email);
    if (!freshUser) return;

    if (freshUser.status === 'inactivo') {
      handleLogout();
      return;
    }

    const mergedUser = { ...currentUser, ...freshUser, lastActive: currentUser.lastActive || freshUser.lastActive };
    const changed = JSON.stringify(mergedUser) !== JSON.stringify(currentUser);
    if (changed) {
      setCurrentUser(mergedUser);
      localStorage.setItem('pjl_current_user', JSON.stringify(mergedUser));
    }
  }, [allUsers, currentUser]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem('pjl_saved_palettes');
        if (saved) {
          setSavedPalettes(JSON.parse(saved));
        }
      } catch (e) {}
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Automatic simulation of stats removed in favor of real interaction tracking

  const [form, setForm] = useState<any>({});
  const [activeProfileTeam, setActiveProfileTeam] = useState('coordinacion');
  const [activeContentTab, setActiveContentTab] = useState('institucional');

  // --- NEWS VIEW STATE ---
  const [newsView, setNewsView] = useState<'list' | 'article' | 'event'>('list');
  const [selectedArticle, setSelectedArticle] = useState<NewsArticleWithDetails | null>(null);

  // --- AI STATE ---
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- FILTERS ---
  const [searchTerm, setSearchTerm] = useState('');
  const [capZoneFilter, setCapZoneFilter] = useState<number | 'all'>('all');
  const [capEstadoFilter, setCapEstadoFilter] = useState<'all' | 'Activo' | 'Nucleación' | 'sinGPS'>('all');

  // --- TERRITORY EDITOR ---
  const [capturingZone, setCapturingZone] = useState<number | null>(null);
  const [tempPolygon, setTempPolygon] = useState<[number, number][]>([]);
  const [placingChapelId, setPlacingChapelId] = useState<string | null>(null);

  useEffect(() => {
    (window as any).onPJLMapClick = (lat: number, lng: number) => {
      if (capturingZone !== null) {
        setTempPolygon(prev => [...prev, [lat, lng]]);
        return;
      }
      if (placingChapelId) {
        const target = chapels.find(c => c.id === placingChapelId);
        if (target) {
          setChapels(chapels.map(c => (c.id === placingChapelId ? { ...c, lat, lng } : c)));
          showToast(`📍 ${target.name} ubicada en el mapa`);
          addLog('ubicar capilla', 'territorio', `${target.name} (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
        }
        setPlacingChapelId(null);
      }
    };
    return () => { (window as any).onPJLMapClick = null; };
  }, [capturingZone, placingChapelId, chapels]);

  useEffect(() => {
    if (!(mod === 'capillas' && capillasView === 'territorio')) {
      setCapturingZone(null);
      setTempPolygon([]);
      setPlacingChapelId(null);
    }
  }, [mod, capillasView]);

  const saveCapturedPolygon = () => {
    if (capturingZone === null) return;
    setBranding({
      ...branding,
      [`zona${capturingZone}Polygon`]: tempPolygon
    });
    setCapturingZone(null);
    setTempPolygon([]);
    showToast(`Polígono Zona ${capturingZone} guardado ✔`);
    addLog('actualizar territorio', 'territorio', `Zona ${capturingZone}`);
  };

  // ─── TERRITORIO 2.0 · COBERTURA, UBICACIÓN Y EXPORT ───
  const pointInPolygon = (lat: number, lng: number, poly: [number, number][]): boolean => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const yi = poly[i][0], xi = poly[i][1];
      const yj = poly[j][0], xj = poly[j][1];
      if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

  const territoryStats = ([1, 2, 3, 4] as const).map(num => {
    const poly = branding[`zona${num}Polygon`] as [number, number][] | undefined;
    const zoneList = chapels.filter(c => c.zonaId === num);
    const placed = zoneList.filter(c => typeof c.lat === 'number' && typeof c.lng === 'number');
    const dentro = poly && poly.length > 2 ? placed.filter(c => pointInPolygon(c.lat!, c.lng!, poly)).length : null;
    return {
      zona: num,
      total: zoneList.length,
      activas: zoneList.filter(c => c.estadoComunidad === 'Activo').length,
      ubicadas: placed.length,
      dentro,
      tienePoligono: !!(poly && poly.length > 2),
      color: (branding[`zona${num}Color`] as string) || '#C8973A'
    };
  });

  const TERR_PRESETS = ['#C8973A', '#1A2744', '#1A3B2B', '#441A1A', '#2563EB', '#0D9488'];
  const unplacedChapels = chapels.filter(c => typeof c.lat !== 'number' || typeof c.lng !== 'number');
  const placingChapel = placingChapelId ? chapels.find(c => c.id === placingChapelId) || null : null;
  const zonaColor = (z: number) => (branding[`zona${z}Color`] as string) || '#C8973A';

  const filteredChapels = chapels.filter(c => {
    const q = searchTerm.toLowerCase();
    const matchQ = !q || c.name.toLowerCase().includes(q) || c.zonaId.toString().includes(q);
    const matchZ = capZoneFilter === 'all' || c.zonaId === capZoneFilter;
    const matchE = capEstadoFilter === 'all'
      ? true
      : capEstadoFilter === 'sinGPS'
        ? typeof c.lat !== 'number' || typeof c.lng !== 'number'
        : c.estadoComunidad === capEstadoFilter;
    return matchQ && matchZ && matchE;
  });

  // Sincronización cruzada: desde Capillas → modo ubicación en Territorio
  const goToTerritoryPlace = (id: string) => {
    closeModal();
    navigateMod('capillas', 'territorio');
    startPlacingChapel(id);
  };

  const centerMapOn = (c: Chapel) => {
    if (typeof c.lat !== 'number' || typeof c.lng !== 'number') return;
    setBranding({ ...branding, mapCenterLat: c.lat, mapCenterLng: c.lng });
    showToast(`🎯 Mapa centrado en ${c.name}`);
    addLog('centrar mapa', 'territorio', c.name);
  };

  const toggleEstadoComunidad = (c: Chapel) => {
    const nuevo = c.estadoComunidad === 'Activo' ? 'Nucleación' : 'Activo';
    setChapels(chapels.map(x => (x.id === c.id ? { ...x, estadoComunidad: nuevo } : x)));
    showToast(`⇄ ${c.name}: ${nuevo}`);
    addLog('cambiar estado comunidad', 'capillas', `${c.name} → ${nuevo}`);
  };

  const startPlacingChapel = (id: string) => {
    setCapturingZone(null);
    setTempPolygon([]);
    setPlacingChapelId(id);
  };

  const exportTerritorioGeoJSON = () => {
    const features: Array<Record<string, unknown>> = [];
    ([1, 2, 3, 4] as const).forEach(num => {
      const poly = branding[`zona${num}Polygon`] as [number, number][] | undefined;
      if (poly && poly.length > 2) {
        const ring = [...poly.map(p => [p[1], p[0]]), [poly[0][1], poly[0][0]]];
        features.push({
          type: 'Feature',
          properties: { tipo: 'zona', zona: num, color: (branding[`zona${num}Color`] as string) || '#C8973A' },
          geometry: { type: 'Polygon', coordinates: [ring] }
        });
      }
    });
    chapels.forEach(c => {
      if (typeof c.lat === 'number' && typeof c.lng === 'number') {
        features.push({
          type: 'Feature',
          properties: { tipo: 'capilla', nombre: c.name, zona: c.zonaId, comunidad: c.comunidadNombre, estado: c.estadoComunidad },
          geometry: { type: 'Point', coordinates: [c.lng, c.lat] }
        });
      }
    });
    const blob = new Blob([JSON.stringify({ type: 'FeatureCollection', features }, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'territorio-pjl.geojson';
    a.click();
    URL.revokeObjectURL(url);
    showToast('🗺️ Territorio exportado en GeoJSON');
    addLog('exportar territorio', 'territorio', `${features.length} entidades`);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const normalizedMod = modParam === 'territorio' ? 'capillas' : modParam;
    setMod(normalizedMod);
    setCapillasView(modParam === 'territorio' ? 'territorio' : tabParam);
  }, [modParam, tabParam]);
  useEffect(() => { setNavyHex(theme.navy); }, [theme.navy]);
  useEffect(() => { setGoldHex(theme.gold); }, [theme.gold]);

  // Close user menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // --- Modal UX: Body Scroll Lock ---
  useEffect(() => {
    if (modal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [modal]);

  // --- Geocoding Automático para Capillas ---
  useEffect(() => {
    if (modal === 'capillas' && form.locationUrl && form.locationUrl.includes('google.com/maps')) {
      const match = form.locationUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (match) {
        const [_, lat, lon] = match;
        // Nominatim reverse geocoding (OpenStreetMap)
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
          .then(r => r.json())
          .then(data => {
            if (data.display_name && !form.address) {
              // Limpiar un poco la dirección para que no sea excesivamente larga
              const cleanAddr = data.display_name.split(',').slice(0, 3).join(', ');
              setForm((f: any) => ({ ...f, address: cleanAddr }));
            }
          })
          .catch(e => console.error("Error recuperando dirección:", e));
      }
    }
  }, [form.locationUrl, modal]);

  // --- Automatic Address Fetching ---
  useEffect(() => {
    if (modal === 'capillas' && form.locationUrl) {
      const url = form.locationUrl;
      // Parsing logic for long Google Maps URLs
      if (url.includes('/place/')) {
        try {
          const parts = url.split('/place/');
          if (parts.length > 1) {
            const placeName = parts[1].split('/')[0];
            const parsed = decodeURIComponent(placeName).replace(/\+/g, ' ');
            // Update address only if it's empty or was recently auto-filled
            if (!form.address || form.address === 'Ubicación seleccionada') {
              setForm((prev: any) => ({ ...prev, address: parsed }));
            }
          }
        } catch (e) {}
      }
    }
  }, [form.locationUrl, modal]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr(false);
    setLoginErrorMessage('');
    setIsLoggingIn(true);

    const inputUser = loginForm.user.trim();
    const inputPass = loginForm.pass.trim();
    const normalize = (value: string) => value.trim().toLowerCase();

    const resolveEmail = () => {
      const value = normalize(inputUser);
      if (value.includes('@')) return value;
      const found = allUsers.find(u => {
        const email = normalize(u.email);
        const name = normalize(u.name);
        const alias = email.split('@')[0];
        const compactName = name.replace(/\s+/g, '');
        return [email, name, alias, compactName].includes(value);
      });
      return found?.email;
    };

    const inputEmail = resolveEmail();
    const isMaster = normalize(inputUser) === CREDS.user && inputPass === CREDS.pass;
    const supabaseAvailable = supabaseStatus?.ok !== false;
    let authUser: User | null = null;

    try {
      if (isMaster) {
        authUser = {
          id: 'master',
          name: 'Desarrollador',
          email: CREDS.user,
          role: 'desarrollador',
          status: 'activo',
          permissions: NAV_ITEMS.map(n => n.id),
          lastActive: new Date().toISOString(),
        };
      } else if (inputEmail) {
        if (!supabaseAvailable) {
          setLoginErr(true);
          setLoginErrorMessage('Supabase no está disponible. Intenta más tarde.');
          return;
        }

        const { data, error } = await signInProfile(inputEmail, inputPass);
        if (error) {
          const profile = await fetchProfileByEmail(inputEmail);
          if (profile?.status === 'pendiente') {
            setLoginErr(true);
            setLoginErrorMessage('Tu cuenta está pendiente de aprobación. Pronto el administrador te aceptará.');
            return;
          }
          setLoginErr(true);
          setLoginErrorMessage(error.message || 'Usuario o contraseña incorrectos.');
          return;
        }

        if (data?.session?.user?.email) {
          const profile = await fetchProfileByEmail(inputEmail);
          if (profile) {
            if (profile.status !== 'activo') {
              setLoginErr(true);
              setLoginErrorMessage(profile.status === 'pendiente'
                ? 'Tu cuenta está pendiente de aprobación.'
                : 'Tu cuenta no está activa.');
              return;
            }
            authUser = {
              id: profile.id,
              name: profile.name,
              email: profile.email,
              role: profile.role,
              status: profile.status,
              permissions: profile.permissions,
              createdAt: profile.created_at,
              lastActive: new Date().toISOString(),
            };
          }
        }
      }

      if (authUser) {
        setLoggedIn(true);
        setCurrentUser(authUser);
        localStorage.setItem('pjl_admin_auth', 'true');
        localStorage.setItem('pjl_current_user', JSON.stringify(authUser));
        setLoginErr(false);
        setShowPassword(false);
        showToast(`¡Bienvenido, ${authUser.name}! ✔`);
        addLog('inicio de sesión', 'sistema', `Usuario ${authUser.email} ha entrado al panel.`);
        return;
      }

      setLoginErr(true);
      setLoginErrorMessage('Usuario o contraseña incorrectos.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setCurrentUser(null);
    localStorage.removeItem('pjl_admin_auth');
    localStorage.removeItem('pjl_current_user');
    router.push('/');
  };

  const loadPendingProfiles = async () => {
    try {
      const pending = await fetchPendingProfiles();
      setPendingProfiles(pending);
    } catch (error) {
      console.error('Error cargando solicitudes pendientes:', error);
    }
  };

  const handleApproveProfile = async (profileId: string) => {
    const success = await approveProfile(profileId);
    if (success) {
      showToast('Cuenta aprobada ✔');
      const profiles = await fetchAllProfiles();
      setAllUsers(profiles.map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        role: p.role,
        status: p.status,
        permissions: p.permissions,
        createdAt: p.created_at,
        authUid: p.auth_uid,
      })));
      await loadPendingProfiles();
      addLog('aprobar cuenta', 'usuarios', `Perfil aprobado: ${profileId}`);
    } else {
      showToast('No se pudo aprobar la cuenta');
    }
  };

  const handleResendVerification = async (email: string, name: string) => {
    const { success, message } = await resendVerificationEmail(email);
    if (success) {
      showToast('✉️ Correo reenviado');
      addLog('reenviar verificación', 'usuarios', `Email reenviado a: ${email}`);
    } else {
      alert(message || 'No se pudo reenviar el correo de verificación.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterErr('');
    setRegisterSuccess('');
    if (!registerForm.name || !registerForm.email || !registerForm.password) {
      setRegisterErr('Completa todos los campos.');
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterErr('Las contraseñas no coinciden.');
      return;
    }
    if (supabaseStatus?.ok === false) {
      setRegisterErr('No se puede solicitar acceso porque Supabase no está disponible. Intenta más tarde.');
      return;
    }

    setIsRegistering(true);
    try {
      const redirectTo = window.location.origin + '/confirmation?success=true';
      const { error } = await signUpProfile(registerForm.name, registerForm.email, registerForm.password, redirectTo);
      if (error) {
        setRegisterErr(error.message || 'Error al solicitar acceso.');
        return;
      }

      setRegisterSuccess('Solicitud enviada. El desarrollador aprobará tu cuenta pronto.');
      setRegisterForm({ name: '', email: '', password: '', confirmPassword: '' });
      await loadPendingProfiles();
    } catch (e) {
      setRegisterErr('Error al solicitar acceso. Intenta nuevamente.');
    } finally {
      setIsRegistering(false);
    }
  };

  const navigateMod = (m: Module, section?: 'capillas' | 'territorio') => {
    const sectionQuery = section ? `&tab=${section}` : '';
    router.push(`/admin?mod=${m}${sectionQuery}`);
    setSidebarOpen(false);
  };

  const closeModal = () => { setModal(null); setEditId(null); setForm({}); };
  const openNew = (type: Module) => { setModal(type); setEditId(null); setForm({}); };
  const openEdit = (type: Module, item: NewsItem | Activity | FaqItem | DocItem | GalleryItem | Chapel | MemberProfile | User | Record<string, string>) => { setModal(type); setEditId((item as { id?: number | string }).id || null); setForm(item); };

  const syncActivityToGoogleCalendar = async (
    activity: Activity,
    action: 'create' | 'update' | 'delete',
    calendarEventId?: string
  ) => {
    const response = await fetch('/api/google-calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        title: activity.title,
        date: activity.date,
        description: activity.description || '',
        category: activity.category || '',
        eventId: calendarEventId || activity.calendarEventId || '',
      }),
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.ok) {
      throw new Error(json.message || 'No se pudo sincronizar con Google Calendar.');
    }

    return json as { eventId?: string; htmlLink?: string; deleted?: boolean };
  };

  const syncNewsToGoogleCalendar = async (
    item: NewsItem,
    action: 'create' | 'update' | 'delete',
    calendarEventId?: string
  ) => {
    const response = await fetch('/api/google-calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        title: item.title,
        date: item.date,
        description: item.body || '',
        category: 'Noticias',
        eventId: calendarEventId || item.calendarEventId || '',
      }),
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.ok) {
      throw new Error(json.message || 'No se pudo sincronizar la noticia con Google Calendar.');
    }

    return json as { eventId?: string; htmlLink?: string; deleted?: boolean };
  };

  // --- CRUD ---
  const saveNews = async () => {
    const title = typeof form.title === 'string' ? form.title.trim() : '';
    const body = typeof form.body === 'string' ? form.body.trim() : '';
    const date = typeof form.date === 'string' ? form.date : '';
    const published = Boolean(form.published ?? true);
    const existingNews = editId ? news.find(n => n.id === editId) : null;
    const localId = editId || Date.now();
    const savedNews: NewsItem = {
      ...form,
      id: localId,
      title,
      body,
      date,
      published,
      calendarEventId: published ? existingNews?.calendarEventId : undefined,
      calendarUrl: published ? existingNews?.calendarUrl : undefined,
      calendarSyncStatus: googleCalendarStatus?.connected ? 'pending' : 'error',
    };

    if (!title || !date) {
      alert('Debes completar al menos el título y la fecha de la noticia.');
      return;
    }

    const updated = editId
      ? news.map(n => n.id === editId ? { ...n, ...savedNews } : n)
      : [...news, savedNews];
    setNews(updated);
    closeModal();
    addLog(editId ? 'editar' : 'crear', 'noticias', `Tít: ${form.title}`);

    if (!googleCalendarStatus?.connected) {
      showToast('Noticia guardada ✔');
      return;
    }

    if (!published) {
      if (existingNews?.calendarEventId) {
        try {
          await syncNewsToGoogleCalendar({ ...savedNews, calendarEventId: existingNews.calendarEventId }, 'delete', existingNews.calendarEventId);
        } catch (error) {
          console.error('Error borrando noticia en Google Calendar:', error);
        }
      }
      showToast('Noticia guardada ✔');
      return;
    }

    setGoogleCalendarSyncing(true);
    try {
      const result = await syncNewsToGoogleCalendar(
        {
          ...savedNews,
          id: localId,
        } as NewsItem,
        existingNews?.calendarEventId ? 'update' : 'create',
        existingNews?.calendarEventId
      );

      setNews(prev => prev.map(n => {
        if (n.id !== localId) return n;
        return {
          ...n,
          calendarEventId: result.eventId || n.calendarEventId,
          calendarUrl: result.htmlLink || n.calendarUrl,
          calendarSyncStatus: 'synced',
        };
      }));
      showToast(existingNews?.calendarEventId ? 'Noticia actualizada en Google Calendar ✔' : 'Noticia enviada a Google Calendar ✔');
    } catch (error) {
      console.error('Error sincronizando noticia con Google Calendar:', error);
      setNews(prev => prev.map(n => n.id === localId ? { ...n, calendarSyncStatus: 'error' } : n));
      showToast('Noticia guardada ✔');
    } finally {
      setGoogleCalendarSyncing(false);
    }
  };

  const saveActivity = async () => {
    const title = typeof form.title === 'string' ? form.title.trim() : '';
    const date = typeof form.date === 'string' ? form.date : '';
    const category = typeof form.category === 'string' ? form.category : 'Formación';
    const description = typeof form.description === 'string' ? form.description.trim() : '';
    const existingActivity = editId ? activities.find(a => a.id === editId) : null;
    const localId = editId || Date.now();
    const savedActivity: Activity = {
      ...form,
      id: localId,
      title,
      date,
      category,
      description,
      inscription: Boolean(form.inscription),
      active: editId ? Boolean((form as Activity).active ?? true) : true,
      calendarUrl: buildGoogleCalendarCreateUrl(title, date, description, category),
      calendarEventId: existingActivity?.calendarEventId,
      calendarSyncStatus: googleCalendarStatus?.connected ? 'pending' : 'error',
    };

    if (!title || !date) {
      alert('Debes completar al menos el título y la fecha de la actividad.');
      return;
    }

    const updated = editId
      ? activities.map(a => a.id === editId ? { ...a, ...savedActivity } : a)
      : [...activities, savedActivity];
    setActivities(updated);
    closeModal();
    addLog(editId ? 'editar' : 'crear', 'actividades', `Act: ${form.title}`);

    if (!googleCalendarStatus?.connected) {
      showToast('Actividad guardada ✔');
      return;
    }

    setGoogleCalendarSyncing(true);
    try {
      const result = await syncActivityToGoogleCalendar(
        {
          ...savedActivity,
          id: localId,
        } as Activity,
        existingActivity?.calendarEventId ? 'update' : 'create',
        existingActivity?.calendarEventId
      );

      setActivities(prev => prev.map(a => {
        if (a.id !== localId) return a;
        return {
          ...a,
          calendarEventId: result.eventId || a.calendarEventId,
          calendarUrl: result.htmlLink || a.calendarUrl,
          calendarSyncStatus: 'synced',
        };
      }));
      showToast(existingActivity?.calendarEventId ? 'Actividad actualizada en Google Calendar ✔' : 'Actividad enviada a Google Calendar ✔');
    } catch (error) {
      console.error('Error sincronizando actividad con Google Calendar:', error);
      setActivities(prev => prev.map(a => a.id === localId ? { ...a, calendarSyncStatus: 'error' } : a));
      showToast('Actividad guardada ✔');
    } finally {
      setGoogleCalendarSyncing(false);
    }
  };

  const deleteAllActivities = async () => {
    if (!confirm('¿Deseas borrar todas las actividades? Esta acción no se puede deshacer.')) return;

    const remoteDeletes = activities
      .filter(activity => activity.calendarEventId)
      .map(activity => syncActivityToGoogleCalendar(activity, 'delete'));
    await Promise.allSettled(remoteDeletes);

    setActivities([]);
    showToast('Todas las actividades fueron eliminadas 🗑️');
    addLog('eliminar todo', 'actividades');
  };

  const saveDoc = () => {
    const normalizedDoc = {
      ...form,
      category: form.category || 'General',
      uploadedAt: form.uploadedAt || new Date().toISOString().slice(0, 10),
    };
    const updated = editId
      ? docs.map(d => d.id === editId ? { ...d, ...normalizedDoc } : d)
      : [...docs, { ...normalizedDoc, id: Date.now(), downloads: 0 }];
    setDocs(updated); closeModal(); showToast('Documento registrado ✔');
    addLog(editId ? 'editar' : 'crear', 'documentos', `Doc: ${normalizedDoc.name}`);
  };

  const saveChapel = () => {
    if (!form.name) return;
    const updated = editId
      ? chapels.map(c => c.id === editId ? { ...c, ...form } : c)
      : [...chapels, { ...form, id: Date.now().toString(), zonaId: form.zonaId || 1, estadoComunidad: form.estadoComunidad || 'Activo' }];
    setChapels(updated); closeModal(); showToast('Capilla guardada ✔');
    addLog(editId ? 'editar' : 'crear', 'capillas', `Nombre: ${form.name}`);
  };

  const saveUser = async () => {
    if (!form.email || !form.name) return;
    const normalizedPermissions = form.role === 'superadmin'
      ? NAV_ITEMS.map(n => n.id)
      : Array.from(new Set(['dashboard', ...(form.permissions || [])]));
    const normalizedUser = { ...form, permissions: normalizedPermissions };

    closeModal();

    if (editId) {
      const previousUsers = allUsers;
      const target = allUsers.find(u => u.id === editId);
      // Actualización optimista en la UI
      setAllUsers(allUsers.map(u => u.id === editId ? { ...u, ...normalizedUser } : u));

      if (target) {
        // Persistir en Supabase: sin esto, los cambios se pierden al recargar
        const ok = await updateProfile(target.id, {
          name: form.name,
          email: form.email,
          role: form.role,
          status: (form.status as 'activo' | 'inactivo' | 'pendiente') || target.status,
          permissions: normalizedPermissions,
        });
        if (!ok) {
          setAllUsers(previousUsers);
          showToast('Sin conexión con la nube: cambios revertidos ✖');
          addLog('error', 'usuarios', `No se pudo actualizar: ${form.email}`);
          return;
        }
        showToast('Usuario actualizado y sincronizado ✔');
      }
    } else {
      setAllUsers([...allUsers, { ...normalizedUser, id: Date.now().toString(), password: form.password || 'pjl123', createdAt: new Date().toISOString() }]);
      showToast('Usuario creado ✔');
    }
    addLog(editId ? 'editar' : 'crear', 'usuarios', `User: ${form.email}`);
  };

  const deleteItem = async (type: 'news' | 'activities' | 'docs' | 'chapels' | 'users', id: number | string) => {
    if (!confirm('¿Estás seguro de eliminar este elemento?')) return;
    const newsToDelete = type === 'news' ? news.find(n => n.id === id) : null;
    const activityToDelete = type === 'activities' ? activities.find(a => a.id === id) : null;
    if (newsToDelete?.calendarEventId) {
      try {
        await syncNewsToGoogleCalendar(newsToDelete, 'delete', newsToDelete.calendarEventId);
      } catch (error) {
        console.error('No se pudo borrar el evento remoto de la noticia en Google Calendar:', error);
      }
    }
    if (activityToDelete?.calendarEventId) {
      try {
        await syncActivityToGoogleCalendar(activityToDelete, 'delete');
      } catch (error) {
        console.error('No se pudo borrar el evento remoto de Google Calendar:', error);
      }
    }
    if (type === 'news') setNews(news.filter(n => n.id !== id));
    if (type === 'activities') setActivities(activities.filter(a => a.id !== id));
    if (type === 'docs') setDocs(docs.filter(d => d.id !== id));
    if (type === 'chapels') setChapels(chapels.filter(c => c.id !== id));
    if (type === 'users') {
      const user = allUsers.find(u => u.id === id);
      if (user) {
        if (user.authUid) {
          const { success, message } = await deleteProfile(user.id, user.authUid);
          if (!success) {
            alert(message || 'No se pudo eliminar el usuario en Supabase.');
            return;
          }
        }
      }
      setAllUsers(allUsers.filter(u => u.id !== id));
      setPendingProfiles(prev => prev.filter(p => p.id !== id));
    }
    showToast('Elemento eliminado 🗑️');
    addLog('eliminar', type, `ID: ${id}`);
  };

  const resetStats = () => {
    if (!confirm('¿Deseas reiniciar todas las estadísticas a cero? Esta acción no se puede deshacer.')) return;
    const resetData = DEFAULT_STATS.map(s => ({ ...s, visits: 0, interactions: 0, desktopVisits: 0, tabletVisits: 0, mobileVisits: 0 }));
    setPageStats(resetData);
    showToast('Estadísticas reiniciadas ✔');
    addLog('reiniciar estadísticas', 'dashboard');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => callback(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDocumentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.includes('.') ? file.name.split('.').pop()?.toUpperCase() : file.type.split('/').pop()?.toUpperCase();
    const sizeMb = file.size / (1024 * 1024);

    handleFileUpload(e, (url) => {
      setForm((prev: any) => ({
        ...prev,
        name: prev.name || file.name,
        type: prev.type || extension || 'FILE',
        size: `${sizeMb >= 1 ? sizeMb.toFixed(1) : Math.max(sizeMb, 0.1).toFixed(1)} MB`,
        url,
        uploadedAt: prev.uploadedAt || new Date().toISOString().slice(0, 10),
      }));
    });
  };

  const applyThemeColor = (navy: string, gold: string) => {
    setTheme({ navy, gold });
    window.dispatchEvent(new Event('pjl_theme_update'));
  };



  // --- LOGIN SCREEN ---
  if (!loggedIn) return (
    <div className="admin-login-screen">
      <div className="login-glass-container animate-reveal">
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="login-back-button"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: 'rgba(200,151,58,0.12)', border: '1px solid rgba(200,151,58,0.4)',
              borderRadius: '20px', padding: '8px 18px', color: 'var(--gold)',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginBottom: '24px',
              transition: '0.2s'
            }}
          >
            ← Volver al Menú Principal
          </button>
          <div className="serif login-title" style={{ fontSize: '2rem', color: 'var(--navy)', letterSpacing: '-1px' }}>PJL <em>Admin</em></div>
          <p className="premium-label" style={{ color: 'var(--gold)', marginTop: '5px' }}>Acceso Restringido</p>
          {supabaseStatus && (
            <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '13px', color: supabaseStatus.ok ? '#16a34a' : '#b91c1c' }}>
              {supabaseStatus.ok ? 'Supabase: Conectado' : 'Supabase: No disponible'} — {supabaseStatus.message}
            </div>
          )}
        </div>
        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button type="button" className={`btn-premium ${registerMode === 'login' ? 'btn-premium-gold' : 'btn-premium-outline'}`} onClick={() => setRegisterMode('login')} style={{ minWidth: '140px' }}>
            Iniciar sesión
          </button>
          <button type="button" className={`btn-premium ${registerMode === 'register' ? 'btn-premium-gold' : 'btn-premium-outline'}`} onClick={() => setRegisterMode('register')} style={{ minWidth: '140px' }}>
            Solicitar acceso
          </button>
        </div>
        {supabaseStatus?.ok === false && (
          <div style={{ textAlign: 'center', fontSize: '13px', color: '#b45309', marginBottom: '16px' }}>
            Supabase está desconectado. Solo el acceso maestro <strong>admin/admin</strong> funcionará hasta que se restablezca la conexión.
          </div>
        )}
        {registerMode === 'login' ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {emailConfirmedMessage && <div className="login-alert" style={{ background: '#dcfce7', color: '#166534', padding: '12px', borderRadius: '8px', fontSize: '13px', textAlign: 'center' }}>{emailConfirmedMessage}</div>}
            {loginErr && <div className="login-alert" style={{ background: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '8px', fontSize: '13px', textAlign: 'center' }}>{loginErrorMessage || 'Usuario o contraseña incorrectos'}</div>}
            <div className="form-group">
              <label className="premium-label" style={{ marginBottom: '8px', display: 'block' }}>Usuario</label>
              <input
                className="pjl-input"
                value={loginForm.user}
                onChange={e => {
                  setLoginForm({ ...loginForm, user: e.target.value });
                  if (loginErr) setLoginErr(false);
                }}
                placeholder="admin"
                autoComplete="username"
                required
              />
            </div>
            <div className="form-group">
              <label className="premium-label" style={{ marginBottom: '8px', display: 'block' }}>Contraseña</label>
              <div className="login-password-field" style={{ position: 'relative' }}>
                <input
                  className="pjl-input login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={loginForm.pass}
                  onChange={e => {
                    setLoginForm({ ...loginForm, pass: e.target.value });
                    if (loginErr) setLoginErr(false);
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '13px', color: 'var(--navy)', cursor: 'pointer', fontWeight: 600 }}>
                <input 
                  type="checkbox" 
                  checked={showPassword} 
                  onChange={() => setShowPassword(!showPassword)} 
                  style={{ width: '16px', height: '16px', accentColor: 'var(--gold)', cursor: 'pointer' }}
                />
                Mostrar contraseña
              </label>
              <div style={{ textAlign: 'right', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => router.push('/reset-password')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--gold)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: '13px',
                    padding: 0,
                  }}
                >
                  Olvidé mi contraseña
                </button>
              </div>
            </div>
            <button type="submit" className="btn-premium btn-premium-gold" style={{ width: '100%', marginTop: '10px' }} disabled={isLoggingIn}>
              {isLoggingIn ? 'Ingresando...' : 'Entrar al Panel'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {registerErr && <div className="login-alert" style={{ background: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '8px', fontSize: '13px', textAlign: 'center' }}>{registerErr}</div>}
            {registerSuccess && <div className="login-alert" style={{ background: '#dcfce7', color: '#166534', padding: '12px', borderRadius: '8px', fontSize: '13px', textAlign: 'center' }}>{registerSuccess}</div>}
            <div className="form-group">
              <label className="premium-label" style={{ marginBottom: '8px', display: 'block' }}>Nombre completo</label>
              <input
                className="pjl-input"
                value={registerForm.name}
                onChange={e => setRegisterForm({ ...registerForm, name: e.target.value })}
                placeholder="Tu nombre"
                autoComplete="name"
                required
              />
            </div>
            <div className="form-group">
              <label className="premium-label" style={{ marginBottom: '8px', display: 'block' }}>Email</label>
              <input
                className="pjl-input"
                type="email"
                value={registerForm.email}
                onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })}
                placeholder="correo@dominio.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="form-group">
              <label className="premium-label" style={{ marginBottom: '8px', display: 'block' }}>Contraseña</label>
              <input
                className="pjl-input"
                type="password"
                value={registerForm.password}
                onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </div>
            <div className="form-group">
              <label className="premium-label" style={{ marginBottom: '8px', display: 'block' }}>Repite contraseña</label>
              <input
                className="pjl-input"
                type="password"
                value={registerForm.confirmPassword}
                onChange={e => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </div>
            <button type="submit" className="btn-premium btn-premium-gold" style={{ width: '100%', marginTop: '10px' }} disabled={isRegistering}>
              {isRegistering ? 'Enviando...' : 'Solicitar acceso'}
            </button>
            <p style={{ fontSize: '12px', color: '#555', margin: 0, textAlign: 'center' }}>Tu solicitud será revisada por un desarrollador y quedará en estado <strong>pendiente</strong>.</p>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <div className="admin-shell" style={{ overflowX: 'hidden' }}>
      {toast && <div className="pjl-toast animate-reveal">{toast}</div>}

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 98, display: 'none' }}
          className="sidebar-overlay"
        />
      )}

      {/* SIDEBAR */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'sidebar-mobile-open' : ''}`}>
        <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
            <span className="side-logo-wrap">
              {branding.mainLogo ? (
                <img src={branding.mainLogo} alt="PJL Logo" className="logo-img-circular" style={{ width: '40px', height: '40px', border: '2px solid var(--gold)' }} />
              ) : (
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 'bold' }}>P</div>
              )}
            </span>
            <div className="serif side-logo-title" style={{ fontSize: '1.6rem', marginLeft: '12px' }}>PJL <em>Admin</em></div>
          </Link>
          <p className="premium-label side-logo-sub" style={{ fontSize: '0.65rem', color: 'var(--gold)', paddingLeft: '54px' }}>Panel Institucional</p>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(n => {
            const allowed = hasPermission(n.id as Module);
            const icon = (branding[n.iconKey as keyof Branding] as string) || n.defaultIcon;
            return (
              <button
                key={n.id}
                onClick={() => {
                  if (allowed) navigateMod(n.id as Module);
                  else showToast('Este módulo no está habilitado para este usuario');
                }}
                className={`admin-nav-item ${mod === n.id ? 'active' : ''}`}
                style={!allowed ? { opacity: 0.45, filter: 'grayscale(0.15)' } : undefined}
                title={allowed ? n.label : `${n.label} (sin permiso)`}
              >
                <span className="nav-icon">{icon}</span>
                <span className="nav-label">{n.label}</span>
                {!allowed && <span style={{ marginLeft: 'auto', fontSize: '12px', opacity: 0.9 }}>🔒</span>}
                {mod === n.id && allowed && <span className="nav-active-dot" aria-hidden="true"></span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            className="btn-premium btn-premium-outline"
            style={{ width: '100%', marginBottom: '10px', fontSize: '0.72rem' }}
            onClick={() => router.push('/')}
          >
            ← Volver al Menú Principal
          </button>
          <button
            className="btn-premium"
            style={{ width: '100%', fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)' }}
            onClick={handleLogout}
          >
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="admin-main" data-module={mod}>
        <header className="admin-topbar">
          <div className="topbar-left">
            {/* Hamburger for mobile */}
            <button
              className="sidebar-hamburger"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Abrir menú"
            >
              ☰
            </button>
            <h2 key={mod} className="serif topbar-title" style={{ color: 'var(--navy)' }}>
              {NAV_ITEMS.find(n => n.id === mod)?.label}
            </h2>
          </div>
          <div className="topbar-right">
            <div className="user-profile" ref={userMenuRef} style={{ position: 'relative' }}>
              <div style={{ textAlign: 'right' }} className="user-info-text">
                <div className="user-name">{currentUser?.name || 'Admin Central'}</div>
                <div className="user-role" style={{ textTransform: 'capitalize' }}>{currentUser?.role || 'Super Administrador'}</div>
              </div>
              <button
                className="user-avatar"
                style={{ border: '2px solid var(--gold)', cursor: 'pointer' }}
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-label="Menú de usuario"
              >
                {currentUser?.name?.[0] || 'A'}
              </button>
              {showUserMenu && (
                <div className="user-menu-pop" style={{
                  position: 'absolute', top: 'calc(100% + 12px)', right: '0',
                  background: '#fff', padding: '15px', borderRadius: '14px',
                  boxShadow: '0 8px 40px rgba(0,0,0,0.18)', display: 'flex',
                  flexDirection: 'column', gap: '8px', zIndex: 200, minWidth: '200px',
                  border: '1px solid var(--gold-pale)'
                }}>
                  <div style={{ paddingBottom: '10px', borderBottom: '1px solid #eee', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Conectado como</span>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--navy)', marginTop: '2px' }}>{currentUser?.name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--gold)', textTransform: 'capitalize' }}>{currentUser?.role}</p>
                  </div>
                  <button
                    onClick={() => { setShowUserMenu(false); navigateMod('configuracion'); }}
                    className="btn-premium btn-premium-outline"
                    style={{ width: '100%', fontSize: '11px', padding: '8px', justifyContent: 'flex-start', gap: '8px' }}
                  >
                    ⚙️ Configuración
                  </button>
                  <button
                    onClick={() => { setShowUserMenu(false); router.push('/'); }}
                    className="btn-premium btn-premium-outline"
                    style={{ width: '100%', fontSize: '11px', padding: '8px', justifyContent: 'flex-start', gap: '8px' }}
                  >
                    🏠 Ver Sitio Web
                  </button>
                  <button
                    onClick={() => { setShowUserMenu(false); setLoggedIn(false); }}
                    style={{
                      border: '1px solid #ef4444', color: '#ef4444', background: '#fef2f2',
                      width: '100%', fontSize: '11px', padding: '8px', borderRadius: '8px',
                      fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                  >
                    🚪 Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="admin-content-area" style={{ position: 'relative' }} data-module={mod}>
          {/* LOGO WATERMARK BACKGROUND */}
          {branding.logoWatermark && branding.mainLogo && (
            <div style={{
              position: 'fixed',
              bottom: '50px',
              right: '50px',
              width: '400px',
              height: '400px',
              backgroundImage: `url(${branding.mainLogo})`,
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: 0.05,
              pointerEvents: 'none',
              zIndex: 0,
              filter: 'grayscale(1) brightness(0.5)'
            }} />
          )}

          {/* DASHBOARD */}
          {mod === 'dashboard' && (
            <div className="animate-reveal">

              {/* BIENVENIDA */}
              <div className="dash-welcome pop-in">
                <div className="dash-welcome-text">
                  <span className="dash-welcome-hi">✨ Panel de control en vivo</span>
                  <h3 className="serif">¡Hola, {(currentUser?.name || 'Admin').split(' ')[0]}! 👋</h3>
                  <p>{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Todo sincronizado con la nube</p>
                </div>
                <div className="dash-welcome-badge">
                  <span className="dash-live-dot"></span> DATOS EN VIVO
                </div>
              </div>

              {/* KPI CARDS ANIMADAS */}
              <div className="admin-dashboard-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px', marginBottom: '30px' }}>
                <KpiCard icon="📈" label="VISITAS TOTALES" value={liveVisits} sub="Registradas automáticamente" tone="navy" delay={0.05} />
                <KpiCard icon="⚡" label="INTERACCIONES" value={(Array.isArray(pageStats) ? pageStats : []).reduce((acc, s) => acc + (s?.interactions || 0), 0)} sub="Puntos de contacto activos" tone="gold" delay={0.12} />
                <KpiCard icon="👥" label="USUARIOS" value={allUsers.length} sub="Cuentas registradas en la nube" tone="blue" delay={0.19} />
                <KpiCard icon="📨" label="SOLICITUDES PENDIENTES" value={pendingProfiles.length} sub="Esperando aprobación" tone="rose" delay={0.26} />
                <KpiCard icon="⛪" label="COMUNIDADES ACTIVAS" value={chapels.filter(c => c.estadoComunidad === 'Activo').length} sub={`De ${chapels.length} comunidades totales`} tone="green" delay={0.33} />
                <KpiCard icon="📅" label="EVENTOS PRÓXIMOS" value={activities.filter(a => a.active && a.date && new Date(`${a.date}T23:59:59`) >= new Date()).length} sub="En el calendario pastoral" tone="violet" delay={0.4} />
              </div>

              {/* MAIN ANALYTICS GRID */}
              <div className="admin-dashboard-main-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '20px', marginBottom: '20px' }}>

                {/* VISITS BY SECTION — HORIZONTAL BARS */}
                <div className="admin-analytics-card pop-in" style={{ background: '#fff', border: '1px solid #e8e0d5', borderRadius: '16px', padding: '28px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', animationDelay: '0.2s' }}>
                  <div className="admin-dashboard-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                      <h3 style={{ margin: 0, color: 'var(--navy)', fontSize: '16px', fontWeight: 700 }}>📊 Visitas por Sección</h3>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#888' }}>Visitas e interacciones registradas automáticamente</p>
                    </div>
                    <div className="admin-dashboard-actions" style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => { const s = store.stats.get(); const csv = 'Sección,Visitas,Interacciones\n' + s.map(e => `"${e.label}",${e.visits},${e.interactions}`).join('\n'); const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv); a.download = 'reporte_pjl.csv'; a.click(); showToast('CSV descargado ✔'); }} style={{ fontSize: '10px', padding: '5px 12px', background: 'var(--cream)', border: '1px solid var(--gold-pale)', borderRadius: '6px', cursor: 'pointer', color: 'var(--navy)', fontWeight: 600 }}>📥 CSV</button>
                      <button onClick={resetStats} style={{ fontSize: '10px', padding: '5px 12px', background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', color: '#b91c1c', fontWeight: 600 }}>🗑️ Reset</button>
                      <span style={{ fontSize: '10px', background: '#d1fae5', color: '#065f46', padding: '5px 10px', borderRadius: '20px', fontWeight: 700 }}>● Auto-sync</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(Array.isArray(pageStats) ? pageStats : [])
                      .sort((a, b) => (b?.visits || 0) - (a?.visits || 0))
                      .slice(0, 8)
                      .map((stat, i) => {
                        if (!stat) return null;
                        const pct = maxVisits > 0 ? Math.round(((stat.visits || 0) / maxVisits) * 100) : 0;
                        const intPct = maxInteractions > 0 ? Math.round(((stat.interactions || 0) / maxInteractions) * 100) : 0;
                        return (
                          <div key={stat.page || i}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                {i === 0 && <span style={{ fontSize: '9px', background: 'var(--gold)', color: 'var(--navy)', padding: '1px 5px', borderRadius: '3px', fontWeight: 800 }}>TOP</span>}
                                {stat.label}
                              </span>
                              <div style={{ display: 'flex', gap: '12px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--navy)' }}>{(stat.visits || 0).toLocaleString('es-ES')} <span style={{ fontWeight: 400, color: '#888' }}>vis.</span></span>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#10B981' }}>{(stat.interactions || 0).toLocaleString('es-ES')} <span style={{ fontWeight: 400, color: '#888' }}>int.</span></span>
                              </div>
                            </div>
                            <div style={{ height: '7px', background: '#f0ece4', borderRadius: '4px', overflow: 'hidden', marginBottom: '2px' }}>
                              <div className="stat-bar-fill" style={{ height: '100%', width: `${pct}%`, background: i === 0 ? 'var(--gold)' : 'var(--navy)', borderRadius: '4px', transition: '1s ease', animationDelay: `${0.3 + i * 0.07}s` }} />
                            </div>
                            <div style={{ height: '4px', background: '#ecfdf5', borderRadius: '4px', overflow: 'hidden' }}>
                              <div className="stat-bar-fill stat-bar-fill-green" style={{ height: '100%', width: `${intPct}%`, background: '#10B981', borderRadius: '4px', transition: '1s ease', animationDelay: `${0.45 + i * 0.07}s` }} />
                            </div>
                          </div>
                        );
                      })}
                    {(Array.isArray(pageStats) ? pageStats : []).filter(s => (s?.visits || 0) === 0).length > 0 && (
                      <p style={{ fontSize: '11px', color: '#bbb', textAlign: 'center', paddingTop: '8px', fontStyle: 'italic' }}>
                        {(Array.isArray(pageStats) ? pageStats : []).filter(s => (s?.visits || 0) === 0).length} secciones aún sin visitas
                      </p>
                    )}
                  </div>
                  <div style={{ marginTop: '16px', display: 'flex', gap: '16px', fontSize: '10px', color: '#888', paddingTop: '10px', borderTop: '1px solid #f0ece4' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '7px', background: 'var(--navy)', borderRadius: '2px', display: 'inline-block' }} /> Visitas</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '4px', background: '#10B981', borderRadius: '2px', display: 'inline-block' }} /> Interacciones</span>
                  </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="admin-dashboard-side-grid" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

                  {/* DISTRIBUTION DONUT (SVG) */}
                  <div className="admin-analytics-card pop-in" style={{ background: '#fff', border: '1px solid #e8e0d5', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', flex: 1, animationDelay: '0.3s' }}>
                    <h3 style={{ margin: '0 0 16px', color: 'var(--navy)', fontSize: '15px', fontWeight: 700 }}>🥧 Distribución por Sección</h3>
                    <p style={{ margin: '-10px 0 14px', fontSize: '11px', color: '#999' }}>Pasá el mouse por la dona o la leyenda para explorar</p>
                    <DonutChart items={(Array.isArray(pageStats) ? pageStats : []).filter(s => (s?.visits || 0) > 0).slice(0, 6).map(s => ({ label: s.label, visits: s.visits || 0 }))} />
                  </div>

                  {/* DISPOSITIVOS */}
                  <div className="admin-analytics-card pop-in" style={{ background: '#fff', border: '1px solid #e8e0d5', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', flex: 1, animationDelay: '0.4s' }}>
                    <h3 style={{ margin: '0 0 16px', color: 'var(--navy)', fontSize: '15px', fontWeight: 700 }}>📱 Dispositivos</h3>
                    {(() => {
                      const data = Array.isArray(pageStats) ? pageStats : [];
                      const desktop = data.reduce((acc, s) => acc + (s?.desktopVisits || 0), 0);
                      const tablet = data.reduce((acc, s) => acc + (s?.tabletVisits || 0), 0);
                      const mobile = data.reduce((acc, s) => acc + (s?.mobileVisits || 0), 0);
                      const totalDevices = desktop + tablet + mobile;

                      if (totalDevices === 0) return <p style={{ color: '#bbb', textAlign: 'center', padding: '10px 0', fontSize: '13px', fontStyle: 'italic', margin: 0 }}>Sin datos de dispositivos aún</p>;

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {[
                            { label: 'Celular', icon: '📱', value: mobile, pct: (mobile / totalDevices) * 100, color: '#10B981' },
                            { label: 'Computadora', icon: '💻', value: desktop, pct: (desktop / totalDevices) * 100, color: '#3B82F6' },
                            { label: 'Tablet', icon: '💻', value: tablet, pct: (tablet / totalDevices) * 100, color: '#C8973A' },
                          ].map((dev, i) => (
                            <div key={i}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--navy)' }}>
                                <span>{dev.icon} {dev.label}</span>
                                <span style={{ color: '#888' }}>{Math.round(dev.pct)}% ({dev.value.toLocaleString()})</span>
                              </div>
                              <div style={{ height: '6px', background: '#f0ece4', borderRadius: '3px', overflow: 'hidden' }}>
                                <div className="stat-bar-fill" style={{ height: '100%', width: `${dev.pct}%`, background: dev.color, borderRadius: '3px', transition: '1s ease', animationDelay: `${0.5 + i * 0.1}s` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* QUICK ACTIONS */}
                  <div className="admin-analytics-card pop-in" style={{ background: '#fff', border: '1px solid #e8e0d5', borderRadius: '16px', padding: '22px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', animationDelay: '0.5s' }}>
                    <h3 style={{ margin: '0 0 14px', color: 'var(--navy)', fontSize: '15px', fontWeight: 700 }}>⚡ Accesos Rápidos</h3>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {[
                        { icon: '📰', label: 'Nueva Noticia', mod: 'noticias' },
                        { icon: '📅', label: 'Nuevo Evento', mod: 'actividades' },
                        { icon: '🎠', label: 'Carrusel Hero', mod: 'carrusel' },
                        { icon: '🎨', label: 'Identidad Visual', mod: 'identidad' },
                      ].map((a, i) => (
                        <button key={i} onClick={() => navigateMod(a.mod as any)} className="quick-action-btn" style={{ width: '100%', textAlign: 'left', padding: '9px 14px', background: 'var(--cream)', border: '1px solid var(--gold-pale)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="quick-action-icon">{a.icon}</span> {a.label}
                          <span className="quick-action-arrow">→</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* STATUS BAR — Content summary */}
              <div className="admin-dashboard-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                {[
                  { label: 'Noticias', total: news.length, active: news.filter(n => n.published).length, icon: '📰', color: '#3B82F6' },
                  { label: 'Eventos', total: activities.length, active: activities.filter(a => a.active).length, icon: '📅', color: '#8B5CF6' },
                  { label: 'Capillas', total: chapels.length, active: chapels.filter(c => c.estadoComunidad === 'Activo').length, icon: '⛪', color: '#10B981' },
                  { label: 'Perfiles', total: profiles.length, active: profiles.length, icon: '👤', color: '#F59E0B' },
                  { label: 'Slides Hero', total: liveHeroImages.length, active: liveHeroImages.length, icon: '🎠', color: '#EF4444' },
                ].map((item, i) => (
                  <div key={i} className="mini-stat-card pop-in" style={{ animationDelay: `${0.15 + i * 0.08}s` }}>
                    <div className="mini-stat-icon" style={{ background: `${item.color}18`, color: item.color }}>{item.icon}</div>
                    <div style={{ fontSize: '10px', color: '#888', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>{item.label}</div>
                    <div className="mini-stat-total">{item.total}</div>
                    <div style={{ fontSize: '10px', color: item.color, fontWeight: 600, marginTop: '3px' }}>{item.active} activos</div>
                  </div>
                ))}
              </div>
              

              {/* RECENT ACTIVITY FEED */}
              <div className="pjl-card animate-reveal" style={{ marginTop: '30px', padding: '25px', background: '#fff', border: '1px solid var(--gold-pale)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 className="serif" style={{ color: 'var(--navy)', margin: 0, fontSize: '18px' }}>📜 Actividad Reciente</h3>
                  <button onClick={() => setLogs([])} className="premium-label" style={{ background: 'transparent', cursor: 'pointer', border: 'none', color: '#888', textDecoration: 'underline' }}>Limpiar Historial</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {logs.length === 0 ? (
                    <div className="pjl-empty-state" style={{ border: 'none', background: 'var(--cream)' }}>
                      <div className="empty-icon">📜</div>
                      <h4 className="empty-title">Sin actividad todavía</h4>
                      <p className="empty-desc">Cada acción que hagas en el panel (crear, editar, eliminar) quedará registrada aquí.</p>
                    </div>
                  ) : (
                    logs.map(log => (
                      <div key={log.id} className="dash-log-row" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 15px', background: 'var(--cream)', borderRadius: '12px', border: '1px solid var(--gold-pale)' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 900, flexShrink: 0 }}>
                          {log.userName[0]}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                            <span style={{ fontWeight: 800, fontSize: '12px', color: 'var(--navy)' }}>{log.userName}</span>
                            <span style={{ fontSize: '10px', color: '#888' }}>{new Date(log.timestamp).toLocaleString()}</span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{log.action.toUpperCase()}</span> en <span style={{ fontWeight: 600 }}>{log.module.toUpperCase()}</span>
                            {log.details && <span style={{ marginLeft: '10px', opacity: 0.7 }}>— {log.details}</span>}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* VATICAN NEWS - RELOCATED FROM SIDEBAR */}
              <div className="pjl-card animate-reveal" style={{ marginTop: '40px', padding: '30px', border: '1px solid var(--gold-pale)', background: 'var(--white)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>🇻🇦</span>
                    <h3 className="serif" style={{ color: 'var(--navy)', margin: 0, fontSize: '20px' }}>Vatican News Oficial</h3>
                  </div>
                  <span className="premium-label" style={{ fontSize: '10px', color: 'var(--gold)' }}>ACTUALIDAD DE LA IGLESIA</span>
                </div>
                <div style={{ 
                  borderRadius: '16px', 
                  overflow: 'hidden', 
                  background: '#fff', 
                  border: '1px solid var(--gold-pale)',
                  minHeight: '400px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.02)'
                }}>
                  {/* @ts-ignore */}
                  <vaticannews-widget lang="es" fontSize="18"></vaticannews-widget>
                  <Script src="https://www.vaticannews.va/widget.js" strategy="lazyOnload" />
                </div>
              </div>
            </div>
          )}



          {/* ASISTENTE IA */}
          {mod === 'asistente' && (
            <div className="animate-reveal pjl-card" style={{ padding: '40px', maxWidth: '900px', margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <span style={{ fontSize: '48px', display: 'block', marginBottom: '10px' }}>🤖</span>
                <h3 className="serif" style={{ color: 'var(--navy)', fontSize: '24px', marginBottom: '8px' }}>Asistente Inteligente PJL</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                  Escribe lo que necesitas y Google Gemini generará contenido para tus noticias, redes sociales o documentos.
                </p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="premium-label" style={{ display: 'block', marginBottom: '10px' }}>¿En qué te ayudo hoy?</label>
                <textarea
                  className="pjl-input"
                  style={{ minHeight: '120px', resize: 'vertical' }}
                  placeholder="Ej: Escribe un post para Instagram invitando al próximo retiro espiritual de la Pastoral Juvenil..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  disabled={isAiLoading}
                />
              </div>

              <button
                className="btn-premium btn-premium-gold"
                style={{ width: '100%', padding: '14px', fontSize: '15px' }}
                disabled={isAiLoading || !aiPrompt.trim()}
                onClick={async () => {
                  if (!aiPrompt.trim()) return;
                  setIsAiLoading(true);
                  setAiResponse('');
                  try {
                    const res = await fetch('/api/ai', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ prompt: aiPrompt })
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setAiResponse(data.text);
                      showToast('Contenido generado exitosamente ✨');
                    } else {
                      showToast('Error: ' + data.error);
                    }
                  } catch (e) {
                    showToast('Hubo un error de conexión con la IA');
                  } finally {
                    setIsAiLoading(false);
                  }
                }}
              >
                {isAiLoading ? 'Generando respuesta...' : 'Generar con IA ✨'}
              </button>

              {aiResponse && (
                <div className="animate-reveal" style={{ marginTop: '30px', padding: '25px', background: 'var(--cream)', borderRadius: '12px', border: '1px solid var(--gold-pale)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h4 className="serif" style={{ color: 'var(--navy)' }}>Respuesta Generada</h4>
                    <button
                      className="btn-premium btn-premium-outline"
                      style={{ padding: '6px 12px', fontSize: '11px' }}
                      onClick={() => {
                        navigator.clipboard.writeText(aiResponse);
                        showToast('Copiado al portapapeles 📋');
                      }}
                    >
                      Copiar Texto
                    </button>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', color: 'var(--navy)', fontSize: '14px', lineHeight: '1.6' }}>
                    {aiResponse}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* APARIENCIA */}
          {mod === 'apariencia' && (() => {
            const ratio = contrastRatio(navyHex, goldHex);
            const grade = ratio >= 7
              ? { t: 'AAA · Excelente', c: '#059669', bg: '#d1fae5' }
              : ratio >= 4.5
                ? { t: 'AA · Buena', c: '#16a34a', bg: '#dcfce7' }
                : ratio >= 3
                  ? { t: 'Contraste aceptable', c: '#d97706', bg: '#fef3c7' }
                  : { t: 'Contraste bajo', c: '#dc2626', bg: '#fee2e2' };
            return (
            <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>

              {/* HEADER */}
              <div className="ap-header pop-in">
                <div>
                  <h3 className="serif" style={{ marginBottom: '6px' }}>🎨 Apariencia del Sitio</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                    Presets litúrgicos, colores personalizados e iconos. Cada cambio se refleja al instante en todo el panel.
                  </p>
                </div>
                <div className="ap-contrast-badge" style={{ color: grade.c, background: grade.bg }} title={`Relación de contraste: ${ratio.toFixed(2)}:1`}>
                  <span className="ap-contrast-ratio">{ratio.toFixed(1)}</span>
                  <span>{grade.t}</span>
                </div>
              </div>

              <div className="ap-grid">

                {/* PRESETS LITÚRGICOS */}
                <div className="ap-card pop-in" style={{ animationDelay: '0.08s' }}>
                  <label className="premium-label" style={{ display: 'block', marginBottom: '14px' }}>PRESETS LITÚRGICOS</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                    {[
                      { label: 'T. Ordinario',  gold: '#C8973A', navy: '#1A3B2B' },
                      { label: 'Cuaresma/Adv.', gold: '#C8973A', navy: '#3B1A3A' },
                      { label: 'Pascua/Nav.',   gold: '#D4AF37', navy: '#1A2744' },
                      { label: 'Mártires/Esp.', gold: '#C8973A', navy: '#441A1A' },
                    ].map((preset, pi) => (
                      <button
                        key={preset.label}
                        className="liturgical-preset-btn ap-preset-btn pop-in"
                        style={{ animationDelay: `${0.12 + pi * 0.06}s` }}
                        onClick={() => {
                          applyThemeColor(preset.navy, preset.gold);
                          setNavyHex(preset.navy);
                          setGoldHex(preset.gold);
                          showToast(`Temporada: ${preset.label} aplicada ✔`);
                        }}
                      >
                        <span className="ap-preset-spheres" aria-hidden="true">
                          <i style={{ background: preset.navy }} />
                          <i style={{ background: preset.gold }} />
                        </span>
                        <span className="premium-label" style={{ fontSize: '10px' }}>{preset.label}</span>
                        <span className="ap-preset-mini" style={{ background: `linear-gradient(135deg, ${preset.navy} 62%, ${preset.gold} 62%)` }} aria-hidden="true" />
                      </button>
                    ))}
                  </div>

                  {/* PALETAS GUARDADAS */}
                  <div style={{ borderTop: '1px solid var(--gold-pale)', marginTop: '22px', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '10px', flexWrap: 'wrap' }}>
                      <label className="premium-label" style={{ display: 'block' }}>PALETAS GUARDADAS (MÁX. 5)</label>
                      <button
                        className="btn-premium btn-premium-gold"
                        style={{ fontSize: '11px', padding: '6px 14px' }}
                        onClick={() => {
                          const entry = { navy: navyHex, gold: goldHex };
                          const already = savedPalettes.some(p => p.navy === entry.navy && p.gold === entry.gold);
                          if (already) { showToast('Esta paleta ya fue guardada'); return; }
                          const updated = [entry, ...savedPalettes].slice(0, 5);
                          setSavedPalettes(updated);
                          localStorage.setItem('pjl_saved_palettes', JSON.stringify(updated));
                          showToast('Paleta guardada ✔');
                        }}
                      >+ Guardar actual</button>
                    </div>
                    {savedPalettes.length === 0 ? (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay paletas guardadas todavía. Personalizá los colores y presioná «Guardar actual».</p>
                    ) : (
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {savedPalettes.map((p, i) => (
                          <div key={i} className="ap-saved-item pop-in" style={{ animationDelay: `${0.2 + i * 0.06}s` }}>
                            <button
                              title={`${p.navy} / ${p.gold}`}
                              className="ap-swatch-btn"
                              onClick={() => { setNavyHex(p.navy); setGoldHex(p.gold); applyThemeColor(p.navy, p.gold); showToast('Paleta aplicada ✔'); }}
                            >
                              <i style={{ background: p.navy }} />
                              <i style={{ background: p.gold }} />
                            </button>
                            <button
                              onClick={() => { const upd = savedPalettes.filter((_, idx) => idx !== i); setSavedPalettes(upd); localStorage.setItem('pjl_saved_palettes', JSON.stringify(upd)); }}
                              style={{ fontSize: '10px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >× Quitar</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* COLUMNA DERECHA: MOCKUP EN VIVO + ACCIONES */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

                  {/* VISTA PREVIA EN VIVO */}
                  <div className="ap-card pop-in" style={{ animationDelay: '0.16s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '8px', flexWrap: 'wrap' }}>
                      <label className="premium-label" style={{ display: 'block' }}>VISTA PREVIA EN VIVO</label>
                      <span style={{ fontSize: '10px', color: '#999' }}>Se actualiza al instante ✨</span>
                    </div>
                    <div className="ap-mockup" style={{ background: navyHex }}>
                      <div className="ap-mockup-nav">
                        <span className="ap-mockup-logo" style={{ background: goldHex }}>✝</span>
                        <span className="ap-mockup-title">PJL LUQUE</span>
                        <span className="ap-mockup-links">
                          <i style={{ background: goldHex }} />
                          <i style={{ background: goldHex, opacity: 0.65 }} />
                          <i style={{ background: goldHex, opacity: 0.35 }} />
                        </span>
                      </div>
                      <div className="ap-mockup-hero">
                        <span className="ap-mockup-line" style={{ width: '68%', background: 'rgba(255,255,255,0.92)' }} />
                        <span className="ap-mockup-line" style={{ width: '46%', background: goldHex }} />
                        <span className="ap-mockup-line thin" style={{ width: '82%', background: 'rgba(255,255,255,0.28)' }} />
                        <span className="ap-mockup-btn" style={{ background: goldHex, color: navyHex }}>Explorar</span>
                      </div>
                      <div className="ap-mockup-footer" style={{ background: goldHex }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginTop: '14px', flexWrap: 'wrap' }}>
                      <button className="ap-hex-chip" onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(navyHex).then(() => showToast('Hex copiado ✔')); }} title="Click para copiar">
                        <i style={{ background: navyHex }} /> {navyHex.toUpperCase()}
                      </button>
                      <button className="ap-hex-chip" onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(goldHex).then(() => showToast('Hex copiado ✔')); }} title="Click para copiar">
                        <i style={{ background: goldHex }} /> {goldHex.toUpperCase()}
                      </button>
                    </div>
                  </div>

                  {/* ACCIONES */}
                  <div className="ap-card pop-in" style={{ animationDelay: '0.24s' }}>
                    <label className="premium-label" style={{ display: 'block', marginBottom: '14px' }}>ACCIONES RÁPIDAS</label>
                    <div style={{ display: 'grid', gap: '10px' }}>
                      <button
                        className="btn-premium btn-premium-gold quick-action-btn"
                        onClick={() => {
                          const n = NAVY_POOL[Math.floor(Math.random() * NAVY_POOL.length)];
                          const g = GOLD_POOL[Math.floor(Math.random() * GOLD_POOL.length)];
                          applyThemeColor(n, g);
                          setNavyHex(n);
                          setGoldHex(g);
                          showToast('Paleta aleatoria generada 🎲');
                        }}
                      ><span className="quick-action-icon">🎲</span> Sorpréndeme: paleta aleatoria <span className="quick-action-arrow">→</span></button>
                      <button
                        className="btn-premium btn-premium-outline quick-action-btn"
                        onClick={() => {
                          const def = { gold: '#C8973A', navy: '#1A2744' };
                          applyThemeColor(def.navy, def.gold);
                          setNavyHex(def.navy);
                          setGoldHex(def.gold);
                          showToast('Colores restaurados al original ✔');
                        }}
                      ><span className="quick-action-icon">↺</span> Restaurar originales <span className="quick-action-arrow">→</span></button>
                      <button className="btn-premium btn-premium-outline quick-action-btn" onClick={() => showToast('Paleta de colores guardada ✔')}>
                        <span className="quick-action-icon">💾</span> Guardar apariencia <span className="quick-action-arrow">→</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* PERSONALIZACIÓN MANUAL */}
              <h4 className="serif" style={{ fontSize: '1.25rem', margin: '6px 0 4px' }}>Personalización Manual</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginBottom: '18px' }}>Ajustá cada color con el selector, el código hex o la intensidad. Click en un mini-swatch para copiar el código.</p>
              <div className="ap-grid">

                {/* NAVY */}
                <div className="form-group ap-color-card pop-in" style={{ animationDelay: '0.3s' }}>
                  <label className="premium-label" style={{ display: 'block', marginBottom: '10px' }}>🎨 Color Primario (Fondo, Footer, Encabezados)</label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <input
                      type="color"
                      value={navyHex}
                      onChange={e => {
                        setNavyHex(e.target.value);
                        applyThemeColor(e.target.value, goldHex);
                      }}
                      style={{ width: '56px', height: '56px', cursor: 'pointer', border: '2px solid var(--gold-pale)', borderRadius: '10px', padding: '2px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        className="pjl-input"
                        value={navyHex}
                        maxLength={7}
                        onChange={e => {
                          const v = e.target.value;
                          setNavyHex(v);
                          if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
                            applyThemeColor(v, goldHex);
                          }
                        }}
                        placeholder="#1A2744"
                        style={{ fontFamily: 'monospace', letterSpacing: '1px' }}
                      />
                      <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {['#1A2744', '#1A3B2B', '#3B1A3A', '#441A1A', '#0F1F3D', '#2C3E50'].map(c => (
                          <button key={c} className="ap-mini-swatch" onClick={() => { setNavyHex(c); applyThemeColor(c, goldHex); if (navigator.clipboard) navigator.clipboard.writeText(c).then(() => showToast(`${c.toUpperCase()} copiado ✔`)); }}
                            style={{ width: '22px', height: '22px', borderRadius: '4px', background: c, border: navyHex === c ? '2px solid var(--gold)' : '1px solid #ccc', cursor: 'pointer' }} />
                        ))}
                      </div>
                      <div style={{ marginTop: '8px' }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Intensidad</label>
                        <input type="range" min={0} max={100} value={parseInt(navyHex.slice(1, 3), 16)} style={{ width: '100%', accentColor: 'var(--gold)' }}
                          onChange={e => {
                            const bright = Math.round(parseInt(e.target.value));
                            const hex = bright.toString(16).padStart(2, '0');
                            const newColor = `#${hex}${navyHex.slice(3)}`;
                            setNavyHex(newColor);
                            applyThemeColor(newColor, goldHex);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* GOLD */}
                <div className="form-group ap-color-card pop-in" style={{ animationDelay: '0.38s' }}>
                  <label className="premium-label" style={{ display: 'block', marginBottom: '10px' }}>✨ Color Secundario (Bordes, Botones, Detalles)</label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <input
                      type="color"
                      value={goldHex}
                      onChange={e => {
                        setGoldHex(e.target.value);
                        applyThemeColor(navyHex, e.target.value);
                      }}
                      style={{ width: '56px', height: '56px', cursor: 'pointer', border: '2px solid var(--gold-pale)', borderRadius: '10px', padding: '2px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        className="pjl-input"
                        value={goldHex}
                        maxLength={7}
                        onChange={e => {
                          const v = e.target.value;
                          setGoldHex(v);
                          if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
                            applyThemeColor(navyHex, v);
                          }
                        }}
                        placeholder="#C8973A"
                        style={{ fontFamily: 'monospace', letterSpacing: '1px' }}
                      />
                      <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {['#C8973A', '#D4AF37', '#B8860B', '#DAA520', '#E6BE6A', '#A0783A'].map(c => (
                          <button key={c} className="ap-mini-swatch" onClick={() => { setGoldHex(c); applyThemeColor(navyHex, c); if (navigator.clipboard) navigator.clipboard.writeText(c).then(() => showToast(`${c.toUpperCase()} copiado ✔`)); }}
                            style={{ width: '22px', height: '22px', borderRadius: '4px', background: c, border: goldHex === c ? '2px solid var(--navy)' : '1px solid #ccc', cursor: 'pointer' }} />
                        ))}
                      </div>
                      <div style={{ marginTop: '8px' }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Intensidad</label>
                        <input type="range" min={0} max={255} value={parseInt(goldHex.slice(1, 3), 16)} style={{ width: '100%', accentColor: 'var(--gold)' }}
                          onChange={e => {
                            const bright = Math.round(parseInt(e.target.value));
                            const hex = bright.toString(16).padStart(2, '0');
                            const newColor = `#${hex}${goldHex.slice(3)}`;
                            setGoldHex(newColor);
                            applyThemeColor(navyHex, newColor);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ICONOS DEL PANEL */}
              <div className="ap-card pop-in" style={{ animationDelay: '0.46s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '14px', flexWrap: 'wrap', marginBottom: '18px' }}>
                  <div>
                    <label className="premium-label" style={{ display: 'block', marginBottom: '6px' }}>🧩 ICONOS DEL PANEL ADMIN</label>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, maxWidth: '640px' }}>
                      Cambiá el icono de cada botón del menú lateral sin afectar el frontend público.
                    </p>
                  </div>
                  <button
                    className="btn-premium btn-premium-outline"
                    style={{ padding: '8px 14px', fontSize: '11px' }}
                    onClick={() => {
                      setBranding({
                        ...branding,
                        adminIconDashboard: '📊',
                        adminIconIdentidad: '🎨',
                        adminIconCarrusel: '🖼️',
                        adminIconApariencia: '✨',
                        adminIconContenido: '📝',
                        adminIconNoticias: '📰',
                        adminIconActividades: '📅',
                        adminIconCapillas: '⛪',
                        adminIconPerfiles: '👤',
                        adminIconDocumentos: '📁',
                        adminIconUsuarios: '👥',
                        adminIconLogs: '📜',
                        adminIconConfiguracion: '⚙️',
                        adminIconAsistente: '🤖',
                      });
                      showToast('Iconos restaurados ✔');
                    }}
                  >
                    Restaurar iconos
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {NAV_ITEMS.map((item, idx) => {
                    const currentIcon = (branding[item.iconKey as keyof Branding] as string) || item.defaultIcon;
                    return (
                      <div key={item.id} className="ap-icon-card pop-in" style={{ animationDelay: `${0.5 + idx * 0.035}s` }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                          <div>
                            <p className="premium-label" style={{ marginBottom: '4px' }}>{item.label}</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Icono del menú</p>
                          </div>
                          <div className="ap-icon-preview">{currentIcon}</div>
                        </div>
                        <input
                          type="text"
                          className="pjl-input"
                          value={currentIcon}
                          maxLength={4}
                          onChange={(e) => setBranding({ ...branding, [item.iconKey]: e.target.value })}
                          placeholder={item.defaultIcon}
                          style={{ textAlign: 'center', fontSize: '20px', padding: '10px 12px', minHeight: '48px' }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            );
          })()}

          {/* IDENTIDAD */}
          {mod === 'identidad' && (() => {
            const syncOk = supabaseStatus?.ok === true;
            const syncState = syncOk ? 'ok' : supabaseStatus ? 'warn' : '';
            const syncText = syncOk
              ? 'Sincronizado · los cambios llegan a todos los dispositivos'
              : supabaseStatus
                ? 'Sin nube · los cambios quedan solo en este dispositivo'
                : 'Verificando sincronización…';
            const activosCount = [branding.mainLogo, branding.whiteLogo, branding.favLogo, branding.zona1Logo, branding.zona2Logo, branding.zona3Logo, branding.zona4Logo].filter(Boolean).length;
            return (
            <div className="animate-reveal pjl-card identity-shell">

              {/* HEADER */}
              <div className="admin-section-header admin-stack-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '26px' }}>
                <div className="admin-section-title-group">
                  <h3 className="serif admin-section-title" style={{ margin: 0 }}>Identidad de Marca</h3>
                  <p className="admin-section-desc">Logos, colores y escudos oficiales de la Pastoral. Cada cambio se refleja automáticamente en el sitio público.</p>
                </div>
                <div className={`identity-sync-badge ${syncState}`}>
                  <span className="identity-sync-dot" />
                  <span>{syncText}</span>
                </div>
              </div>

              {/* HERO PREVIEW */}
              <div className="identity-hero-grid" style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '16px', marginBottom: '28px' }}>
                <div className="identity-hero">
                  <div className="identity-hero-shine" />
                  <div className="identity-hero-tag">Vista de marca</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
                    <div className="identity-hero-logo">
                      {branding.mainLogo ? <img src={branding.mainLogo} alt="Logo principal" /> : <span>⛪</span>}
                    </div>
                    <div>
                      <div className="serif" style={{ fontSize: '1.5rem', lineHeight: 1.1 }}>PJL Luqueña</div>
                      <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '6px' }}>Así se ve tu logo en el encabezado del sitio</div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div className="identity-stat-box">
                    <span className="identity-stat-icon">🖼️</span>
                    <div>
                      <div className="identity-stat-label">ACTIVOS VISUALES</div>
                      <div className="identity-stat-value">{activosCount} <small>de 7</small></div>
                    </div>
                  </div>
                  <div className="identity-stat-box is-cream">
                    <span className="identity-stat-icon">💧</span>
                    <div>
                      <div className="identity-stat-label">MARCA DE AGUA</div>
                      <div className="identity-stat-value" style={{ fontSize: '15px' }}>{branding.logoWatermark ? 'Activa en el sitio' : 'Desactivada'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* LOGOS PRINCIPALES */}
              <div className="identity-section-label"><span>Logos principales</span></div>
              <div className="identity-blocks">

                <div className="identity-logo-row identity-rise">
                  <div className="identity-logo-preview">
                    {branding.mainLogo ? <img src={branding.mainLogo} alt="Logo principal" /> : <span>⛪</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="premium-label" style={{ marginBottom: '4px' }}>LOGO PRINCIPAL DEL SITIO</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px' }}>Aparece en el menú de navegación, el pie de página y los documentos.</p>
                    <label className="btn-premium btn-premium-gold" style={{ padding: '9px 18px', fontSize: '11px' }}>
                      CAMBIAR LOGO
                      <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileUpload(e, (url) => { setBranding({...branding, mainLogo: url}); showToast('Logo principal actualizado ✔'); })} />
                    </label>
                  </div>
                </div>

                <div className="identity-toggle-row identity-rise" style={{ animationDelay: '70ms' }}>
                  <span className="identity-toggle-icon">💧</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, color: 'var(--navy)', margin: 0, fontSize: '13px' }}>Marca de Agua del Logo</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Muestra el logo suave de fondo en todo el sitio</p>
                  </div>
                  <label className="pjl-switch">
                    <input type="checkbox" checked={!!branding.logoWatermark} onChange={(e) => setBranding({...branding, logoWatermark: e.target.checked})} />
                    <span className="pjl-slider"></span>
                  </label>
                </div>

                <div className="identity-duo-grid">
                  {[
                    { key: 'whiteLogo', label: 'LOGO BLANCO', desc: 'Para fondos oscuros', dark: true },
                    { key: 'favLogo', label: 'FAVICON / SELLO', desc: 'Icono de la pestaña', dark: false }
                  ].map((lg, i) => (
                    <div key={lg.key} className="identity-mini-card identity-rise" style={{ animationDelay: `${140 + i * 70}ms` }}>
                      <p className="premium-label" style={{ fontSize: '10px', marginBottom: '10px' }}>{lg.label}</p>
                      <div className="identity-mini-body">
                        <div className={`identity-mini-preview ${lg.dark ? 'is-dark' : ''}`}>
                          <SafeImg src={branding[lg.key] as string} alt={lg.label} fallback="🖼️" fallbackStyle={{ fontSize: '22px', background: 'transparent' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 8px' }}>{lg.desc}</p>
                          <label className="btn-premium btn-premium-outline" style={{ padding: '7px 14px', fontSize: '10px' }}>
                            SUBIR
                            <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileUpload(e, (url) => { setBranding({...branding, [lg.key]: url}); showToast(`${lg.label} actualizado ✔`); })} />
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ZONAS PASTORALES */}
              <div className="identity-section-label" style={{ marginTop: '30px' }}><span>Zonas pastorales</span></div>
              <div className="identity-zones-grid">
                {[1, 2, 3, 4].map((z, i) => {
                  const zColor = (branding[`zona${z}Color`] as string) || '#C8973A';
                  return (
                    <div key={z} className="identity-zone-card identity-rise" style={{ animationDelay: `${i * 80}ms` }}>
                      <div className="identity-zone-bar" style={{ background: zColor }} />
                      <div className="identity-zone-head">
                        <span className="identity-zone-name">Zona {z}</span>
                        <label className="identity-color-swatch" title="Elegir color de la zona" style={{ background: zColor }}>
                          <input
                            type="color"
                            value={zColor}
                            onChange={(e) => setBranding({...branding, [`zona${z}Color`]: e.target.value})}
                          />
                        </label>
                      </div>
                      <div className="identity-zone-body">
                        <div className="identity-zone-shield">
                          <SafeImg src={branding[`zona${z}Logo`] as string} alt={`Escudo Zona ${z}`} fallback="🛡️" fallbackStyle={{ fontSize: '26px', background: 'transparent' }} />
                        </div>
                        <label className="btn-premium btn-premium-outline identity-zone-upload">
                          SUBIR ESCUDO
                          <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileUpload(e, (url) => { setBranding({...branding, [`zona${z}Logo`]: url}); showToast(`Escudo Zona ${z} actualizado ✔`); })} />
                        </label>
                      </div>
                      <div className="identity-zone-hex">{zColor.toUpperCase()}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })()}


          {/* CONTENIDO REORGANIZADO */}
          {mod === 'contenido' && (
            <div className="animate-reveal pjl-card" style={{ padding: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '2px solid var(--gold-pale)', paddingBottom: '15px', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <h3 className="serif" style={{ margin: 0 }}>Gestión de Contenido</h3>
                  <p className="admin-section-desc">Edita todos los textos visibles del sitio: página de inicio, información institucional, misión, historia y calendario.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'institucional', label: 'INSTITUCIONAL' },
                    { id: 'textos_inicio', label: 'TEXTOS DE INICIO' },
                    { id: 'mision_vision', label: 'MISIÓN/VISIÓN' },
                    { id: 'objetivos', label: 'OBJETIVOS' },
                    { id: 'historia', label: 'HISTORIA' },
                    { id: 'google_calendar', label: 'CALENDARIO' }
                  ].map(tab => (
                    <button 
                      key={tab.id}
                      onClick={() => setActiveContentTab(tab.id)}
                      className={`btn-premium ${activeContentTab === tab.id ? 'btn-premium-gold' : 'btn-premium-outline'}`}
                      style={{ padding: '6px 12px', fontSize: '10px' }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ minHeight: '400px' }}>
                
                {/* TAB: TEXTOS DE INICIO */}
                {activeContentTab === 'textos_inicio' && (
                  <div className="animate-reveal">
                    <h4 className="serif" style={{ marginBottom: '20px', color: 'var(--navy)' }}>🏠 Textos de la Página Principal</h4>
                    
                    <div style={{ display: 'grid', gap: '25px' }}>
                      <div className="pjl-card" style={{ padding: '20px', background: 'var(--cream)', border: '1px solid var(--gold-pale)' }}>
                        <h5 style={{ color: 'var(--navy)', marginBottom: '15px' }}>Sección: Banner Principal (Hero)</h5>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                          <div className="form-group">
                            <label className="premium-label">ETIQUETA SUPERIOR (Ej: Diócesis de San Lorenzo)</label>
                            <input className="pjl-input" value={content.heroTag || ''} onChange={e => setContent({ ...content, heroTag: e.target.value })} />
                          </div>
                          <div className="form-group">
                            <label className="premium-label">TÍTULO PRINCIPAL (Soporta HTML básico)</label>
                            <input className="pjl-input" value={content.heroTitle || ''} onChange={e => setContent({ ...content, heroTitle: e.target.value })} />
                            {content.heroTitle && (
                              <div style={{ marginTop: '10px', padding: '15px', background: 'var(--navy)', borderRadius: '12px', border: '1px solid var(--gold)' }}>
                                <p style={{ fontSize: '10px', color: 'var(--gold)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Previsualización del Título:</p>
                                <h1 className="serif" style={{ color: '#fff', fontSize: '1.8rem', margin: 0 }} dangerouslySetInnerHTML={{ __html: content.heroTitle }} />
                              </div>
                            )}
                          </div>
                          <div className="form-group">
                            <label className="premium-label">TEXTO DESCRIPTIVO BREVE</label>
                            <textarea className="pjl-input" rows={3} value={content.heroText || ''} onChange={e => setContent({ ...content, heroText: e.target.value })} />
                          </div>
                        </div>
                      </div>

                      <div className="pjl-card" style={{ padding: '20px', background: 'var(--cream)', border: '1px solid var(--gold-pale)' }}>
                        <h5 style={{ color: 'var(--navy)', marginBottom: '15px' }}>Encabezados de Secciones</h5>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                          {[
                            { id: 'equipos', label: 'ESTRUCTURA', tag: 'equiposTag', title: 'equiposTitle' },
                            { id: 'zonas', label: 'ZONAS', tag: 'zonasTag', title: 'zonasTitle' },
                            { id: 'news', label: 'NOTICIAS', tag: 'newsTag', title: 'newsTitle' },
                            { id: 'agenda', label: 'EVENTOS', tag: 'agendaTag', title: 'agendaTitle' }
                          ].map(sec => (
                            <div key={sec.id} style={{ display: 'grid', gap: '10px' }}>
                              <div className="form-group">
                                <label className="premium-label">ETIQUETA {sec.label}</label>
                                <input className="pjl-input" value={(content as any)[sec.tag] || ''} onChange={e => setContent({ ...content, [sec.tag]: e.target.value })} />
                              </div>
                              <div className="form-group">
                                <label className="premium-label">TÍTULO {sec.label}</label>
                                <input className="pjl-input" value={(content as any)[sec.title] || ''} onChange={e => setContent({ ...content, [sec.title]: e.target.value })} />
                                {(content as any)[sec.title] && (
                                  <div style={{ marginTop: '5px', padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid var(--gold-pale)' }}>
                                    <p style={{ fontSize: '9px', color: 'var(--gold)', marginBottom: '4px', textTransform: 'uppercase' }}>Vista Previa:</p>
                                    <h4 className="serif" style={{ color: 'var(--navy)', fontSize: '1.1rem', margin: 0 }} dangerouslySetInnerHTML={{ __html: (content as any)[sec.title] }} />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB: INSTITUCIONAL */}
                {activeContentTab === 'institucional' && (
                  <div className="animate-reveal">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
                      <div style={{ display: 'grid', gap: '22px' }}>
                        <div className="pjl-card" style={{ padding: '24px 28px', background: 'var(--cream)', border: '1px solid var(--gold-pale)', borderRadius: '24px' }}>
                          <h4 className="serif" style={{ marginBottom: '18px', color: 'var(--navy)' }}>📍 Información Principal</h4>
                          <div className="form-group">
                            <label className="premium-label">TÍTULO INTRODUCTORIO</label>
                            <input className="pjl-input" value={content.instiTitulo || ''} onChange={e => setContent({ ...content, instiTitulo: e.target.value })} placeholder="Ej: Bienvenidos a la Pastoral" />
                          </div>
                          <div className="form-group">
                            <label className="premium-label">SUBTÍTULO / RESUMEN</label>
                            <input className="pjl-input" value={content.instiSubtitle || ''} onChange={e => setContent({ ...content, instiSubtitle: e.target.value })} placeholder="Ej: Una red pastoral joven que hace de la fe una experiencia comunitaria" />
                          </div>
                          <div className="form-group">
                            <label className="premium-label">TEXTO DETALLADO</label>
                            <textarea className="pjl-input" rows={5} value={content.instiDesc || ''} onChange={e => setContent({ ...content, instiDesc: e.target.value })} placeholder="Describe la estructura, misión y estilo institucional." />
                          </div>
                          <div className="form-group">
                            <label className="premium-label">TEXTO ALT DE LA IMAGEN</label>
                            <input className="pjl-input" value={content.instiAltText || ''} onChange={e => setContent({ ...content, instiAltText: e.target.value })} placeholder="Texto alternativo de la foto" />
                          </div>
                        </div>

                        <div className="pjl-card" style={{ padding: '24px 28px', background: '#fff', border: '1px solid var(--gold-pale)', borderRadius: '24px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '18px', marginBottom: '16px' }}>
                            <div>
                              <h5 className="serif" style={{ color: 'var(--navy)', margin: 0 }}>Idea para mejorar la sección</h5>
                              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px' }}>Agrega subtítulos, tarjetas breves y un texto más aspiracional para que la zona luzca más estética y profesional.</p>
                            </div>
                            <button
                              className="btn-premium btn-premium-outline"
                              style={{ padding: '10px 16px', fontSize: '11px' }}
                              onClick={() => {
                                setContent({
                                  ...content,
                                  instiSubtitle: content.instiSubtitle || 'Una red pastoral joven que hace de la fe una experiencia comunitaria',
                                  instiDesc: content.instiDesc || 'Nuestra estructura combina liderazgo, acompañamiento espiritual y presencia territorial para impulsar a los jóvenes de Luque a vivir la fe con alegría y compromiso.',
                                  instiCards: [
                                    { title: 'Liderazgo Compartido', text: 'Coordinadores, equipos zonales y comunidades trabajan juntos para construir una pastoral fuerte y cercana.', icon: '🤝' },
                                    { title: 'Presencia Territorial', text: 'Cuatro zonas pastorales con identidad propia, unidas por el servicio, la formación y la misión juvenil.', icon: '📍' },
                                    { title: 'Firma Pastoral', text: 'Tradición, acompañamiento y alegría en cada acción pastoral que transforma la realidad de Luque.', icon: '🌟' }
                                  ]
                                });
                                showToast('Texto sugerido aplicado ✔');
                              }}
                            >Sugerir texto</button>
                          </div>
                          <div style={{ display: 'grid', gap: '14px' }}>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Estas tarjetas ayudan a construir una presentación más atractiva y moderna de la estructura institucional.</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                              {(content.instiCards || []).slice(0, 3).map((card, idx) => (
                                <div key={idx} style={{ padding: '16px', background: 'var(--cream)', borderRadius: '16px', border: '1px solid var(--gold-pale)', minHeight: '132px' }}>
                                  <div style={{ fontSize: '20px', marginBottom: '10px' }}>{card.icon || '✨'}</div>
                                  <strong style={{ display: 'block', marginBottom: '6px', color: 'var(--navy)' }}>{card.title || `Idea ${idx + 1}`}</strong>
                                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>{card.text || 'Texto adicional para enfatizar la ventaja de la estructura.'}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gap: '18px' }}>
                        <div style={{ padding: '28px', borderRadius: '28px', background: 'linear-gradient(180deg, #ffffff, #fbf8ef)', border: '1px solid rgba(200,151,58,0.2)', boxShadow: '0 20px 40px rgba(0,0,0,0.04)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                            <span style={{ width: '44px', height: '44px', borderRadius: '16px', background: 'var(--gold)', display: 'grid', placeItems: 'center', color: 'var(--navy)', fontSize: '20px' }}>🏛️</span>
                            <div>
                              <p className="premium-label" style={{ margin: 0 }}>Previsualización Institucional</p>
                              <h4 className="serif" style={{ margin: '8px 0 0', color: 'var(--navy)' }}>Estructura más atractiva</h4>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gap: '16px' }}>
                            <span style={{ color: 'var(--gold)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>{content.instiSubtitle || 'Subtítulo institucional'}</span>
                            <h3 className="serif" style={{ margin: 0, color: 'var(--navy)', fontSize: '2rem', lineHeight: 1.1 }}>{content.instiTitulo || 'Nuestra Identidad'}</h3>
                            <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.8 }}>{content.instiDesc || 'Texto descriptivo sobre la estructura institucional y la presencia pastoral.'}</p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                              {(content.instiCards || []).slice(0, 2).map((card, idx) => (
                                <div key={idx} style={{ padding: '16px', background: '#fff', borderRadius: '18px', border: '1px solid var(--gold-pale)' }}>
                                  <div style={{ fontSize: '18px', marginBottom: '10px' }}>{card.icon || '✨'}</div>
                                  <strong style={{ display: 'block', marginBottom: '6px', color: 'var(--navy)' }}>{card.title || `Tarjeta ${idx + 1}`}</strong>
                                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>{card.text || 'Detalle breve de la estructura.'}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div style={{ borderRadius: '24px', overflow: 'hidden', background: 'var(--white)', border: '1px solid var(--gold-pale)' }}>
                          {content.instiFoto ? (
                            <img src={content.instiFoto} alt={content.instiAltText || 'Imagen institucional'} style={{ width: '100%', height: '320px', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '320px', display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg, #fffaf0, #f5f1e4)', color: 'var(--gold)', fontSize: '22px', fontWeight: 700 }}>
                              Imagen Institucional
                            </div>
                          )}
                          <div style={{ padding: '18px 22px' }}>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>Esta vista previa muestra cómo el contenido se verá con un estilo más cuidado y editorial.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pjl-card" style={{ padding: '28px', background: 'var(--cream)', border: '1px solid var(--gold-pale)', borderRadius: '24px' }}>
                      <h4 className="serif" style={{ marginBottom: '18px', color: 'var(--navy)' }}>Tarjetas de apoyo para la estructura</h4>
                      <div style={{ display: 'grid', gap: '18px' }}>
                        {(content.instiCards || []).map((card, idx) => (
                          <div key={idx} style={{ display: 'grid', gap: '12px', background: '#fff', borderRadius: '18px', border: '1px solid var(--gold-pale)', padding: '18px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                              <div>
                                <p className="premium-label" style={{ marginBottom: '6px' }}>TARJETA {idx + 1}</p>
                                <input
                                  className="pjl-input"
                                  value={card.icon || ''}
                                  onChange={e => {
                                    const cards = [...(content.instiCards || [])];
                                    cards[idx] = { ...cards[idx], icon: e.target.value };
                                    setContent({ ...content, instiCards: cards });
                                  }}
                                  placeholder="Icono (Ej: 🤝, 🌟, 📍)"
                                />
                              </div>
                              <div style={{ flex: 1, display: 'grid', gap: '10px' }}>
                                <input
                                  className="pjl-input"
                                  value={card.title || ''}
                                  onChange={e => {
                                    const cards = [...(content.instiCards || [])];
                                    cards[idx] = { ...cards[idx], title: e.target.value };
                                    setContent({ ...content, instiCards: cards });
                                  }}
                                  placeholder="Título de la tarjeta"
                                />
                                <textarea
                                  className="pjl-input"
                                  rows={2}
                                  value={card.text || ''}
                                  onChange={e => {
                                    const cards = [...(content.instiCards || [])];
                                    cards[idx] = { ...cards[idx], text: e.target.value };
                                    setContent({ ...content, instiCards: cards });
                                  }}
                                  placeholder="Texto breve de apoyo"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB: MISIÓN Y VISIÓN */}
                {activeContentTab === 'mision_vision' && (
                  <div className="animate-reveal" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                    <div className="form-group">
                      <label className="premium-label">NUESTRA MISIÓN</label>
                      <textarea className="pjl-input" rows={12} value={content.mision || ''} onChange={e => setContent({ ...content, mision: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="premium-label">NUESTRA VISIÓN</label>
                      <textarea className="pjl-input" rows={12} value={content.vision || ''} onChange={e => setContent({ ...content, vision: e.target.value })} />
                    </div>
                  </div>
                )}

                {/* TAB: OBJETIVOS */}
                {activeContentTab === 'objetivos' && (
                  <div className="animate-reveal" style={{ display: 'grid', gap: '30px' }}>
                    <div className="form-group">
                      <label className="premium-label">OBJETIVO GENERAL</label>
                      <textarea className="pjl-input" rows={6} value={content.objetivoGeneral || ''} onChange={e => setContent({ ...content, objetivoGeneral: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="premium-label">LÍNEAS DE ACCIÓN / ESTATUTOS</label>
                      <textarea className="pjl-input" rows={6} value={content.lineasAccion || ''} onChange={e => setContent({ ...content, lineasAccion: e.target.value })} />
                    </div>
                  </div>
                )}

                {/* TAB: HISTORIA */}
                {activeContentTab === 'historia' && (
                  <div className="animate-reveal">
                    <h4 className="serif" style={{ marginBottom: '10px' }}>Línea de Tiempo (Nuestra Historia)</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '25px' }}>Arrastra, edita y añade los hitos históricos. Estos se reflejarán inmediatamente en la sección &quot;Nuestra Historia&quot; de la página principal.</p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', borderLeft: '2px dashed var(--gold-pale)', paddingLeft: '30px', marginLeft: '10px', position: 'relative' }}>
                      {(content.historiaTimeline || []).map((item, idx) => (
                        <div key={item.id} style={{ background: '#fff', padding: '25px', borderRadius: '16px', border: '1px solid #e8e0d5', position: 'relative', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', transition: '0.3s' }}>
                          <div style={{ position: 'absolute', left: '-41px', top: '35px', width: '20px', height: '20px', background: item.accentColor || 'var(--gold)', borderRadius: '50%', border: '5px solid #faf9f6', boxShadow: '0 0 0 1px var(--gold-pale)' }}></div>
                          
                          <button 
                            onClick={() => {
                              const newTimeline = content.historiaTimeline.filter((_, i) => i !== idx);
                              setContent({ ...content, historiaTimeline: newTimeline });
                            }}
                            title="Eliminar evento"
                            style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', transition: '0.2s', zIndex: 10 }}
                          >×</button>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
                            <div className="form-group">
                              <label className="premium-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ background: 'var(--cream)', padding: '4px 8px', borderRadius: '6px', color: 'var(--gold)' }}>📅</span>
                                AÑO / TÍTULO
                              </label>
                              <input className="pjl-input" placeholder="Ej: 2015 - Fundación..." style={{ fontSize: '15px', fontWeight: 700 }} value={item.title} onChange={e => {
                                const nt = [...content.historiaTimeline]; nt[idx].title = e.target.value; setContent({...content, historiaTimeline: nt});
                              }} />
                            </div>
                            <div className="form-group">
                              <label className="premium-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ background: 'var(--cream)', padding: '4px 8px', borderRadius: '6px', color: 'var(--gold)' }}>📝</span>
                                DESCRIPCIÓN DEL HITO
                              </label>
                              <textarea className="pjl-input" rows={4} placeholder="Escribe la historia de este hito..." style={{ fontSize: '14px', lineHeight: '1.6' }} value={item.text} onChange={e => {
                                const nt = [...content.historiaTimeline]; nt[idx].text = e.target.value; setContent({...content, historiaTimeline: nt});
                              }} />
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: '20px', marginTop: '18px' }}>
                            <div className="form-group">
                              <label className="premium-label">IMAGEN DEL HITO</label>
                              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ width: '96px', height: '72px', borderRadius: '14px', border: '1px solid var(--gold-pale)', overflow: 'hidden', background: 'linear-gradient(135deg, var(--cream), #fff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {item.image ? <img src={item.image} alt={item.title || 'Vista previa del hito'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '28px', opacity: 0.35 }}>🖼️</span>}
                                </div>
                                <label className="btn-premium btn-premium-outline" style={{ padding: '8px 14px', fontSize: '10px' }}>
                                  SUBIR IMAGEN
                                  <input
                                    type="file"
                                    style={{ display: 'none' }}
                                    accept="image/*"
                                    onChange={e => handleFileUpload(e, (url) => {
                                      const nt = [...content.historiaTimeline];
                                      nt[idx].image = url;
                                      setContent({ ...content, historiaTimeline: nt });
                                    })}
                                  />
                                </label>
                                {item.image && (
                                  <button
                                    className="btn-premium"
                                    style={{ padding: '8px 14px', fontSize: '10px', color: '#b91c1c', border: '1px solid #fca5a5', background: '#fff5f5' }}
                                    onClick={() => {
                                      const nt = [...content.historiaTimeline];
                                      nt[idx].image = '';
                                      setContent({ ...content, historiaTimeline: nt });
                                    }}
                                  >
                                    QUITAR
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="form-group">
                              <label className="premium-label">COLOR ACENTO</label>
                              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <input
                                  type="color"
                                  className="pjl-input"
                                  style={{ width: '64px', height: '46px', padding: '4px' }}
                                  value={item.accentColor || '#C8973A'}
                                  onChange={e => {
                                    const nt = [...content.historiaTimeline];
                                    nt[idx].accentColor = e.target.value;
                                    setContent({ ...content, historiaTimeline: nt });
                                  }}
                                />
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                  Este tono se verá en la línea de tiempo y en el modal.
                                </div>
                              </div>
                            </div>
                          </div>
                          <div style={{ marginTop: '20px', borderRadius: '18px', border: '1px solid var(--gold-pale)', background: 'linear-gradient(135deg, #fff, #fcf8ef)', overflow: 'hidden' }}>
                            {item.image && <img src={item.image} alt={item.title || 'Vista previa'} style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />}
                            <div style={{ padding: '18px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '10px' }}>
                                <span style={{ padding: '6px 12px', borderRadius: '999px', background: 'var(--cream)', border: '1px solid var(--gold-pale)', color: item.accentColor || 'var(--gold)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                                  {item.title || 'Nuevo hito'}
                                </span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: item.accentColor || 'var(--gold)', boxShadow: `0 0 0 6px ${item.accentColor || '#C8973A'}22` }} />
                              </div>
                              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.7 }}>
                                {item.text || 'Aquí aparecerá una vista previa de la historia para que el equipo vea cómo queda en el sitio.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                      <button 
                        className="btn-premium btn-premium-gold" 
                        style={{ width: '100%', padding: '15px', marginTop: '10px' }}
                        onClick={() => {
                          const newEvent = { id: Date.now().toString(), title: '', text: '', image: '', accentColor: '#C8973A' };
                          setContent({ ...content, historiaTimeline: [...(content.historiaTimeline || []), newEvent] });
                        }}
                      >+ AGREGAR EVENTO A LA HISTORIA</button>
                    </div>
                  </div>
                )}

                {/* TAB: CALENDARIO */}
                {activeContentTab === 'google_calendar' && (
                  <div className="animate-reveal" style={{ padding: '40px', background: 'var(--navy)', color: '#fff', borderRadius: '25px', border: '2px solid var(--gold)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '24px', alignItems: 'start' }}>
                      <div style={{ fontSize: '50px', lineHeight: 1 }}>🗓️</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 className="serif" style={{ color: 'var(--gold)', marginBottom: '15px', fontSize: '1.5rem' }}>Google Calendar</h4>
                        <p style={{ opacity: 0.8, marginBottom: '25px', lineHeight: '1.6' }}>
                          Integra tu calendario institucional para que los eventos se actualicen automáticamente en la web.
                          Puedes pegar el correo del calendario, su ID, o el enlace de inserción de Google Calendar.
                        </p>
                        <div className="form-group">
                          <label className="premium-label" style={{ color: 'var(--gold-pale)' }}>CALENDARIO / CORREO / URL EMBED</label>
                          <input 
                            className="pjl-input" 
                            style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--gold)', padding: '15px' }}
                            value={content.googleCalendarUrl || ''} 
                            placeholder="tu-calendario@gmail.com o https://calendar.google.com/calendar/embed?src=..."
                            onChange={e => setContent({ ...content, googleCalendarUrl: e.target.value })} 
                          />
                        </div>
                        <div className="form-group" style={{ marginTop: '18px' }}>
                          <label className="premium-label" style={{ color: 'var(--gold-pale)' }}>GOOGLE CLIENT ID</label>
                          <input
                            className="pjl-input"
                            style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--gold)', padding: '15px' }}
                            value={content.googleCalendarClientId || ''}
                            placeholder="xxx.apps.googleusercontent.com"
                            onChange={e => setContent({ ...content, googleCalendarClientId: e.target.value })}
                          />
                        </div>
                        <div className="form-group" style={{ marginTop: '18px' }}>
                          <label className="premium-label" style={{ color: 'var(--gold-pale)' }}>GOOGLE CLIENT SECRET</label>
                          <input
                            className="pjl-input"
                            type="password"
                            style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--gold)', padding: '15px' }}
                            value={content.googleCalendarClientSecret || ''}
                            placeholder="Client secret de Google"
                            onChange={e => setContent({ ...content, googleCalendarClientSecret: e.target.value })}
                          />
                        </div>
                        <div style={{ marginTop: '20px', padding: '18px', borderRadius: '18px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(200,151,58,0.35)' }}>
                          <p style={{ margin: '0 0 14px', fontSize: '12px', color: 'var(--gold-pale)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                            Opciones visibles del calendario
                          </p>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
                            {[
                              { key: 'showTitle', label: 'Mostrar título' },
                              { key: 'showNav', label: 'Mostrar navegación' },
                              { key: 'showPrint', label: 'Mostrar impresión' },
                              { key: 'showAgenda', label: 'Mostrar agenda' },
                              { key: 'showCalendars', label: 'Mostrar calendarios secundarios' },
                              { key: 'showTz', label: 'Mostrar zona horaria' },
                            ].map(option => {
                              const checkedMap = {
                                showTitle: calendarOptions.showTitle,
                                showNav: calendarOptions.showNav,
                                showPrint: calendarOptions.showPrint,
                                showAgenda: calendarOptions.mode === 'AGENDA' || calendarOptions.showAgenda,
                                showCalendars: calendarOptions.showCalendars,
                                showTz: calendarOptions.showTz,
                              };
                              const checked = checkedMap[option.key as keyof typeof checkedMap];
                              return (
                                <label
                                  key={option.key}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '12px 14px',
                                    borderRadius: '14px',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    lineHeight: 1.3,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const next = {
                                        ...calendarOptions,
                                        [option.key]: e.target.checked,
                                      } as typeof calendarOptions;
                                      if (option.key === 'showAgenda') {
                                        next.mode = e.target.checked ? 'AGENDA' : 'MONTH';
                                        next.showAgenda = e.target.checked;
                                      }
                                      setContent({ ...content, googleCalendarOptions: next });
                                    }}
                                  />
                                  <span>{option.label}</span>
                                </label>
                              );
                            })}
                          </div>
                          <p style={{ margin: '12px 0 0', fontSize: '11px', opacity: 0.75, lineHeight: 1.5 }}>
                            El iframe se genera automáticamente con los parámetros de Google Calendar para ocultar o mostrar cada bloque.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              <div style={{ marginTop: '50px', paddingTop: '30px', borderTop: '1px solid var(--gold-pale)', textAlign: 'right' }}>
                <button 
                  className="btn-premium btn-premium-gold" 
                  style={{ padding: '15px 60px', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold' }} 
                  onClick={() => showToast('¡Contenido guardado con éxito! ✔')}
                >
                  GUARDAR TODO EL CONTENIDO
                </button>
              </div>
            </div>
          )}

          {/* TERRITORIO */}
          {mod === 'capillas' && capillasView === 'territorio' && (
            <div className="animate-reveal pjl-card" style={{ padding: '40px' }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <button
                  className="btn-premium btn-premium-outline"
                  onClick={() => navigateMod('capillas', 'capillas')}
                  style={{ padding: '8px 14px', fontSize: '11px' }}
                >
                  ⛪ Gestión de Capillas
                </button>
                <button
                  className={`btn-premium ${capillasView === 'territorio' ? 'btn-premium-gold' : 'btn-premium-outline'}`}
                  onClick={() => navigateMod('capillas', 'territorio')}
                  style={{ padding: '8px 14px', fontSize: '11px' }}
                >
                  🗺️ Gestión de Territorio
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '26px', flexWrap: 'wrap' }}>
                <div>
                  <h3 className="serif" style={{ fontSize: '2rem', color: 'var(--navy)', margin: 0 }}>Gestión de Territorio</h3>
                  <p className="premium-label" style={{ color: 'var(--gold)', marginTop: '5px' }}>DELIMITACIÓN DE ZONAS Y COBERTURA EN VIVO</p>
                </div>
                {!capturingZone && !placingChapelId && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <button
                      className="btn-premium btn-premium-outline"
                      onClick={exportTerritorioGeoJSON}
                      style={{ padding: '9px 16px', fontSize: '11px' }}
                    >
                      ⬇ EXPORTAR GEOJSON
                    </button>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '320px', textAlign: 'right', margin: 0 }}>
                      Dibuja los límites de cada zona o ubica capillas sin GPS haciendo clic directo en el mapa.
                    </p>
                  </div>
                )}
              </div>

              {/* DASHBOARD DE COBERTURA POR ZONA */}
              <div className="terr-dash">
                {territoryStats.map(s => {
                  const pct = s.total === 0 ? 0 : Math.round(((s.dentro ?? s.ubicadas) / s.total) * 100);
                  return (
                    <div key={s.zona} className="td-card" style={{ '--zc': s.color } as CSSProperties}>
                      <div className="td-top">
                        <span className="td-zona">ZONA {s.zona}</span>
                        {s.tienePoligono ? <span className="td-tag ok">LÍMITES ✔</span> : <span className="td-tag warn">SIN LÍMITES</span>}
                      </div>
                      <div className="td-nums">
                        <div><strong>{s.total}</strong><span>Capillas</span></div>
                        <div><strong>{s.activas}</strong><span>Activas</span></div>
                        <div><strong>{s.ubicadas}</strong><span>Con GPS</span></div>
                      </div>
                      <div className="td-bar"><i style={{ width: `${pct}%` }} /></div>
                      <div className="td-foot">
                        <span>Cobertura {pct}%</span>
                        <span>{s.dentro === null ? (s.tienePoligono ? 'define vértices' : 'polígono pendiente') : `${s.dentro}/${s.ubicadas} dentro`}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="territory-editor-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '30px' }}>
                <div
                  className={`territory-map-shell ${placingChapelId ? 'map-shell-placing' : ''}`}
                  style={{ height: '600px', borderRadius: '25px', overflow: 'hidden', border: `3px solid ${capturingZone !== null || placingChapelId ? 'var(--gold)' : 'var(--gold-pale)'}`, position: 'relative', transition: 'border-color 0.3s ease', boxShadow: capturingZone !== null || placingChapelId ? '0 0 0 4px rgba(200,151,58,0.15)' : 'none' }}
                >
                  <ZonaMap 
                    key={`territory-map-${capturingZone ?? 'view'}`}
                    selectedZone={capturingZone || 0}
                    showAllZones={capturingZone === null}
                    tempPolygon={tempPolygon}
                    scrollWheelZoom={true}
                    drawingMode={!!capturingZone}
                    hideFallbackPolygon={!!capturingZone && tempPolygon.length === 0 && !branding[`zona${capturingZone}Polygon`]}
                    enableSearch={true}
                    zoneColors={{
                      1: branding.zona1Color as string || '#C8973A',
                      2: branding.zona2Color as string || '#1A2744',
                      3: branding.zona3Color as string || '#1A3B2B',
                      4: branding.zona4Color as string || '#441A1A'
                    }}
                    polygons={{
                      1: branding.zona1Polygon as [number, number][],
                      2: branding.zona2Polygon as [number, number][],
                      3: branding.zona3Polygon as [number, number][],
                      4: branding.zona4Polygon as [number, number][]
                    }}
                  />
                  {capturingZone && (
                    <>
                      {/* Top status banner */}
                      <div className="territory-status-banner" style={{ position: 'absolute', top: '15px', left: '15px', right: '65px', background: 'rgba(26,39,68,0.92)', color: '#fff', padding: '12px 20px', borderRadius: '12px', zIndex: 1000, backdropFilter: 'blur(10px)', border: '1px solid var(--gold)', display: 'flex', alignItems: 'center', gap: '12px', pointerEvents: 'none' }}>
                        <span style={{ fontSize: '20px' }}>✏️</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 900, fontSize: '13px', letterSpacing: '1px' }}>DIBUJANDO ZONA {capturingZone}</div>
                          <div style={{ fontSize: '10px', opacity: 0.75 }}>
                            {tempPolygon.length === 0
                              ? 'Haz clic en el mapa para marcar el primer vértice'
                              : tempPolygon.length < 3
                              ? `${tempPolygon.length} punto(s) — necesitas al menos 3`
                              : `${tempPolygon.length} puntos marcados — listo para guardar ✔`}
                          </div>
                        </div>
                        <div style={{ background: 'var(--gold)', color: 'var(--navy)', fontWeight: 900, fontSize: '14px', minWidth: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {tempPolygon.length}
                        </div>
                      </div>
                      {/* Bottom action bar */}
                      <div className="territory-action-bar" style={{ position: 'absolute', bottom: '15px', left: '15px', right: '15px', display: 'flex', gap: '8px', zIndex: 1000 }}>
                        <button
                          onClick={() => setTempPolygon(prev => prev.slice(0, -1))}
                          disabled={tempPolygon.length === 0}
                          style={{ flex: 1, padding: '10px', background: 'rgba(239,68,68,0.88)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '12px', cursor: tempPolygon.length === 0 ? 'not-allowed' : 'pointer', backdropFilter: 'blur(8px)', opacity: tempPolygon.length === 0 ? 0.4 : 1, transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                        >↩ Deshacer</button>
                        <button
                          onClick={() => { if (tempPolygon.length > 0 && confirm('¿Borrar todos los puntos?')) setTempPolygon([]); }}
                          disabled={tempPolygon.length === 0}
                          title="Borrar todos los puntos"
                          style={{ padding: '10px 14px', background: 'rgba(26,39,68,0.88)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: tempPolygon.length === 0 ? 'not-allowed' : 'pointer', backdropFilter: 'blur(8px)', opacity: tempPolygon.length === 0 ? 0.4 : 1, transition: '0.2s' }}
                        >🗑️</button>
                        <button
                          onClick={saveCapturedPolygon}
                          disabled={tempPolygon.length < 3}
                          style={{ flex: 2, padding: '10px', background: tempPolygon.length >= 3 ? 'var(--gold)' : 'rgba(200,151,58,0.35)', color: tempPolygon.length >= 3 ? 'var(--navy)' : 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '10px', fontWeight: 900, fontSize: '12px', cursor: tempPolygon.length < 3 ? 'not-allowed' : 'pointer', backdropFilter: 'blur(8px)', transition: '0.2s', letterSpacing: '0.5px' }}
                        >GUARDAR ({tempPolygon.length} pts)</button>
                        <button
                          onClick={() => { setCapturingZone(null); setTempPolygon([]); }}
                          title="Cancelar"
                          style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.65)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', backdropFilter: 'blur(8px)' }}
                         >✕</button>
                       </div>
                     </>
                   )}
                   {placingChapel && (
                     <>
                       {/* Banner de colocación */}
                       <div className="place-banner" style={{ position: 'absolute', top: '15px', left: '15px', right: '65px', zIndex: 1000 }}>
                         <span className="pinpulse" />
                         <div style={{ flex: 1, minWidth: 0 }}>
                           <div style={{ fontWeight: 900, fontSize: '13px', letterSpacing: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>UBICANDO “{placingChapel.name}”</div>
                           <div style={{ fontSize: '10px', opacity: 0.85 }}>Haz clic en el punto exacto del mapa</div>
                         </div>
                       </div>
                       <div style={{ position: 'absolute', bottom: '15px', left: '15px', right: '15px', display: 'flex', zIndex: 1000 }}>
                         <button
                           onClick={() => setPlacingChapelId(null)}
                           style={{ width: '100%', padding: '10px', background: 'rgba(26,39,68,0.9)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '10px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', backdropFilter: 'blur(8px)', letterSpacing: '0.5px', transition: '0.2s' }}
                          >✕ CANCELAR UBICACIÓN</button>
                       </div>
                     </>
                   )}
                  </div>

                  {/* LEYENDA INTERACTIVA */}
                  <div className="terr-legend">
                    {territoryStats.map(s => (
                      <button
                        key={s.zona}
                        className={`tl-pill ${capturingZone === s.zona ? 'tl-on' : ''}`}
                        style={{ '--zc': s.color } as CSSProperties}
                        title={`Seleccionar Zona ${s.zona} para dibujar`}
                        onClick={() => { setPlacingChapelId(null); setCapturingZone(s.zona); setTempPolygon((branding[`zona${s.zona}Polygon`] as [number, number][]) || []); }}
                      >
                        <i className="tl-dot" />
                        <span className="tl-name">Zona {s.zona}</span>
                        <span className="tl-count">{s.total} ⛪ · {s.ubicadas}/{s.total} 📍</span>
                      </button>
                    ))}
                  </div>

                  {/* ACCIONES RÁPIDAS */}
                  <div className="terr-quick">
                    <div className="tq-card tq-gold">
                      <span className="tq-ico">🖌️</span>
                      <div className="tq-txt">
                        <strong>Dibujar límites</strong>
                        <small>Traza el polígono de una zona en el mapa</small>
                      </div>
                      <button
                        className="tq-btn"
                        onClick={() => {
                          const z = ([1, 2, 3, 4] as const).find(n => !((branding[`zona${n}Polygon`] as [number, number][] | undefined)?.length)) || 1;
                          setPlacingChapelId(null);
                          setCapturingZone(z);
                          setTempPolygon((branding[`zona${z}Polygon`] as [number, number][]) || []);
                        }}
                      >COMENZAR</button>
                    </div>
                    <div className="tq-card tq-blue">
                      <span className="tq-ico">📍</span>
                      <div className="tq-txt">
                        <strong>Ubicar capilla</strong>
                        <small>{unplacedChapels.length ? `${unplacedChapels.length} esperando coordenadas` : 'Todo sincronizado con GPS ✔'}</small>
                      </div>
                      <button
                        className="tq-btn"
                        disabled={!unplacedChapels.length}
                        onClick={() => unplacedChapels[0] && startPlacingChapel(unplacedChapels[0].id)}
                      >{unplacedChapels.length ? 'UBICAR' : 'LISTO ✔'}</button>
                    </div>
                    <div className="tq-card tq-green">
                      <span className="tq-ico">⬇️</span>
                      <div className="tq-txt">
                        <strong>Exportar GeoJSON</strong>
                        <small>Zonas + capillas para QGIS o Google Earth</small>
                      </div>
                      <button className="tq-btn" onClick={exportTerritorioGeoJSON}>DESCARGAR</button>
                    </div>
                  </div>

                 <div className="territory-zone-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {[1, 2, 3, 4].map((num, idx) => {
                    const st = territoryStats[idx];
                    const currentColor = (branding[`zona${num}Color`] as string) || '#C8973A';
                    const hasPoly = !!(branding[`zona${num}Polygon`] as [number, number][] | undefined);
                    return (
                      <div
                        key={num}
                        className={`tz-card ${capturingZone === num ? 'tz-active' : ''}`}
                        style={{ '--zc': currentColor, animationDelay: `${idx * 80 + 120}ms` } as CSSProperties}
                      >
                        <div className="tz-head">
                          <h4 className="tz-name">ZONA {num}</h4>
                          <input
                            type="color"
                            value={currentColor}
                            onChange={e => setBranding({ ...branding, [`zona${num}Color`]: e.target.value })}
                            title="Color de la zona"
                            style={{ border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', background: 'transparent', padding: 0 }}
                          />
                        </div>
                        <div className="tz-swatches">
                          {TERR_PRESETS.map(pc => (
                            <button
                              key={pc}
                              aria-label={`Color ${pc}`}
                              title={pc}
                              className={`sw ${currentColor.toLowerCase() === pc.toLowerCase() ? 'on' : ''}`}
                              style={{ background: pc }}
                              onClick={() => setBranding({ ...branding, [`zona${num}Color`]: pc })}
                            />
                          ))}
                        </div>
                        <div className="tz-mini">
                          <span><b>{st.total}</b> capillas</span>
                          <span><b>{st.ubicadas}</b> con GPS</span>
                          {!st.tienePoligono && <span className="tz-warn">⚠ sin límites</span>}
                        </div>
                        <button
                          className="tz-btn gold"
                          onClick={() => { setPlacingChapelId(null); setCapturingZone(num); setTempPolygon((branding[`zona${num}Polygon`] as [number, number][]) || []); }}
                        >
                          {hasPoly ? '✏️ REDEFINIR LÍMITES' : '➕ DEFINIR LÍMITES'}
                        </button>
                        {hasPoly && (
                          <button
                            className="tz-btn danger"
                            onClick={() => {
                              if (confirm('¿Eliminar límites de esta zona?')) {
                                setBranding({ ...branding, [`zona${num}Polygon`]: undefined });
                                showToast(`Límites de Zona ${num} eliminados`);
                                addLog('eliminar territorio', 'territorio', `Zona ${num}`);
                              }
                            }}
                          >🗑️ ELIMINAR POLÍGONO</button>
                        )}
                      </div>
                    );
                  })}

                  {/* CAPILLAS SIN UBICAR */}
                  <div className="unpanel">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: unplacedChapels.length ? '10px' : '0' }}>
                      <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--gold)', letterSpacing: '0.5px' }}>📍 CAPILLAS SIN UBICAR</h4>
                      <span className="unbadge">{unplacedChapels.length}</span>
                    </div>
                    {unplacedChapels.length === 0 ? (
                      <p className="unok">✔ Todas las capillas tienen coordenadas GPS.</p>
                    ) : (
                      <>
                        <p style={{ fontSize: '10px', opacity: 0.75, margin: '0 0 10px' }}>Toca UBICAR y luego haz clic en el mapa:</p>
                        {unplacedChapels.slice(0, 6).map((c, i) => (
                          <div key={c.id} className="unchip" style={{ animationDelay: `${i * 55 + 200}ms` }}>
                            {(c.logoUrl || c.photo) ? (
                              <img src={(c.logoUrl || c.photo) as string} alt="" style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                            ) : (
                              <span className="dotz" style={{ background: (branding[`zona${c.zonaId}Color`] as string) || '#C8973A' }} />
                            )}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div className="uc-name">{c.name}</div>
                              <div className="uc-sub">Zona {c.zonaId} · {c.comunidadNombre}</div>
                            </div>
                            <button
                              className="unplace-btn"
                              disabled={!!placingChapelId || capturingZone !== null}
                              onClick={() => startPlacingChapel(c.id)}
                            >UBICAR</button>
                          </div>
                        ))}
                        {unplacedChapels.length > 6 && (
                          <p style={{ fontSize: '9px', opacity: 0.6, margin: '6px 0 0' }}>+{unplacedChapels.length - 6} más…</p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="unpanel" style={{ animationDelay: '300ms' }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--gold)' }}>📌 Instrucciones</h4>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', lineHeight: '1.8', opacity: 0.85 }}>
                      <li><strong>DEFINIR LÍMITES</strong>: haz clic en el mapa para marcar cada vértice.</li>
                      <li>Mínimo <strong>3 puntos</strong>; usa ↩ Deshacer si te equivocas.</li>
                      <li><strong>UBICAR</strong>: coloca una capilla sin GPS con un solo clic.</li>
                      <li><strong>GEOJSON</strong>: exporta zonas y capillas para otras apps.</li>
                      <li>Los cambios se reflejan en toda la web automáticamente.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* HISTORIAL / LOGS */}
          {mod === 'logs' && (
            <div className="animate-reveal pjl-card" style={{ padding: '40px' }}>
              <div className="admin-section-header admin-stack-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div className="admin-section-title-group">
                  <h3 className="serif" style={{ fontSize: '2rem', color: 'var(--navy)', margin: 0 }}>Historial de Actividad</h3>
                  <p className="premium-label" style={{ color: 'var(--gold)', marginTop: '5px' }}>REGISTRO DE ACCIONES ADMINISTRATIVAS</p>
                </div>
                <button className="btn-premium btn-premium-outline admin-section-action" onClick={() => {
                  if(confirm('¿Limpiar todo el historial?')) {
                    setLogs([]);
                    showToast('Historial limpiado');
                  }
                }}>LIMPIAR HISTORIAL</button>
              </div>

              <div className="pjl-table-container admin-table-scroll">
                <table className="pjl-table">
                  <thead>
                    <tr>
                      <th>FECHA / HORA</th>
                      <th>USUARIO</th>
                      <th>ACCIÓN</th>
                      <th>MÓDULO</th>
                      <th>DETALLES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: 0 }}>
                          <div className="pjl-empty-state" style={{ border: 'none', background: 'transparent' }}>
                            <div className="empty-icon">📜</div>
                            <h4 className="empty-title">Historial vacío</h4>
                            <p className="empty-desc">Cuando empieces a gestionar el contenido, todas las acciones quedarán registradas en este historial.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      logs.map(log => (
                        <tr key={log.id}>
                          <td style={{ fontSize: '12px' }}>{new Date(log.timestamp).toLocaleString()}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '20px' }}>👤</span>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 'bold' }}>{log.userName}</span>
                                <span style={{ fontSize: '10px', opacity: 0.6 }}>ID: {log.userId}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ 
                              padding: '4px 10px', 
                              borderRadius: '20px', 
                              fontSize: '11px', 
                              fontWeight: 'bold',
                              background: log.action.includes('eliminar') ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                              color: log.action.includes('eliminar') ? '#ef4444' : '#22c55e'
                            }}>
                              {log.action.toUpperCase()}
                            </span>
                          </td>
                          <td><span className="premium-label" style={{ fontSize: '10px' }}>{log.module.toUpperCase()}</span></td>
                          <td style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--text-muted)' }}>{log.details || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* NOTICIAS */}
          {mod === 'noticias' && (
            <div className="animate-reveal pjl-card" style={{ padding: '40px' }}>
              {newsView === 'list' && (
                <>
                  <div className="admin-section-header admin-stack-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <div className="admin-section-title-group">
                      <h3 className="serif admin-section-title">Gestión de Noticias</h3>
                      <p className="admin-section-desc">Redacta, publica y administra las noticias que aparecen en el sitio. También podés asociar eventos a cada noticia.</p>
                    </div>
                    <button className="btn-premium btn-premium-gold admin-section-action" onClick={() => { setSelectedArticle(null); setNewsView('article'); }}>+ PUBLICAR NOTICIA</button>
                  </div>
                  <div className="news-admin-grid">
                    <div>
                      <NewsAdminTable
                        onEdit={(art) => {
                          setSelectedArticle(art);
                          setNewsView('article');
                        }}
                        onDelete={() => {}}
                        onEvent={(art) => {
                          setSelectedArticle(art);
                          setNewsView('event');
                        }}
                      />
                    </div>

                    {/* SIDE WIDGET - VATICAN NEWS */}
                    <div className="vatican-news-sidebar" style={{ position: 'sticky', top: '20px' }}>
                      <div className="pjl-card" style={{ padding: '20px', background: 'var(--cream)', border: '1px solid var(--gold-pale)' }}>
                        <h4 className="serif" style={{ color: 'var(--navy)', marginBottom: '15px', fontSize: '1rem', borderBottom: '1px solid var(--gold-pale)', paddingBottom: '10px' }}>🇻🇦 Vaticano al Día</h4>
                        {/* @ts-ignore */}
                        <vaticannews-widget lang="es" fontSize="18"></vaticannews-widget>
                      </div>
                      <div className="pjl-card" style={{ padding: '20px', background: 'var(--navy)', color: '#fff', marginTop: '20px', border: '1px solid var(--gold)' }}>
                        <p style={{ fontSize: '11px', lineHeight: '1.5', opacity: 0.8 }}>Mantente conectado con las noticias oficiales de la Santa Sede directamente desde tu panel.</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {newsView === 'article' && (
                <div>
                  <NewsArticleForm
                    article={selectedArticle || undefined}
                    onSave={() => {
                      setNewsView('list');
                      setSelectedArticle(null);
                      showToast('Noticia guardada con éxito ✔');
                    }}
                    onCancel={() => {
                      setNewsView('list');
                      setSelectedArticle(null);
                    }}
                  />
                </div>
              )}

              {newsView === 'event' && selectedArticle && (
                <div>
                  <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <button className="btn-premium btn-premium-outline" onClick={() => { setNewsView('list'); setSelectedArticle(null); }}>
                      ← Volver a la lista
                    </button>
                    <h3 className="serif" style={{ margin: 0 }}>Agregar/Editar Evento para: &quot;{selectedArticle.title}&quot;</h3>
                  </div>
                  <NewsEventForm
                    articleId={selectedArticle.id}
                    event={selectedArticle.event}
                    onSave={() => {
                      setNewsView('list');
                      setSelectedArticle(null);
                      showToast('Evento guardado con éxito ✔');
                    }}
                    onCancel={() => {
                      setNewsView('list');
                      setSelectedArticle(null);
                    }}
                  />
                </div>
              )}

              <Script src="https://www.vaticannews.va/widget.js" strategy="lazyOnload" />
            </div>
          )}

          {/* CARRUSEL HERO */}
          {mod === 'carrusel' && (() => {
            const posMap: Record<string, string> = {
              'Top': 'center top',
              'Bottom': 'center bottom',
              'Left': 'left center',
              'Right': 'right center',
            };
            const currentSlide = liveHeroImages.find(s => s.id === editingSlideId) || liveHeroImages[0];
            const currentIndex = currentSlide ? liveHeroImages.findIndex(s => s.id === currentSlide.id) : -1;
            const updateSlide = (patch: Partial<HeroSlide>) => {
              if (!currentSlide) return;
              setLiveHeroImages(liveHeroImages.map(s => s.id === currentSlide.id ? { ...s, ...patch } : s));
            };
            const moveSlide = (from: number, to: number) => {
              if (to < 0 || to >= liveHeroImages.length) return;
              const arr = [...liveHeroImages];
              const [item] = arr.splice(from, 1);
              arr.splice(to, 0, item);
              setLiveHeroImages(arr);
            };
            return (
            <div className="animate-reveal pjl-card" style={{ padding: '40px' }}>
              <div className="admin-section-header admin-stack-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '26px', flexWrap: 'wrap', gap: '16px' }}>
                <div className="admin-section-title-group">
                  <h3 className="serif admin-section-title" style={{ margin: 0 }}>Carrusel del Hero</h3>
                  <p className="admin-section-desc">Gestioná las fotos de fondo de la página de inicio: subí imágenes, ordenalas y definí su enfoque para celular y computadora. Los textos se editan al final de esta página.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label className="premium-label" style={{ fontSize: '0.65rem' }}>INTERVALO (SEG)</label>
                    <input
                      type="number"
                      className="pjl-input"
                      style={{ width: '80px', padding: '8px', textAlign: 'center' }}
                      value={heroIntervalSecs}
                      onChange={e => setHeroIntervalSecs(Math.max(1, parseInt(e.target.value) || 3))}
                    />
                  </div>
                  <button className="btn-premium btn-premium-gold" onClick={() => {
                    const newId = Date.now().toString();
                    setLiveHeroImages([...liveHeroImages, {
                      id: newId, imageUrl: '', title: '', subtitle: '',
                      buttonText: '', buttonLink: '', mobilePosition: 'Centro (Default)', desktopPosition: 'Centro (Default)'
                    }]);
                    setEditingSlideId(newId);
                  }}>+ AGREGAR SLIDE</button>
                </div>
              </div>

              {liveHeroImages.length === 0 ? (
                <div className="pjl-empty-state">
                  <div className="empty-icon">🎠</div>
                  <h4 className="empty-title">El carrusel está vacío</h4>
                  <p className="empty-desc">Agregá el primer slide y subí una imagen de fondo (resolución recomendada 1920×1080). Sin fotos, el sitio muestra un fondo azul de respaldo.</p>
                  <button className="btn-premium btn-premium-gold" onClick={() => {
                    const newId = Date.now().toString();
                    setLiveHeroImages([{
                      id: newId, imageUrl: '', title: '', subtitle: '',
                      buttonText: '', buttonLink: '', mobilePosition: 'Centro (Default)', desktopPosition: 'Centro (Default)'
                    }]);
                    setEditingSlideId(newId);
                  }}>+ Crear primer slide</button>
                </div>
              ) : (
                <div className="carousel-admin-grid" style={{ display: 'grid', gridTemplateColumns: '290px 1fr', gap: '22px', alignItems: 'start' }}>

                  {/* LISTA DE SLIDES */}
                  <div className="carousel-slide-list" style={{ display: 'grid', gap: '10px' }}>
                    <span className="toolbar-label" style={{ paddingLeft: '4px' }}>{liveHeroImages.length} slides · tocá uno para editar</span>
                    {liveHeroImages.map((slide, i) => (
                      <div
                        key={slide.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setEditingSlideId(slide.id)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setEditingSlideId(slide.id); }}
                        className={`slide-thumb-row ${currentSlide?.id === slide.id ? 'selected' : ''}`}
                      >
                        <span className="slide-thumb-num">{i + 1}</span>
                        <span className="slide-thumb-img">
                          {slide.imageUrl
                            ? <img src={slide.imageUrl} alt={`Miniatura slide ${i + 1}`} />
                            : '🖼️'}
                        </span>
                        <span className="slide-thumb-meta">
                          <strong>Slide {i + 1}</strong>
                          <small>{slide.imageUrl ? 'Con imagen' : 'Sin imagen'}</small>
                        </span>
                        <span className="slide-thumb-actions" onClick={e => e.stopPropagation()}>
                          <button title="Subir" disabled={i === 0} onClick={() => moveSlide(i, i - 1)}>↑</button>
                          <button title="Bajar" disabled={i === liveHeroImages.length - 1} onClick={() => moveSlide(i, i + 1)}>↓</button>
                          <button title="Eliminar" className="is-danger" onClick={() => {
                            if (confirm(`¿Eliminar el Slide ${i + 1}?`)) {
                              setLiveHeroImages(liveHeroImages.filter(s => s.id !== slide.id));
                              if (editingSlideId === slide.id) setEditingSlideId(null);
                              showToast('Slide eliminado');
                            }
                          }}>✕</button>
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* EDITOR DEL SLIDE SELECCIONADO */}
                  {currentSlide && (
                    <div className="carousel-editor-panel">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                        <h4 className="serif" style={{ margin: 0, color: 'var(--navy)', fontSize: '1.15rem' }}>
                          Editando Slide {currentIndex + 1}
                          {!currentSlide.imageUrl && <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 700, marginLeft: '10px' }}>⚠ Falta la imagen</span>}
                        </h4>
                        <label className="btn-premium btn-premium-gold" style={{ cursor: 'pointer', padding: '10px 18px', whiteSpace: 'nowrap' }}>
                          📤 Subir / Cambiar Foto
                          <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileUpload(e, (url) => updateSlide({ imageUrl: url }))} />
                        </label>
                      </div>

                      <div
                        className="carousel-preview"
                        style={{
                          backgroundImage: currentSlide.imageUrl ? `url(${currentSlide.imageUrl})` : undefined,
                          backgroundPosition: posMap[currentSlide.desktopPosition] || 'center center',
                        }}
                      >
                        {!currentSlide.imageUrl && <span>Vista previa aparecerá aquí</span>}
                      </div>

                      <div style={{ marginTop: '18px', display: 'grid', gap: '15px' }}>
                        <div>
                          <label className="premium-label" style={{ fontSize: '0.7rem', marginBottom: '5px', display: 'block' }}>URL DE IMAGEN (1920×1080 RECOMENDADO)</label>
                          <input type="text" className="pjl-input" placeholder="https://..." value={currentSlide.imageUrl} onChange={e => updateSlide({ imageUrl: e.target.value })} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }} className="carousel-pos-grid">
                          <div>
                            <label className="premium-label" style={{ fontSize: '0.7rem', marginBottom: '5px', display: 'block' }}>📱 ENFOQUE EN CELULAR</label>
                            <select className="pjl-input" value={currentSlide.mobilePosition} onChange={e => updateSlide({ mobilePosition: e.target.value })}>
                              <option>Centro (Default)</option><option>Top</option><option>Bottom</option><option>Left</option><option>Right</option>
                            </select>
                          </div>
                          <div>
                            <label className="premium-label" style={{ fontSize: '0.7rem', marginBottom: '5px', display: 'block' }}>💻 ENFOQUE EN COMPUTADORA</label>
                            <select className="pjl-input" value={currentSlide.desktopPosition} onChange={e => updateSlide({ desktopPosition: e.target.value })}>
                              <option>Centro (Default)</option><option>Top</option><option>Bottom</option><option>Left</option><option>Right</option>
                            </select>
                          </div>
                        </div>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                          💡 El enfoque controla qué parte de la foto se ve cuando la imagen se recorta. La vista previa usa el enfoque de computadora.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* GLOBAL HERO CONTENT CONFIGURATION */}
              <div style={{ marginTop: '34px', paddingTop: '28px', borderTop: '2px solid var(--gold-pale)' }}>
                <h4 className="serif" style={{ margin: '0 0 6px', color: 'var(--navy)', fontWeight: 800 }}>Textos Fijos del Hero</h4>
                <p style={{ margin: '0 0 18px', fontSize: '12.5px', color: 'var(--text-muted)' }}>Estos textos se muestran sobre todas las fotos del carrusel.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label className="premium-label" style={{ fontSize: '0.7rem', marginBottom: '5px', display: 'block' }}>ETIQUETA SUPERIOR (TAG)</label>
                    <input type="text" className="pjl-input" value={content.heroTag || ''} onChange={e => setContent({...content, heroTag: e.target.value})} />
                  </div>
                  <div>
                    <label className="premium-label" style={{ fontSize: '0.7rem', marginBottom: '5px', display: 'block' }}>TÍTULO (Soporta HTML)</label>
                    <input type="text" className="pjl-input" value={content.heroTitle || ''} onChange={e => setContent({...content, heroTitle: e.target.value})} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="premium-label" style={{ fontSize: '0.7rem', marginBottom: '5px', display: 'block' }}>DESCRIPCIÓN / TEXTO DE INTRODUCCIÓN</label>
                    <textarea className="pjl-input" rows={3} value={content.heroText || ''} onChange={e => setContent({...content, heroText: e.target.value})} />
                  </div>
                  <div>
                    <label className="premium-label" style={{ fontSize: '0.7rem', marginBottom: '5px', display: 'block' }}>TEXTO BOTÓN PRINCIPAL (Opcional)</label>
                    <input type="text" className="pjl-input" placeholder="ej. Conocer Estatuto" value={content.heroBtnText || ''} onChange={e => setContent({...content, heroBtnText: e.target.value})} />
                  </div>
                  <div>
                    <label className="premium-label" style={{ fontSize: '0.7rem', marginBottom: '5px', display: 'block' }}>LINK BOTÓN PRINCIPAL (Opcional)</label>
                    <input type="text" className="pjl-input" placeholder="ej. /estatuto o contacto" value={content.heroBtnLink || ''} onChange={e => setContent({...content, heroBtnLink: e.target.value})} />
                  </div>
                </div>
              </div>
            </div>
            );
          })()}

          {/* CAPILLAS */}
          {mod === 'capillas' && (
            <div className="animate-reveal pjl-card" style={{ padding: '40px' }}>
              <div className="admin-section-header admin-stack-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div className="admin-section-title-group">
                  <h3 className="serif admin-section-title" style={{ margin: 0 }}>Territorio y Comunidades</h3>
                  <p className="admin-section-desc">Administra las capillas, comunidades juveniles y la organización territorial de las 4 zonas pastorales.</p>
                </div>
                {capillasView === 'capillas' && (
                  <button className="btn-premium btn-premium-gold admin-section-action" onClick={() => openNew('capillas')}>+ REGISTRAR CAPILLA</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <button
                  className={`btn-premium ${capillasView === 'capillas' ? 'btn-premium-gold' : 'btn-premium-outline'}`}
                  onClick={() => navigateMod('capillas', 'capillas')}
                  style={{ padding: '8px 14px', fontSize: '11px' }}
                >
                  ⛪ Gestión de Capillas
                </button>
                <button
                  className={`btn-premium ${capillasView === 'territorio' ? 'btn-premium-gold' : 'btn-premium-outline'}`}
                  onClick={() => navigateMod('capillas', 'territorio')}
                  style={{ padding: '8px 14px', fontSize: '11px' }}
                >
                  🗺️ Gestión de Territorio
                </button>
              </div>
              {capillasView === 'capillas' && (
              <>
              {/* RESUMEN RÁPIDO SINCRONIZADO */}
              <div className="cap-stats">
                <div className="cst-chip cst-a"><span className="cst-num">{chapels.length}</span><span className="cst-lab">Capillas</span></div>
                <div className="cst-chip cst-b"><span className="cst-num">{chapels.filter(c => c.estadoComunidad === 'Activo').length}</span><span className="cst-lab">Activas</span></div>
                <div className="cst-chip cst-c"><span className="cst-num">{chapels.filter(c => c.estadoComunidad !== 'Activo').length}</span><span className="cst-lab">Nucleación</span></div>
                <div className="cst-chip cst-d"><span className="cst-num">{unplacedChapels.length}</span><span className="cst-lab">Sin GPS</span></div>
              </div>

              {/* TOOLBAR CON FILTROS SINCRONIZADOS */}
              <div className="cap-toolbar">
                <div className="ct-search">
                  <span className="ct-search-ico">🔍</span>
                  <input
                    type="text"
                    placeholder="Buscar por nombre o zona…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button className="ct-clear" onClick={() => setSearchTerm('')} title="Limpiar búsqueda">✕</button>
                  )}
                </div>
                <div className="ct-zones">
                  <button
                    className={`cz-chip ${capZoneFilter === 'all' ? 'on' : ''}`}
                    onClick={() => setCapZoneFilter('all')}
                  >Todas</button>
                  {([1, 2, 3, 4] as const).map(z => (
                    <button
                      key={z}
                      className={`cz-chip ${capZoneFilter === z ? 'on' : ''}`}
                      style={capZoneFilter === z ? { background: zonaColor(z), borderColor: zonaColor(z), color: '#fff' } : undefined}
                      onClick={() => setCapZoneFilter(capZoneFilter === z ? 'all' : z)}
                    >
                      <i className="cz-dot" style={{ background: zonaColor(z) }} />Zona {z}
                    </button>
                  ))}
                </div>
                <div className="ct-estados">
                  {(['all', 'Activo', 'Nucleación', 'sinGPS'] as const).map(e => (
                    <button
                      key={e}
                      className={`ce-chip ${capEstadoFilter === e ? 'on' : ''}`}
                      onClick={() => setCapEstadoFilter(e)}
                    >{e === 'all' ? 'Todos' : e === 'sinGPS' ? '⚠ Sin GPS' : e}</button>
                  ))}
                </div>
                <span className="ct-count">{filteredChapels.length} de {chapels.length} capillas</span>
              </div>

              {/* GRID DE TARJETAS */}
              <div className="cap-grid">
                {filteredChapels.map((c, i) => {
                  const zc = zonaColor(c.zonaId);
                  const hasGps = typeof c.lat === 'number' && typeof c.lng === 'number';
                  return (
                    <div key={c.id} className="cap-card" style={{ '--zc': zc, '--d': `${Math.min(i, 12) * 45}ms` } as CSSProperties}>
                      <div className="cc-head">
                        <div className="cc-logo">
                          {c.logoUrl ? <SafeImg src={c.logoUrl} alt={`Logo de la Capilla ${c.name}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>⛪</span>}
                        </div>
                        <div className="cc-tit">
                          <h4>{c.name}</h4>
                          <span className="cc-zbadge" style={{ background: zc }}>ZONA {c.zonaId}</span>
                        </div>
                        <button
                          title="Cambiar estado de la comunidad"
                          className={`cc-estado ${c.estadoComunidad === 'Activo' ? 'b-act' : 'b-nuc'}`}
                          onClick={() => toggleEstadoComunidad(c)}
                        >
                          {c.estadoComunidad}<i className="cc-swap">⇄</i>
                        </button>
                      </div>
                      <div className="cc-body">
                        <div className="cc-row"><span className="cc-k">Comunidad</span><span className="cc-v">{c.comunidadNombre || '—'}</span></div>
                        <div className="cc-row"><span className="cc-k">Dirección</span><span className="cc-v">{c.address || '—'}</span></div>
                        <div className="cc-row">
                          <span className="cc-k">Ubicación</span>
                          {hasGps
                            ? <span className="cc-coords">📌 {c.lat!.toFixed(4)}, {c.lng!.toFixed(4)}</span>
                            : <span className="cc-nogps">⚠ Sin ubicar</span>}
                        </div>
                      </div>
                      <div className="cc-actions">
                        <button className="ccb ccb-edit" onClick={() => openEdit('capillas', c)}>✏️ Editar<i>→</i></button>
                        {!hasGps && (
                          <button className="ccb ccb-place" onClick={() => goToTerritoryPlace(c.id)} title="Ubicar en el mapa de Territorio">📍 Ubicar</button>
                        )}
                        {hasGps && (
                          <button className="ccb ccb-target" onClick={() => centerMapOn(c)} title="Guardar como centro del mapa en toda la web">🎯 Centrar mapa</button>
                        )}
                        <button className="ccb ccb-del" onClick={() => deleteItem('chapels', c.id)} title="Eliminar capilla">🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredChapels.length === 0 && chapels.length > 0 && (
                <div className="pjl-empty-state" style={{ marginTop: '20px' }}>
                  <div className="empty-icon">🔍</div>
                  <h4 className="empty-title">Sin resultados</h4>
                  <p className="empty-desc">No hay capillas que coincidan con los filtros actuales. Probá limpiar la búsqueda.</p>
                  <button className="btn-premium btn-premium-outline" onClick={() => { setSearchTerm(''); setCapZoneFilter('all'); setCapEstadoFilter('all'); }}>
                    Limpiar filtros
                  </button>
                </div>
              )}

              {chapels.length === 0 && (
                <div className="pjl-empty-state" style={{ marginTop: '20px' }}>
                  <div className="empty-icon">⛪</div>
                  <h4 className="empty-title">Todavía no hay capillas registradas</h4>
                  <p className="empty-desc">Registrá la primera capilla para empezar a armar el mapa territorial de la pastoral.</p>
                  <button className="btn-premium btn-premium-gold" onClick={() => openNew('capillas')}>+ Registrar primera capilla</button>
                </div>
              )}

              {/* MAPA GENERAL CON LEYENDA */}
              <div className="cap-mapwrap">
                <div className="cm-head">
                  <h4 className="serif">Mapa de Capillas</h4>
                  <div className="cm-legend">
                    {([1, 2, 3, 4] as const).map(z => (
                      <span key={z} className="cm-leg"><i style={{ background: zonaColor(z) }} />Zona {z} · {chapels.filter(c => c.zonaId === z).length}</span>
                    ))}
                  </div>
                </div>
                <div className="cm-shell">
                   <ZonaMap
                     chapels={chapels}
                     mapCenterLat={branding.mapCenterLat as number}
                     mapCenterLng={branding.mapCenterLng as number}
                     mapZoom={branding.mapZoom as number}
                     zoneColors={{
                       1: branding.zona1Color as string,
                       2: branding.zona2Color as string,
                       3: branding.zona3Color as string,
                       4: branding.zona4Color as string,
                     }}
                     polygons={{
                       1: branding.zona1Polygon as [number, number][],
                       2: branding.zona2Polygon as [number, number][],
                       3: branding.zona3Polygon as [number, number][],
                       4: branding.zona4Polygon as [number, number][],
                     }}
                   />
                </div>
              </div>
              </>
              )}
            </div>
          )}
          {/* ACTIVIDADES */}
          {mod === 'actividades' && (
            <div className="animate-reveal pjl-card" style={{ padding: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 className="serif" style={{ margin: 0, color: 'var(--navy)' }}>Agenda Pastoral</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Administra eventos, retiros y asambleas</p>
                </div>
                <button className="btn-premium btn-premium-gold" onClick={() => openNew('actividades')}>+ AGREGAR ACTIVIDAD</button>
              </div>

              <div className="gcal-status-card" style={{ marginBottom: '24px' }}>
                <span className={`gcal-status-dot ${googleCalendarStatus?.connected ? 'connected' : 'disconnected'}`} />
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--navy)', letterSpacing: '0.4px' }}>
                    GOOGLE CALENDAR {googleCalendarStatus?.connected ? 'CONECTADO' : 'DESCONECTADO'}
                    {googleCalendarStatus?.account ? <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}> · {googleCalendarStatus.account}</span> : null}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {googleCalendarStatus?.connected
                      ? 'Sincronización automática activa: cada actividad se crea y actualiza en tu calendario.'
                      : 'Conecta tu cuenta para que cada actividad se cree automáticamente en Google Calendar.'}
                  </div>
                </div>
                <button
                  className={`btn-premium ${googleCalendarStatus?.connected ? 'btn-premium-outline' : 'btn-premium-gold'}`}
                  style={googleCalendarStatus?.connected ? { borderColor: '#10B981', color: '#10B981' } : undefined}
                  onClick={() => window.location.assign('/api/google-calendar/connect')}
                  disabled={googleCalendarSyncing}
                >
                  {googleCalendarStatus?.connected ? 'ADMINISTRAR CONEXIÓN' : 'CONECTAR AHORA'}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div className="admin-chip-scroll" style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
                  {['Todos', 'Formación', 'Liturgia', 'Organización', 'Social'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSearchTerm(cat === 'Todos' ? '' : cat)}
                      className={`btn-premium ${searchTerm === cat || (cat === 'Todos' && !searchTerm) ? 'btn-premium-gold' : 'btn-premium-outline'}`}
                      style={{ padding: '6px 12px', fontSize: '10px' }}
                    >
                      {cat.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button className="btn-premium btn-premium-outline" style={{ borderColor: '#EF4444', color: '#EF4444' }} onClick={deleteAllActivities}>
                  BORRAR TODO
                </button>
              </div>
              
              {content.googleCalendarUrl && (
                <div style={{ marginBottom: '30px', borderRadius: '20px', overflow: 'hidden', border: '2px solid var(--gold-pale)', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                  <div style={{ padding: '12px 20px', background: 'var(--navy)', color: '#fff', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span>🗓️</span> VISTA PREVIA DE GOOGLE CALENDAR
                    </div>
                    <span style={{ fontSize: '9px', opacity: 0.7, maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{content.googleCalendarUrl}</span>
                  </div>
                  <iframe 
                    src={calendarEmbedUrl} 
                    style={{ border: 0, width: '100%', height: 'clamp(380px, 42vw, 460px)', display: 'block' }} 
                    width="100%" 
                    height="460" 
                    frameBorder="0" 
                    scrolling="no"
                  ></iframe>
                </div>
              )}

              <div style={{ overflowX: 'auto' }}>
                <table className="pjl-table">
                  <thead>
                    <tr style={{ background: 'var(--cream)' }}>
                      <th style={{ borderRadius: '12px 0 0 12px' }}>ESTADO</th>
                      <th>ACTIVIDAD</th>
                      <th>FECHA</th>
                      <th>CATEGORÍA</th>
                      <th style={{ borderRadius: '0 12px 12px 0' }}>ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.filter(a => (a.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || (a.category || '').toLowerCase().includes(searchTerm.toLowerCase())).map(a => (
                      <tr key={a.id}>
                        <td>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: a.active ? '#10B981' : '#EF4444', display: 'inline-block', marginRight: '8px' }} />
                          <span style={{ fontSize: '10px', fontWeight: 600, color: a.active ? '#10B981' : '#EF4444' }}>{a.active ? 'ACTIVO' : 'PASADO'}</span>
                        </td>
                        <td style={{ fontWeight: 800, color: 'var(--navy)' }}>{a.title || 'Sin título'}</td>
                        <td>{a.date || 'Sin fecha'}</td>
                        <td><span className="premium-label" style={{ fontSize: '10px', background: 'var(--gold-pale)', color: 'var(--navy)' }}>{a.category || 'Sin categoría'}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {a.calendarUrl && (
                              <a href={a.calendarUrl} target="_blank" rel="noreferrer" className="btn-premium btn-premium-gold" style={{ padding: '6px 12px', fontSize: '10px', textDecoration: 'none' }}>
                                GOOGLE CALENDAR
                              </a>
                            )}
                            <button onClick={() => openEdit('actividades', a)} className="btn-premium btn-premium-outline" style={{ padding: '6px 12px', fontSize: '10px' }}>EDITAR</button>
                            <button onClick={() => deleteItem('activities', a.id)} className="btn-premium" style={{ color: '#EF4444', padding: '6px 12px', fontSize: '10px', border: '1px solid #EF4444' }}>BORRAR</button>
                          </div>
                        </td>
                       </tr>
                     ))}
                     {activities.filter(a => (a.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || (a.category || '').toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                       <tr>
                         <td colSpan={5} style={{ padding: 0 }}>
                           <div className="pjl-empty-state" style={{ border: 'none', background: 'transparent' }}>
                             <div className="empty-icon">🗓️</div>
                             <h4 className="empty-title">
                               {activities.length === 0 ? 'La agenda está vacía' : 'Sin resultados'}
                             </h4>
                             <p className="empty-desc">
                               {activities.length === 0
                                 ? 'Creá la primera actividad para que aparezca en la agenda pública y en Google Calendar.'
                                 : `Ninguna actividad coincide con «${searchTerm}». Probá con otro término.`}
                             </p>
                             {activities.length === 0 && (
                               <button className="btn-premium btn-premium-gold" onClick={() => openNew('actividades')}>+ Agregar actividad</button>
                             )}
                           </div>
                         </td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
             </div>
           )}

          {/* DOCUMENTOS */}
          {mod === 'documentos' && (
            <div className="animate-reveal pjl-card" style={{ padding: '40px' }}>
              <div style={{ display: 'grid', gap: '24px', marginBottom: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <div>
                    <h3 className="serif" style={{ margin: 0, color: 'var(--navy)' }}>Centro de Descargas</h3>
                    <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>Un área más clara, útil y elegante para organizar PDFs, imágenes, Word y materiales internos.</p>
                  </div>
                  <button className="btn-premium btn-premium-gold" onClick={() => openNew('documentos')}>+ REGISTRAR ARCHIVO</button>
                </div>
              <div className="docs-admin-summary-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr repeat(3, minmax(0, 1fr))', gap: '16px' }}>
                  <div style={{ padding: '22px', borderRadius: '22px', background: 'linear-gradient(135deg, var(--navy), #31456f)', color: '#fff', boxShadow: '0 18px 35px rgba(26,39,68,0.14)' }}>
                    <div style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.75, marginBottom: '10px' }}>Biblioteca activa</div>
                    <div className="serif" style={{ fontSize: '2rem', lineHeight: 1, marginBottom: '8px' }}>{docs.length}</div>
                    <div style={{ fontSize: '13px', opacity: 0.82 }}>documentos listos para descarga o consulta</div>
                  </div>
                  <div style={{ padding: '18px', borderRadius: '22px', background: '#fff', border: '1px solid var(--gold-pale)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: '8px' }}>Más descargado</div>
                    <div style={{ color: 'var(--navy)', fontWeight: 800, fontSize: '14px', lineHeight: 1.4 }}>{[...docs].sort((a, b) => (b.downloads || 0) - (a.downloads || 0))[0]?.name || 'Sin datos aún'}</div>
                  </div>
                  <div style={{ padding: '18px', borderRadius: '22px', background: '#fff', border: '1px solid var(--gold-pale)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: '8px' }}>Categorías</div>
                    <div style={{ color: 'var(--navy)', fontWeight: 800, fontSize: '28px', lineHeight: 1 }}>{new Set(docs.map(d => d.category || 'General')).size}</div>
                  </div>
                  <div style={{ padding: '18px', borderRadius: '22px', background: '#fff', border: '1px solid var(--gold-pale)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: '8px' }}>Con vista previa</div>
                    <div style={{ color: 'var(--navy)', fontWeight: 800, fontSize: '28px', lineHeight: 1 }}>{docs.filter(d => !!d.url).length}</div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                {docs.map(d => {
                  const presentation = getDocPresentation(d);
                  const previewable = canPreviewInFrame(d);

                  return (
                    <div key={d.id} className="pjl-card hover-lift" style={{ padding: '0', border: '1px solid var(--gold-pale)', display: 'flex', flexDirection: 'column', gap: '0', background: '#fff', overflow: 'hidden' }}>
                      <div style={{ padding: '18px', background: 'linear-gradient(135deg, rgba(200,151,58,0.08), rgba(26,39,68,0.04))', borderBottom: '1px solid rgba(200,151,58,0.14)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{ width: '54px', height: '54px', borderRadius: '14px', background: `${presentation.color}15`, color: presentation.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
                            {presentation.icon}
                          </div>
                          <button onClick={() => deleteItem('docs', d.id)} style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', cursor: 'pointer', transition: '0.2s' }} title="Eliminar documento">×</button>
                        </div>
                      </div>
                      <div style={{ padding: '18px', display: 'grid', gap: '14px', flex: 1 }}>
                        <div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                            <span style={{ background: '#f8fafc', padding: '4px 9px', borderRadius: '999px', fontSize: '10px', fontWeight: 800, color: presentation.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{presentation.label}</span>
                            <span style={{ background: 'var(--cream)', padding: '4px 9px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, color: 'var(--navy)' }}>{d.category || 'General'}</span>
                          </div>
                          <h4 style={{ margin: '0 0 8px', color: 'var(--navy)', fontSize: '15px', fontWeight: 800, lineHeight: 1.35 }}>{d.name}</h4>
                          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.7 }}>{d.description || 'Documento institucional listo para ser consultado desde la biblioteca pastoral.'}</p>
                        </div>
                        <div style={{ borderRadius: '16px', border: '1px solid #f0ece4', background: '#fcfcfb', overflow: 'hidden' }}>
                          {previewable && d.url ? (
                            presentation.kind === 'image' ? (
                              <img src={d.url} alt={d.name} style={{ width: '100%', height: '150px', objectFit: 'cover', display: 'block' }} />
                            ) : (
                              <iframe src={d.url} title={d.name} style={{ width: '100%', height: '150px', border: 'none', display: 'block', background: '#fff' }} />
                            )
                          ) : (
                            <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px', color: presentation.color, background: 'linear-gradient(135deg, rgba(248,250,252,0.95), rgba(255,255,255,1))' }}>
                              <div style={{ fontSize: '34px' }}>{presentation.icon}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Vista previa disponible al vincular archivo</div>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', fontSize: '11px' }}>
                          <div style={{ padding: '10px 12px', background: 'var(--cream)', borderRadius: '12px' }}>
                            <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Formato</div>
                            <div style={{ color: 'var(--navy)', fontWeight: 800 }}>{d.type || 'DOC'}</div>
                          </div>
                          <div style={{ padding: '10px 12px', background: 'var(--cream)', borderRadius: '12px' }}>
                            <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Tamaño</div>
                            <div style={{ color: 'var(--navy)', fontWeight: 800 }}>{d.size || '0 KB'}</div>
                          </div>
                          <div style={{ padding: '10px 12px', background: 'var(--cream)', borderRadius: '12px' }}>
                            <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Subido</div>
                            <div style={{ color: 'var(--navy)', fontWeight: 800 }}>{d.uploadedAt || '-'}</div>
                          </div>
                        </div>
                        <div style={{ marginTop: 'auto', paddingTop: '4px', borderTop: '1px solid #f0ece4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--navy)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '16px', color: 'var(--gold)' }}>📥</span>
                            <span>{d.downloads || 0} <span style={{ fontWeight: 400, color: '#888' }}>descargas</span></span>
                          </div>
                          <button onClick={() => openEdit('documentos', d)} className="btn-premium btn-premium-gold" style={{ padding: '6px 14px', fontSize: '10px', borderRadius: '8px' }}>
                            EDITAR
                          </button>
                        </div>
                      </div>
                     </div>
                   );
                 })}
                 {docs.length === 0 && (
                   <div className="pjl-empty-state" style={{ gridColumn: '1 / -1' }}>
                     <div className="empty-icon">📚</div>
                     <h4 className="empty-title">La biblioteca está vacía</h4>
                     <p className="empty-desc">Registrá el primer archivo para que quede disponible en el centro de descargas del sitio público.</p>
                     <button className="btn-premium btn-premium-gold" onClick={() => openNew('documentos')}>+ Registrar archivo</button>
                   </div>
                 )}
               </div>
             </div>
           )}

          {/* PERFILES */}
          {mod === 'perfiles' && (() => {
            const teamMeta: Record<string, { label: string; icon: string }> = {
              coordinacion: { label: 'Coordinación', icon: '⛪' },
              efo: { label: 'EFO', icon: '🎓' },
              ecomu: { label: 'ECOMU', icon: '📡' },
              eli: { label: 'ELI', icon: '🕊️' },
              mmpjl: { label: 'Música', icon: '🎵' },
              zona1: { label: 'Zona 1', icon: '📍' },
              zona2: { label: 'Zona 2', icon: '📍' },
              zona3: { label: 'Zona 3', icon: '📍' },
              zona4: { label: 'Zona 4', icon: '📍' },
            };
            const teamProfiles = profiles.filter(p => p.teamKey === activeProfileTeam);
            return (
            <div className="animate-reveal pjl-card" style={{ padding: '40px' }}>
              <div className="admin-section-header admin-stack-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
                <div className="admin-section-title-group">
                  <h3 className="serif admin-section-title" style={{ margin: 0 }}>Gestión de Currículos y Perfiles</h3>
                  <p className="admin-section-desc">Armá el consejo pastoral: foto, cargo, historia y CV de cada integrante. Todo se publica automáticamente en la sección Consejo del sitio.</p>
                </div>
                <button
                  className="btn-premium btn-premium-gold admin-section-action"
                  onClick={() => {
                    const newProfile: MemberProfile = {
                      id: Date.now(),
                      name: 'Nuevo Miembro',
                      role: 'Cargo',
                      bio: 'Biografía',
                      quote: '',
                      teamKey: activeProfileTeam,
                      photo: ''
                    };
                    setProfiles([...profiles, newProfile]);
                    showToast('Miembro agregado ✔');
                  }}
                >
                  + Agregar Miembro
                </button>
              </div>

              {/* SELECTOR DE EQUIPOS */}
              <div className="profile-teams-bar custom-scrollbar admin-chip-scroll">
                {Object.entries(teamMeta).map(([tk, meta]) => {
                  const count = profiles.filter(x => x.teamKey === tk).length;
                  const active = activeProfileTeam === tk;
                  return (
                    <button
                      key={tk}
                      onClick={() => setActiveProfileTeam(tk)}
                      className={`profile-team-tab ${active ? 'active' : ''}`}
                    >
                      <span className="profile-team-icon">{meta.icon}</span>
                      <span>{meta.label}</span>
                      <span className="profile-team-count">{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* GRILLA DE MIEMBROS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '25px' }}>
                {teamProfiles.map((p, idx) => (
                  <div key={p.id} className="pjl-card profile-member-card" style={{ animationDelay: `${idx * 80}ms` }}>
                    <button
                      className="profile-delete-btn"
                      onClick={() => {
                        if (confirm(`¿Seguro que deseas eliminar a ${p.name}?`)) {
                          setProfiles(profiles.filter(x => x.id !== p.id));
                          showToast('Miembro eliminado ✖');
                        }
                      }}
                      style={{ position: 'absolute', top: '16px', right: '16px' }}
                    >
                      🗑 Eliminar
                    </button>

                    <div className="profile-photo-wrap" style={{ position: 'relative', width: '124px', flexShrink: 0 }}>
                      <div className="profile-photo-ring">
                        <div className="profile-photo-inner">
                          {p.photo ? <img src={p.photo} alt={p.name} /> : '👤'}
                        </div>
                      </div>
                      <label className="profile-camera-badge" title="Cambiar foto" style={{ position: 'absolute', bottom: '-2px', right: '-2px' }}>
                        📷
                        <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileUpload(e, (url) => { setProfiles(profiles.map(x => x.id === p.id ? {...x, photo: url} : x)); showToast('Foto guardada ✔'); })} />
                      </label>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="profile-head-row">
                        <input
                          className="pjl-input profile-name-input"
                          value={p.name}
                          onChange={e => setProfiles(profiles.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))}
                          placeholder="Nombre del Miembro"
                        />
                        <input
                          className="pjl-input profile-role-input"
                          value={p.role}
                          onChange={e => setProfiles(profiles.map(x => x.id === p.id ? { ...x, role: e.target.value } : x))}
                          placeholder="Rol o Cargo"
                        />
                      </div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', margin: '14px 0 5px', fontWeight: 700, letterSpacing: '0.4px' }}>HISTORIAL PASTORAL</label>
                      <textarea
                        className="pjl-input profile-bio-input"
                        value={p.bio}
                        onChange={e => setProfiles(profiles.map(x => x.id === p.id ? { ...x, bio: e.target.value } : x))}
                        placeholder="Contá el recorrido pastoral del miembro..."
                      />
                      <div className={`profile-cv-box ${p.cvUrl ? 'loaded' : ''}`}>
                        <span className="profile-cv-icon">{p.cvUrl ? '✅' : '📄'}</span>
                        <span className="profile-cv-info">
                          <strong>Currículum Pastoral</strong>
                          <small>{p.cvUrl ? 'Archivo cargado y visible en el sitio' : 'PDF o Word · opcional'}</small>
                        </span>
                        <label className="btn-premium btn-premium-outline profile-cv-btn">
                          {p.cvUrl ? 'CAMBIAR' : 'SUBIR'}
                          <input type="file" style={{ display: 'none' }} accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => handleFileUpload(e, (url) => { setProfiles(profiles.map(x => x.id === p.id ? {...x, cvUrl: url} : x)); showToast('CV guardado ✔'); })} />
                        </label>
                        {p.cvUrl && (
                          <button className="profile-cv-remove" title="Quitar CV" onClick={() => setProfiles(profiles.map(x => x.id === p.id ? {...x, cvUrl: ''} : x))}>×</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {teamProfiles.length === 0 && (
                  <div className="pjl-empty-state" style={{ gridColumn: '1 / -1' }}>
                    <div className="empty-icon">👤</div>
                    <h4 className="empty-title">Sin miembros en este equipo</h4>
                    <p className="empty-desc">Cargá al primer integrante con su foto, cargo y currículum. Aparecerá automáticamente en la sección Consejo del sitio.</p>
                    <button className="btn-premium btn-premium-gold" onClick={() => {
                      const newProfile: MemberProfile = {
                        id: Date.now(),
                        name: 'Nuevo Miembro',
                        role: 'Cargo',
                        bio: 'Biografía',
                        quote: '',
                        teamKey: activeProfileTeam,
                        photo: ''
                      };
                      setProfiles([...profiles, newProfile]);
                      showToast('Miembro agregado ✔');
                    }}>+ Agregar primer miembro</button>
                  </div>
                )}
              </div>
            </div>
            );
          })()}


          {/* USUARIOS */}
          {mod === 'usuarios' && (() => {
            const roleMeta: Record<string, { label: string; color: string; bg: string }> = {
              desarrollador: { label: 'Desarrollador', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
              superadmin: { label: 'Super Admin', color: '#b45309', bg: 'rgba(200,151,58,0.18)' },
              editor: { label: 'Editor', color: '#8a6516', bg: 'rgba(200,151,58,0.12)' },
              viewer: { label: 'Visualizador', color: '#475569', bg: 'rgba(71,85,105,0.12)' },
            };
            const statusMeta: Record<string, { label: string; color: string; bg: string }> = {
              activo: { label: 'Activo', color: '#166534', bg: '#dcfce7' },
              inactivo: { label: 'Bloqueado', color: '#991b1b', bg: '#fee2e2' },
              pendiente: { label: 'Pendiente', color: '#92400e', bg: '#fef3c7' },
            };
            const filteredUsers = allUsers.filter(u =>
              u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase())
            );
            return (
            <div className="animate-reveal pjl-card" style={{ padding: '40px' }}>
              <div className="admin-section-header admin-stack-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '26px', flexWrap: 'wrap', gap: '16px' }}>
                <div className="admin-section-title-group">
                  <h3 className="serif admin-section-title" style={{ margin: 0 }}>Gestión de Acceso</h3>
                  <p className="admin-section-desc">Creá cuentas, definí roles y habilitá módulos específicos. Los cambios se sincronizan al instante con la cuenta de cada usuario.</p>
                </div>
                <div className="admin-toolbar" style={{ marginBottom: 0 }}>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
                    <input
                      type="text"
                      placeholder="Buscar usuario..."
                      className="pjl-input"
                      style={{ paddingLeft: '35px', width: '230px', height: '40px' }}
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <button className="btn-premium btn-premium-gold" onClick={() => {
                    setForm({ email: '', name: '', role: 'editor', permissions: ['dashboard'] });
                    setModal('usuarios');
                  }}>+ Nuevo Usuario</button>
                </div>
              </div>

              {currentUser?.role === 'desarrollador' && (
                <div className="pjl-card admin-user-pending-card" style={{ padding: '22px 24px', marginBottom: '24px', background: 'linear-gradient(135deg, #fdf7e8, #fffdf5)', border: '1.5px dashed #e9c96a' }}>
                  <h4 className="serif" style={{ margin: '0 0 14px', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    ⏳ Solicitudes pendientes
                    {pendingProfiles.length > 0 && (
                      <span className="user-count-pill">{pendingProfiles.length}</span>
                    )}
                  </h4>
                  {pendingProfiles.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>No hay cuentas esperando aprobación. Todo al día ✨</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {pendingProfiles.map((profile, i) => (
                        <div key={profile.id} className="admin-user-pending-item user-rise" style={{ padding: '14px 16px', borderRadius: '14px', background: '#fff', border: '1px solid #f1d77b', animationDelay: `${i * 70}ms` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                              <div className="user-avatar">{profile.name[0]}</div>
                              <div style={{ minWidth: 0 }}>
                                <strong>{profile.name}</strong> <span style={{ color: '#666', fontSize: '12px' }}>{profile.email}</span>
                                <div style={{ fontSize: '11px', color: '#777', marginTop: '4px' }}>Registrado el {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                className="btn-premium btn-premium-outline"
                                style={{ padding: '8px 14px', fontSize: '11px' }}
                                onClick={() => void handleResendVerification(profile.email, profile.name)}
                                title="Reenviar correo de verificación"
                              >
                                ✉️ Reenviar
                              </button>
                              <button
                                className="btn-premium btn-premium-gold"
                                style={{ padding: '8px 14px', fontSize: '11px' }}
                                onClick={() => handleApproveProfile(profile.id)}
                              >
                                ✓ Aprobar cuenta
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="users-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 330px', gap: '28px', alignItems: 'start' }}>
                {/* LISTA DE USUARIOS */}
                <div className="users-grid">
                  {filteredUsers.map((u, i) => {
                    const role = roleMeta[u.role] || roleMeta.viewer;
                    const status = statusMeta[u.status || 'activo'] || statusMeta.activo;
                    const permCount = u.permissions?.filter(p => p !== 'dashboard').length || 0;
                    return (
                      <div key={u.id} className="user-card user-rise" style={{ animationDelay: `${i * 70}ms` }}>
                        <div className="user-card-head">
                          <div className="user-avatar is-lg">{u.name[0]}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong className="user-card-name">{u.name}</strong>
                            <code className="user-card-email">{u.email}</code>
                          </div>
                          <span className="user-role-badge" style={{ color: role.color, background: role.bg }}>{role.label}</span>
                        </div>
                        <div className="user-card-meta">
                          <span className="user-status-pill" style={{ color: status.color, background: status.bg }}>● {status.label}</span>
                          <span className="user-perm-chip" title={u.permissions?.join(', ') || 'Sin módulos'}>🛡 {permCount} módulo{permCount === 1 ? '' : 's'}</span>
                          <span className="user-last-active">🕒 {u.lastActive ? new Date(u.lastActive).toLocaleDateString() : 'Sin actividad'}</span>
                        </div>
                        <div className="user-card-actions">
                          <button onClick={() => openEdit('usuarios', u)} className="btn-premium btn-premium-outline" style={{ padding: '7px 14px', fontSize: '10.5px' }}>✏️ Editar accesos</button>
                          <button onClick={() => void deleteItem('users', u.id)} className="user-delete-btn">🗑 Eliminar</button>
                        </div>
                      </div>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <div className="pjl-empty-state">
                      <div className="empty-icon">🔍</div>
                      <h4 className="empty-title">Sin usuarios encontrados</h4>
                      <p className="empty-desc">Ningún usuario coincide con «{searchTerm}». Verificá el nombre o el correo.</p>
                    </div>
                  )}
                </div>

                {/* ROLE PERMISSIONS INFO */}
                <div className="pjl-card roles-info-card">
                  <h4 className="serif" style={{ color: 'var(--navy)', margin: '0 0 14px', borderBottom: '1px solid var(--gold-pale)', paddingBottom: '10px' }}>Permisos por Rol</h4>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {[
                      { icon: '👑', title: 'SUPERADMIN', color: '#b45309', desc: 'Acceso total: usuarios, configuración del sistema y branding.' },
                      { icon: '✏️', title: 'EDITOR', color: '#8a6516', desc: 'Crea y edita noticias, actividades, capillas y contenido general según los módulos habilitados.' },
                      { icon: '👁️', title: 'VIEWER', color: '#64748b', desc: 'Solo lectura de estadísticas y listados, limitado a los módulos asignados.' },
                    ].map((r, i) => (
                      <div key={r.title} className="roles-info-item user-rise" style={{ animationDelay: `${200 + i * 80}ms` }}>
                        <span className="roles-info-icon">{r.icon}</span>
                        <div>
                          <p style={{ fontWeight: 800, color: r.color, fontSize: '12px', margin: '0 0 4px' }}>{r.title}</p>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{r.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            );
          })()}

          {/* CONFIGURACIÓN */}
          {mod === 'configuracion' && (
            <div className="animate-reveal">
              <div className="admin-section-header" style={{ marginBottom: '24px' }}>
                <div className="admin-section-title-group">
                  <h3 className="serif admin-section-title" style={{ margin: 0 }}>Configuración General</h3>
                  <p className="admin-section-desc">Redes sociales, integraciones externas y herramientas de mantenimiento del sitio.</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              
              {/* COL 1: REDES Y MANTENIMIENTO */}
              <div style={{ display: 'grid', gap: '30px' }}>
                <div className="pjl-card" style={{ padding: '40px' }}>
                  <h3 className="serif" style={{ marginBottom: '30px' }}>Redes Sociales</h3>
                  <div style={{ display: 'grid', gap: '20px' }}>
                    {Object.entries(social).map(([key, val]) => (
                      <div key={key} className="form-group">
                        <label className="premium-label">{key.toUpperCase()}</label>
                        <input 
                          className="pjl-input" 
                          value={val as string} 
                          onChange={e => setSocial({...social, [key]: e.target.value})} 
                          placeholder={`URL de ${key}`}
                        />
                      </div>
                    ))}
                    <button className="btn-premium btn-premium-gold" style={{ marginTop: '10px' }} onClick={() => showToast('Redes sociales actualizadas ✔')}>GUARDAR REDES</button>
                  </div>
                </div>

                <div className="pjl-card" style={{ padding: '40px' }}>
                  <h3 className="serif" style={{ marginBottom: '25px' }}>⚙️ Mantenimiento</h3>
                  <div style={{ display: 'grid', gap: '15px' }}>
                    <div style={{ padding: '20px', background: 'var(--cream)', borderRadius: '15px', border: '1px solid var(--gold-pale)' }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>Respaldo de Datos</p>
                      <p style={{ margin: '5px 0 15px', fontSize: '11px', color: 'var(--text-muted)' }}>Descarga un archivo con toda la información del sitio.</p>
                      <button onClick={() => {
                        const data = JSON.stringify(localStorage);
                        const blob = new Blob([data], {type: 'application/json'});
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = 'pjl_backup.json';
                        link.click();
                      }} className="btn-premium btn-premium-gold" style={{ width: '100%' }}>DESCARGAR BACKUP JSON</button>
                    </div>

                    <div style={{ padding: '20px', background: 'var(--cream)', borderRadius: '15px', border: '1px solid var(--gold-pale)' }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>Reiniciar Estadísticas</p>
                      <p style={{ margin: '5px 0 15px', fontSize: '11px', color: 'var(--text-muted)' }}>Borra todos los contadores de visitas e interacciones.</p>
                      <button onClick={resetStats} className="btn-premium btn-premium-outline" style={{ width: '100%', borderColor: '#ef4444', color: '#ef4444' }}>REINICIAR A 0</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* COL 2: VISIBILIDAD E INTEGRACIONES */}
              <div style={{ display: 'grid', gap: '30px' }}>
                <div className="pjl-card" style={{ padding: '40px' }}>
                  <h3 className="serif" style={{ marginBottom: '25px' }}>🌐 Integraciones</h3>
                  <div style={{ display: 'grid', gap: '20px' }}>
                    
                    {/* VATICAN WIDGET TOGGLE */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', background: 'var(--cream)', borderRadius: '15px', border: '1px solid var(--gold-pale)' }}>
                      <div>
                        <p style={{ fontWeight: 700, color: 'var(--navy)', margin: 0, fontSize: '13px' }}>Widget Vaticano</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Muestra noticias del Vaticano en el menú</p>
                      </div>
                      <label className="pjl-switch">
                        <input type="checkbox" checked={!!branding.showVaticanWidget} onChange={(e) => setBranding({...branding, showVaticanWidget: e.target.checked})} />
                        <span className="pjl-slider"></span>
                      </label>
                    </div>

                    <div className="form-group">
                      <label className="premium-label">ID / CORREO / URL EMBED DE GOOGLE CALENDAR</label>
                      <input 
                        className="pjl-input" 
                        value={content.googleCalendarUrl || ''} 
                        onChange={e => setContent({...content, googleCalendarUrl: e.target.value})} 
                        placeholder="ej: tu-email@gmail.com o enlace embed de Google Calendar"
                      />
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '5px' }}>Acepta correo del calendario, ID o enlace de inserción. Las opciones de visibilidad se guardan arriba.</p>
                    </div>

                    <div className="form-group">
                      <label className="premium-label">GOOGLE CLIENT ID</label>
                      <input
                        className="pjl-input"
                        value={content.googleCalendarClientId || ''}
                        onChange={e => setContent({ ...content, googleCalendarClientId: e.target.value })}
                        placeholder="xxx.apps.googleusercontent.com"
                      />
                    </div>

                    <div className="form-group">
                      <label className="premium-label">GOOGLE CLIENT SECRET</label>
                      <input
                        className="pjl-input"
                        type="password"
                        value={content.googleCalendarClientSecret || ''}
                        onChange={e => setContent({ ...content, googleCalendarClientSecret: e.target.value })}
                        placeholder="Client secret de Google"
                      />
                    </div>

                    <button className="btn-premium btn-premium-gold" onClick={() => showToast('Configuración de integraciones guardada ✔')}>GUARDAR CAMBIOS</button>
                  </div>
                </div>

                <div className="pjl-card" style={{ padding: '40px' }}>
                  <h3 className="serif" style={{ marginBottom: '30px' }}>Visibilidad de Secciones</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '25px' }}>
                    Activa o desactiva la visibilidad de las secciones principales del sitio web.
                  </p>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {Object.entries(sections).map(([key, val]) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', background: 'var(--cream)', borderRadius: '15px', border: '1px solid var(--gold-pale)' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--navy)', textTransform: 'uppercase' }}>{key.replace(/([A-Z])/g, ' $1')}</span>
                        <label className="pjl-switch">
                          <input type="checkbox" checked={val} onChange={() => setSections({...sections, [key as keyof typeof sections]: !val})} />
                          <span className="pjl-slider"></span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pjl-card" style={{ padding: '40px' }}>
                  <h3 className="serif" style={{ marginBottom: '30px' }}>📊 Datos Oficiales y SEO</h3>
                  <div style={{ display: 'grid', gap: '20px' }}>
                    <div className="form-group">
                      <label className="premium-label">EMAIL OFICIAL DE CONTACTO</label>
                      <input className="pjl-input" value={content.contactEmail || ''} onChange={e => setContent({...content, contactEmail: e.target.value})} placeholder="ejemplo@pjlluque.org" />
                    </div>
                    <div className="form-group">
                      <label className="premium-label">DIRECCIÓN (SEDE)</label>
                      <input className="pjl-input" value={content.contactAddress || ''} onChange={e => setContent({...content, contactAddress: e.target.value})} placeholder="Santuario Virgen del Rosario, Luque" />
                    </div>
                    <div className="form-group">
                      <label className="premium-label">GOOGLE ANALYTICS ID</label>
                      <input className="pjl-input" value={content.googleAnalyticsId || ''} onChange={e => setContent({...content, googleAnalyticsId: e.target.value})} placeholder="G-XXXXXXXXXX" />
                    </div>
                    <div className="form-group">
                      <label className="premium-label">META PIXEL ID</label>
                      <input className="pjl-input" value={content.metaPixelId || ''} onChange={e => setContent({...content, metaPixelId: e.target.value})} placeholder="123456789012345" />
                    </div>
                    <button className="btn-premium btn-premium-gold" onClick={() => showToast('Datos SEO guardados ✔')}>GUARDAR SEO</button>
                  </div>
                </div>
              </div>
              </div>

            </div>
          )}

        </div>
      </main>

      {/* MODALS */}
      {modal && (
        <div className="glass-modal-overlay" onClick={closeModal}>
          <div className="pjl-card animate-reveal modal-responsive-card" style={{ maxWidth: '600px', width: '100%', padding: '50px' }} onClick={e => e.stopPropagation()}>
            <h3 className="serif" style={{ marginBottom: '30px', color: 'var(--navy)' }}>
              {editId ? 'Editar' : 'Crear'} {({
                noticias: 'Noticia',
                actividades: 'Actividad',
                docs: 'Documento',
                capillas: 'Capilla',
                usuarios: 'Usuario',
              } as Record<string, string>)[modal] || 'Elemento'}
            </h3>

            {(modal === 'noticias' || modal === 'actividades') && (
              <div style={{ display: 'grid', gap: '20px' }}>
                <div className="form-group">
                  <label className="premium-label">TÍTULO</label>
                  <input className="pjl-input" value={form.title || ''} onChange={e => setForm({...form, title: e.target.value})} />
                  {form.title && (
                    <div style={{ marginTop: '5px', padding: '10px', background: 'var(--cream)', borderRadius: '8px', border: '1px solid var(--gold-pale)' }}>
                      <p style={{ fontSize: '9px', color: 'var(--gold)', marginBottom: '4px' }}>PREVISUALIZACIÓN:</p>
                      <h4 className="serif" style={{ color: 'var(--navy)', margin: 0, fontSize: '1.1rem' }}>{form.title}</h4>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="premium-label">FECHA</label>
                  <input className="pjl-input" type="date" value={form.date || ''} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                {modal === 'noticias' ? (
                  <>
                    <div className="form-group">
                      <label className="premium-label">CUERPO DEL ARTÍCULO</label>
                      <textarea className="pjl-input" rows={8} value={form.body || ''} onChange={e => setForm({...form, body: e.target.value})} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'var(--cream)', padding: '15px', borderRadius: '12px', border: '1px solid var(--gold-pale)' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--navy)' }}>PUBLICAR INMEDIATAMENTE</span>
                      <label className="pjl-switch">
                        <input type="checkbox" checked={!!form.published} onChange={e => setForm({...form, published: e.target.checked})} />
                        <span className="pjl-slider"></span>
                      </label>
                    </div>
                  </>
                ) : (
                  <div className="form-group">
                    <label className="premium-label">CATEGORÍA</label>
                    <select className="pjl-input" value={form.category || 'Formación'} onChange={e => setForm({...form, category: e.target.value})}>
                      <option>Formación</option><option>Liturgia</option><option>Misión</option><option>Social</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {modal === 'documentos' && (
              <div style={{ display: 'grid', gap: '20px' }}>
                <div style={{ padding: '18px', borderRadius: '18px', background: 'linear-gradient(135deg, rgba(200,151,58,0.12), rgba(26,39,68,0.06))', border: '1px solid var(--gold-pale)', display: 'grid', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
                    <div>
                      <div className="premium-label" style={{ marginBottom: '6px' }}>ARCHIVO PRINCIPAL</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Sube el documento y el panel completará automáticamente formato, tamaño y fecha.</div>
                    </div>
                    <label className="btn-premium btn-premium-gold" style={{ padding: '8px 16px', fontSize: '11px' }}>
                      SUBIR ARCHIVO
                      <input type="file" style={{ display: 'none' }} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,image/*" onChange={handleDocumentFileUpload} />
                    </label>
                  </div>
                  <div style={{ borderRadius: '16px', border: '1px solid rgba(200,151,58,0.18)', background: '#fff', overflow: 'hidden' }}>
                    {form.url && canPreviewInFrame(form) ? (
                      getDocPresentation(form).kind === 'image' ? (
                        <img src={form.url} alt={form.name || 'Vista previa'} style={{ width: '100%', height: '220px', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <iframe src={form.url} title={form.name || 'Vista previa de documento'} style={{ width: '100%', height: '220px', border: 'none', display: 'block', background: '#fff' }} />
                      )
                    ) : (
                      <div style={{ minHeight: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px', color: getDocPresentation(form).color || 'var(--gold)' }}>
                        <div style={{ fontSize: '40px' }}>{getDocPresentation(form).icon}</div>
                        <div style={{ fontWeight: 800, color: 'var(--navy)' }}>{form.name || 'Documento sin nombre'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>PDF e imágenes mostrarán vista previa aquí. Word y otros formatos se registran con su ficha.</div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label className="premium-label">NOMBRE DEL ARCHIVO</label>
                  <input className="pjl-input" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="premium-label">FORMATO (PDF, DOC, etc)</label>
                    <input className="pjl-input" value={form.type || 'PDF'} onChange={e => setForm({...form, type: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="premium-label">TAMAÑO</label>
                    <input className="pjl-input" value={form.size || '1.0 MB'} onChange={e => setForm({...form, size: e.target.value})} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="premium-label">CATEGORÍA</label>
                    <select className="pjl-input" value={form.category || 'General'} onChange={e => setForm({...form, category: e.target.value})}>
                      <option>General</option>
                      <option>Boletines</option>
                      <option>Planificación</option>
                      <option>Currículos</option>
                      <option>Formación</option>
                      <option>Presentaciones</option>
                      <option>Recursos visuales</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="premium-label">FECHA DE CARGA</label>
                    <input className="pjl-input" type="date" value={form.uploadedAt || ''} onChange={e => setForm({...form, uploadedAt: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="premium-label">DESCRIPCIÓN BREVE</label>
                  <textarea className="pjl-input" rows={4} value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} placeholder="Describe para qué sirve este archivo y cuándo conviene usarlo." />
                </div>
                <div className="form-group">
                  <label className="premium-label">URL / ENLACE DEL ARCHIVO</label>
                  <input className="pjl-input" value={form.url || ''} onChange={e => setForm({...form, url: e.target.value})} placeholder="https://... o archivo subido" />
                </div>
                <div style={{ padding: '16px', borderRadius: '16px', background: 'var(--cream)', border: '1px solid var(--gold-pale)', display: 'grid', gap: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--navy)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Sugerencias útiles</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.7 }}>Usa categorías para ordenar la biblioteca, agrega descripciones cortas para que el equipo sepa qué descargar y sube el archivo desde aquí para evitar enlaces rotos.</div>
                </div>
              </div>
            )}

            {modal === 'capillas' && (
              <div style={{ display: 'grid', gap: '20px' }}>
                <div className="form-group">
                  <label className="premium-label">NOMBRE DE LA CAPILLA</label>
                  <input className="pjl-input" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="premium-label">LOGOTIPO / ESCUDO PERSONAL</label>
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--cream)', border: '2px solid var(--gold-pale)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <SafeImg src={form.logoUrl} alt="Previsualización de Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <label className="btn-premium btn-premium-gold" style={{ padding: '8px 15px', fontSize: '10px' }}>
                      SUBIR LOGO
                      <input type="file" style={{ display: 'none' }} accept="image/*" onChange={e => handleFileUpload(e, url => setForm({...form, logoUrl: url}))} />
                    </label>
                  </div>
                </div>
                <div className="form-group">
                  <label className="premium-label">FOTO DE LA CAPILLA (FACHADA)</label>
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '12px', background: 'var(--cream)', border: '2px solid var(--gold-pale)', overflow: 'hidden' }}>
                      {form.photo && <img src={form.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Previsualización de Fachada" />}
                    </div>
                    <label className="btn-premium btn-premium-gold" style={{ padding: '8px 15px', fontSize: '10px' }}>
                      SUBIR FOTO
                      <input type="file" style={{ display: 'none' }} accept="image/*" onChange={e => handleFileUpload(e, url => setForm({...form, photo: url}))} />
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label className="premium-label">ZONA PASTORAL</label>
                  <select className="pjl-input" value={form.zonaId || 1} onChange={e => setForm({...form, zonaId: parseInt(e.target.value)})}>
                    <option value={1}>Zona 1 (San Miguel)</option>
                    <option value={2}>Zona 2 (San Rafael)</option>
                    <option value={3}>Zona 3 (San Gabriel)</option>
                    <option value={4}>Zona 4 (Urbana)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="premium-label">COLOR DEL MARCADOR EN EL MAPA</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <input type="color" className="pjl-input" style={{ width: '60px', height: '40px', padding: '2px' }} value={form.markerColor || '#C8973A'} onChange={e => setForm({...form, markerColor: e.target.value})} />
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Este color se usará para el ícono ⛪ de esta capilla específica en el mapa.
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label className="premium-label">NOMBRE DE LA COMUNIDAD JUVENIL</label>
                  <input className="pjl-input" value={form.comunidadNombre || ''} onChange={e => setForm({...form, comunidadNombre: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="premium-label">ESTADO DE LA COMUNIDAD</label>
                  <select className="pjl-input" value={form.estadoComunidad || 'Activo'} onChange={e => setForm({...form, estadoComunidad: e.target.value})}>
                    <option value="Activo">Activo</option>
                    <option value="Nucleación">Nucleación</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="premium-label">DIRECCIÓN / CALLE</label>
                  <input className="pjl-input" value={form.address || ''} onChange={e => setForm({...form, address: e.target.value})} placeholder="Ej: Calle Principal c/ San Miguel" />
                </div>
                <div className="form-group">
                  <label className="premium-label">URL UBICACIÓN (GOOGLE MAPS)</label>
                  <input className="pjl-input" value={form.locationUrl || ''} onChange={e => setForm({...form, locationUrl: e.target.value})} placeholder="https://goo.gl/maps/..." />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label className="premium-label">LATITUD</label>
                    <input type="number" step="any" className="pjl-input" value={form.lat ?? ''} onChange={e => setForm({ ...form, lat: e.target.value === '' ? undefined : parseFloat(e.target.value) })} placeholder="-25.2688" />
                  </div>
                  <div className="form-group">
                    <label className="premium-label">LONGITUD</label>
                    <input type="number" step="any" className="pjl-input" value={form.lng ?? ''} onChange={e => setForm({ ...form, lng: e.target.value === '' ? undefined : parseFloat(e.target.value) })} placeholder="-57.4754" />
                  </div>
                </div>
                {modal === 'capillas' && !!editId && (
                  <div className="form-group">
                    <label className="premium-label">UBICACIÓN PRECISA EN EL MAPA</label>
                    <button
                      type="button"
                      className="btn-premium btn-premium-gold modal-place-btn"
                      onClick={() => goToTerritoryPlace(editId as string)}
                    >📍 UBICAR EN EL MAPA INTERACTIVO</button>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Se abrirá Gestión de Territorio en modo ubicación: hacé clic en el punto exacto y volvé.
                    </div>
                  </div>
                )}
              </div>
            )}

            {modal === 'usuarios' && (
              <div style={{ display: 'grid', gap: '20px' }}>
                <div className="form-group">
                  <label className="premium-label">NOMBRE COMPLETO</label>
                  <input className="pjl-input" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ej: Juan Pérez" />
                </div>
                <div className="form-group">
                  <label className="premium-label">EMAIL (USUARIO)</label>
                  <input className="pjl-input" type="email" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} placeholder="juan@ejemplo.com" />
                </div>
                <div className="form-group">
                  <label className="premium-label">ROL DEL SISTEMA</label>
                  <select className="pjl-input" value={form.role || 'viewer'} onChange={e => setForm({...form, role: e.target.value})}>
                    <option value="superadmin">Super Administrador (Acceso Total)</option>
                    <option value="editor">Editor (Acceso Modular)</option>
                    <option value="viewer">Visualizador (Solo Lectura)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="premium-label">ESTADO DE CUENTA</label>
                  <select className="pjl-input" value={form.status || 'activo'} onChange={e => setForm({...form, status: e.target.value})}>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Desactivado / Bloqueado</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="premium-label">CONTRASEÑA</label>
                  <input className="pjl-input" type="text" value={form.password || ''} onChange={e => setForm({...form, password: e.target.value})} placeholder="Definir contraseña de acceso" />
                </div>
                
                {(form.role === 'editor' || form.role === 'viewer') && (
                  <div style={{ marginTop: '20px' }}>
                    <label className="premium-label" style={{ marginBottom: '12px', display: 'block' }}>🔐 MÓDULOS PERMITIDOS (ACCESO ESPECÍFICO)</label>
                    <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {form.role === 'viewer'
                        ? 'Para usuarios visualizadores, estos módulos se mostrarán en modo solo lectura.'
                        : 'Para editores, estos módulos quedarán habilitados de forma inmediata al guardar.'}
                    </p>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
                      gap: '10px', 
                      background: 'var(--cream)', 
                      padding: '20px', 
                      borderRadius: '16px', 
                      border: '1px solid var(--gold-pale)' 
                    }}>
                      {NAV_ITEMS.filter(n => !NON_DELEGABLE_MODULES.includes(n.id as Module)).map(n => {
                        const icon = (branding[n.iconKey as keyof Branding] as string) || n.defaultIcon;
                        const checked = (form.permissions || []).includes(n.id);
                        return (
                        <label key={n.id} className={`perm-chip ${checked ? 'checked' : ''}`}>
                          <input
                            type="checkbox"
                            style={{ display: 'none' }}
                            checked={checked}
                            onChange={e => {
                              const perms = form.permissions || [];
                              if (e.target.checked) setForm({...form, permissions: [...perms, n.id]});
                              else setForm({...form, permissions: perms.filter((p: string) => p !== n.id)});
                            }}
                          />
                          <span className="perm-chip-check">{checked ? '✓' : ''}</span>
                          <span>{icon} {n.label}</span>
                        </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="premium-label">URL AVATAR (FOTO)</label>
                  <input className="pjl-input" type="text" value={form.avatar || ''} onChange={e => setForm({...form, avatar: e.target.value})} placeholder="https://..." />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '20px', marginTop: '40px' }}>
              <button className="btn-premium btn-premium-gold" style={{ flex: 1, padding: '15px' }} onClick={
                modal === 'noticias' ? saveNews : 
                modal === 'actividades' ? saveActivity : 
                modal === 'capillas' ? saveChapel :
                modal === 'usuarios' ? saveUser :
                saveDoc
              }>GUARDAR DATOS</button>
              <button className="btn-premium btn-premium-outline" style={{ flex: 1 }} onClick={closeModal}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div>Cargando panel...</div>}>
      <AdminContent />
    </Suspense>
  );
}
