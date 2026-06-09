'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
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
  DEFAULT_STATS, DEFAULT_THEME_PALETTE, DEFAULT_USERS
} from '@/lib/pjlStore';
import { fetchStoreValue, upsertStoreValue, subscribeStoreChanges } from '@/lib/supabaseStore';
import { SupabaseProfile, fetchProfileByEmail, fetchAllProfiles, fetchPendingProfiles, approveProfile, signInProfile, signUpProfile, subscribeProfileChanges, deleteProfile, resendVerificationEmail } from '@/lib/supabaseProfiles';

const ZonaMap = dynamic(() => import('@/components/ZonaMap'), { 
  ssr: false,
  loading: () => <div style={{ height: '400px', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '25px', border: '1px solid var(--gold-pale)' }}>Cargando mapa interactivo...</div>
});

type Module = 'dashboard' | 'identidad' | 'apariencia' | 'contenido' | 'actividades' | 'noticias' | 'usuarios' | 'documentos' | 'configuracion' | 'perfiles' | 'capillas' | 'asistente' | 'carrusel' | 'territorio' | 'logs';

// Read PageStat from pjlStore

const CREDS = { user: 'admin', pass: 'admin' };

const NAV_ITEMS = [
  { id: 'dashboard',      icon: '📊', label: 'Dashboard' },
  { id: 'identidad',      icon: '🎨', label: 'Identidad' },
  { id: 'carrusel',       icon: '🖼️', label: 'Carrusel Hero' },
  { id: 'apariencia',     icon: '✨', label: 'Apariencia' },
  { id: 'contenido',      icon: '📝', label: 'Contenido' },
  { id: 'noticias',       icon: '📰', label: 'Noticias' },
  { id: 'actividades',    icon: '📅', label: 'Actividades' },
  { id: 'capillas',       icon: '⛪', label: 'Capillas' },
  { id: 'territorio',     icon: '🗺️', label: 'Territorio' },
  { id: 'perfiles',       icon: '👤', label: 'Currículos' },
  { id: 'documentos',     icon: '📁', label: 'Documentos' },
  { id: 'usuarios',       icon: '👥', label: 'Usuarios' },
  { id: 'logs',           icon: '📜', label: 'Historial' },
  { id: 'configuracion',  icon: '⚙️', label: 'Configuración' },
  { id: 'asistente',      icon: '🤖', label: 'Asistente IA' },
];

const ADMIN_RESTRICTED_MODULES: Module[] = ['identidad', 'apariencia', 'usuarios', 'configuracion'];

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
    if (currentUser.role === 'desarrollador') return true;
    if (m === 'dashboard' && action === 'view') return true;

    const explicitPermissions = currentUser.permissions || [];
    const hasExplicitRules = explicitPermissions.length > 0;

    if (currentUser.role === 'editor') {
      if (ADMIN_RESTRICTED_MODULES.includes(m)) return false;
      if (hasExplicitRules) return explicitPermissions.includes(m);
      return true;
    }
    if (currentUser.role === 'viewer') {
      if (action !== 'view' || ADMIN_RESTRICTED_MODULES.includes(m)) return false;
      return hasExplicitRules ? explicitPermissions.includes(m) : ['dashboard', 'logs', 'noticias', 'actividades', 'documentos', 'capillas', 'perfiles', 'territorio'].includes(m);
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
  const [chapels, setChapels] = useLS<Chapel[]>('chapels', []);
  const [pageStats, setPageStats] = useLS<PageStat[]>('stats', DEFAULT_STATS);
  const [logs, setLogs] = useLS<any[]>('logs', []);

  useEffect(() => {
    let isMounted = true;

    const updateStatsFromRemote = (remoteValue: unknown) => {
      if (!remoteValue) return;
      try {
        const stats = remoteValue as PageStat[];
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
  const [mod, setMod] = useState<Module>(modParam);
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

  // --- AI STATE ---
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- FILTERS ---
  const [searchTerm, setSearchTerm] = useState('');

  // --- TERRITORY EDITOR ---
  const [capturingZone, setCapturingZone] = useState<number | null>(null);
  const [tempPolygon, setTempPolygon] = useState<[number, number][]>([]);

  useEffect(() => {
    (window as any).onPJLMapClick = (lat: number, lng: number) => {
      if (capturingZone !== null) {
        setTempPolygon(prev => [...prev, [lat, lng]]);
      }
    };
    return () => { (window as any).onPJLMapClick = null; };
  }, [capturingZone]);

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMod(modParam); }, [modParam]);
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
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
          headers: { 'User-Agent': 'PJL-Admin-App/1.0' }
        })
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

  const navigateMod = (m: Module) => {
    router.push(`/admin?mod=${m}`);
    setSidebarOpen(false);
  };

  const closeModal = () => { setModal(null); setEditId(null); setForm({}); };
  const openNew = (type: Module) => { setModal(type); setEditId(null); setForm({}); };
  const openEdit = (type: Module, item: NewsItem | Activity | FaqItem | DocItem | GalleryItem | Chapel | MemberProfile | User | Record<string, string>) => { setModal(type); setEditId((item as { id?: number | string }).id || null); setForm(item); };

  // --- CRUD ---
  const saveNews = () => {
    const updated = editId
      ? news.map(n => n.id === editId ? { ...n, ...form } : n)
      : [...news, { ...form, id: Date.now(), published: true }];
    setNews(updated); closeModal(); showToast('Noticia actualizada ✔');
    addLog(editId ? 'editar' : 'crear', 'noticias', `Tít: ${form.title}`);
  };

  const saveActivity = () => {
    const updated = editId
      ? activities.map(a => a.id === editId ? { ...a, ...form } : a)
      : [...activities, { ...form, id: Date.now(), active: true }];
    setActivities(updated); closeModal(); showToast('Actividad guardada ✔');
    addLog(editId ? 'editar' : 'crear', 'actividades', `Act: ${form.title}`);
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

  const saveUser = () => {
    if (!form.email || !form.name) return;
    const normalizedUser = {
      ...form,
      permissions:
        form.role === 'superadmin'
          ? NAV_ITEMS.map(n => n.id)
          : Array.from(new Set(['dashboard', ...(form.permissions || [])])),
    };
    const updated = editId
      ? allUsers.map(u => u.id === editId ? { ...u, ...normalizedUser } : u)
      : [...allUsers, { ...normalizedUser, id: Date.now().toString(), password: form.password || 'pjl123', createdAt: new Date().toISOString() }];
    setAllUsers(updated); closeModal(); showToast('Usuario actualizado ✔');
    addLog(editId ? 'editar' : 'crear', 'usuarios', `User: ${form.email}`);
  };

  const deleteItem = async (type: 'news' | 'activities' | 'docs' | 'chapels' | 'users', id: number | string) => {
    if (!confirm('¿Estás seguro de eliminar este elemento?')) return;
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
            {branding.mainLogo ? (
              <img src={branding.mainLogo} alt="PJL Logo" className="logo-img-circular" style={{ width: '40px', height: '40px', border: '2px solid var(--gold)' }} />
            ) : (
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 'bold' }}>P</div>
            )}
            <div className="serif" style={{ fontSize: '1.6rem', marginLeft: '10px' }}>PJL <em>Admin</em></div>
          </Link>
          <p className="premium-label" style={{ fontSize: '0.65rem', color: 'var(--gold)', paddingLeft: '50px' }}>Panel Institucional</p>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(n => {
            const allowed = hasPermission(n.id as Module);
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
                <span className="nav-icon">{n.icon}</span>
                <span className="nav-label">{n.label}</span>
                {!allowed && <span style={{ marginLeft: 'auto', fontSize: '12px', opacity: 0.9 }}>🔒</span>}
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
      <main className="admin-main">
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
            <h2 className="serif" style={{ color: 'var(--navy)' }}>
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
                <div style={{
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

        <div className="admin-content" style={{ position: 'relative' }}>
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

              {/* TOP KPI CARDS - PREMIUM DESIGN (FOTO 3 STYLE) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '25px', marginBottom: '40px' }}>
                <div className="pjl-card hover-lift" style={{ padding: '30px', background: 'linear-gradient(135deg, var(--navy) 0%, #2E3F6B 100%)', border: 'none', color: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 600, letterSpacing: '1px' }}>VISITAS TOTALES</span>
                      <h3 style={{ color: '#fff', fontSize: '36px', margin: '10px 0 0', fontFamily: 'var(--font-display)' }}>{liveVisits.toLocaleString('es-ES')}</h3>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', fontSize: '24px' }}>📈</div>
                  </div>
                  <div style={{ marginTop: '20px', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                    Actualización automática del navegador
                  </div>
                </div>

                <div className="pjl-card hover-lift" style={{ padding: '30px', border: '1px solid var(--gold-pale)', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, letterSpacing: '1px' }}>INTERACCIONES</span>
                      <h3 style={{ color: 'var(--navy)', fontSize: '36px', margin: '10px 0 0', fontFamily: 'var(--font-display)' }}>{(Array.isArray(pageStats) ? pageStats : []).reduce((acc, s) => acc + (s?.interactions || 0), 0).toLocaleString('es-ES')}</h3>
                    </div>
                    <div style={{ background: 'var(--cream)', padding: '12px', borderRadius: '12px', fontSize: '24px' }}>⚡</div>
                  </div>
                  <div style={{ marginTop: '20px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Puntos de contacto activos
                  </div>
                </div>

                <div className="pjl-card hover-lift" style={{ padding: '30px', border: '1px solid var(--gold-pale)', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, letterSpacing: '1px' }}>TOP SECCIÓN</span>
                      <h3 style={{ color: 'var(--navy)', fontSize: '22px', margin: '15px 0 0', fontWeight: 800, fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>{(Array.isArray(pageStats) ? pageStats : []).sort((a, b) => (b?.visits || 0) - (a?.visits || 0))[0]?.label || '—'}</h3>
                    </div>
                    <div style={{ background: 'var(--cream)', padding: '12px', borderRadius: '12px', fontSize: '24px' }}>💎</div>
                  </div>
                  <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Preferencia del usuario
                  </div>
                </div>
              </div>

              {/* MAIN ANALYTICS GRID */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '20px', marginBottom: '20px' }}>

                {/* VISITS BY SECTION — HORIZONTAL BARS */}
                <div style={{ background: '#fff', border: '1px solid #e8e0d5', borderRadius: '16px', padding: '28px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                      <h3 style={{ margin: 0, color: 'var(--navy)', fontSize: '16px', fontWeight: 700 }}>📊 Visitas por Sección</h3>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#888' }}>Visitas e interacciones registradas automáticamente</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
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
                              <div style={{ height: '100%', width: `${pct}%`, background: i === 0 ? 'var(--gold)' : 'var(--navy)', borderRadius: '4px', transition: '1s ease' }} />
                            </div>
                            <div style={{ height: '4px', background: '#ecfdf5', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${intPct}%`, background: '#10B981', borderRadius: '4px', transition: '1s ease' }} />
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

                  {/* DISTRIBUTION DONUT (SVG) */}
                  <div style={{ background: '#fff', border: '1px solid #e8e0d5', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', flex: 1 }}>
                    <h3 style={{ margin: '0 0 16px', color: 'var(--navy)', fontSize: '15px', fontWeight: 700 }}>🥧 Distribución por Sección</h3>
                    {(() => {
                      const data = (Array.isArray(pageStats) ? pageStats : []).filter(s => (s?.visits || 0) > 0);
                      const total = data.reduce((acc, s) => acc + (s?.visits || 0), 0);
                      const colors = ['#1A2744', '#C8973A', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899'];
                      if (total === 0) return <p style={{ color: '#bbb', textAlign: 'center', padding: '20px 0', fontSize: '13px', fontStyle: 'italic' }}>Sin datos de visitas aún</p>;
                      let cumulative = 0;
                      const segments = data.slice(0, 6).map((s, i) => {
                        const pct = (s.visits || 0) / total;
                        const start = cumulative;
                        cumulative += pct;
                        return { label: s.label, visits: s.visits, pct, start, color: colors[i % colors.length] };
                      });
                      const r = 55, cx = 70, cy = 70, strokeW = 22;
                      const circ = 2 * Math.PI * r;
                      return (
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                          <svg width="140" height="140" viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
                            {segments.map((seg, i) => (
                              <circle
                                key={i}
                                cx={cx} cy={cy} r={r}
                                fill="none"
                                stroke={seg.color}
                                strokeWidth={strokeW}
                                strokeDasharray={`${seg.pct * circ} ${circ}`}
                                strokeDashoffset={-seg.start * circ}
                                transform={`rotate(-90 ${cx} ${cy})`}
                                style={{ transition: '1s ease' }}
                              />
                            ))}
                            <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontSize: '18px', fontWeight: 900, fill: 'var(--navy)' }}>{total}</text>
                            <text x={cx} y={cy + 13} textAnchor="middle" style={{ fontSize: '8px', fill: '#888', letterSpacing: 1 }}>VISITAS</text>
                          </svg>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 }}>
                            {segments.map((seg, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: seg.color, flexShrink: 0 }} />
                                <span style={{ fontSize: '11px', color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{seg.label}</span>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#888', flexShrink: 0 }}>{Math.round(seg.pct * 100)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* DISPOSITIVOS */}
                  <div style={{ background: '#fff', border: '1px solid #e8e0d5', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', flex: 1 }}>
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
                                <div style={{ height: '100%', width: `${dev.pct}%`, background: dev.color, borderRadius: '3px', transition: '1s ease' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* QUICK ACTIONS */}
                  <div style={{ background: '#fff', border: '1px solid #e8e0d5', borderRadius: '16px', padding: '22px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
                    <h3 style={{ margin: '0 0 14px', color: 'var(--navy)', fontSize: '15px', fontWeight: 700 }}>⚡ Accesos Rápidos</h3>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {[
                        { icon: '📰', label: 'Nueva Noticia', mod: 'noticias' },
                        { icon: '📅', label: 'Nuevo Evento', mod: 'actividades' },
                        { icon: '🎠', label: 'Carrusel Hero', mod: 'carrusel' },
                        { icon: '🎨', label: 'Identidad Visual', mod: 'identidad' },
                      ].map((a, i) => (
                        <button key={i} onClick={() => navigateMod(a.mod as any)} style={{ width: '100%', textAlign: 'left', padding: '9px 14px', background: 'var(--cream)', border: '1px solid var(--gold-pale)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s' }}>
                          <span>{a.icon}</span> {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* STATUS BAR — Content summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                {[
                  { label: 'Noticias', total: news.length, active: news.filter(n => n.published).length, icon: '📰', color: '#3B82F6' },
                  { label: 'Eventos', total: activities.length, active: activities.filter(a => a.active).length, icon: '📅', color: '#8B5CF6' },
                  { label: 'Capillas', total: chapels.length, active: chapels.filter(c => c.estadoComunidad === 'Activo').length, icon: '⛪', color: '#10B981' },
                  { label: 'Perfiles', total: profiles.length, active: profiles.length, icon: '👤', color: '#F59E0B' },
                  { label: 'Slides Hero', total: liveHeroImages.length, active: liveHeroImages.length, icon: '🎠', color: '#EF4444' },
                ].map((item, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e8e0d5', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                    <div style={{ fontSize: '24px', marginBottom: '6px' }}>{item.icon}</div>
                    <div style={{ fontSize: '10px', color: '#888', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>{item.label}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--navy)', lineHeight: 1 }}>{item.total}</div>
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
                    <p style={{ textAlign: 'center', color: '#bbb', padding: '20px', fontSize: '13px', fontStyle: 'italic' }}>No hay actividad registrada aún.</p>
                  ) : (
                    logs.map(log => (
                      <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 15px', background: 'var(--cream)', borderRadius: '12px', border: '1px solid var(--gold-pale)' }}>
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
          {mod === 'apariencia' && (
            <div className="animate-reveal pjl-card" style={{ padding: '40px', maxWidth: '820px' }}>
              <h3 className="serif" style={{ marginBottom: '8px' }}>Paleta de Colores &amp; Tiempos Litúrgicos</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '30px' }}>
                Elige un preset litúrgico, o personaliza los colores con el selector o ingresando el código hexadecimal.
              </p>

              {/* PRESETS */}
              <div style={{ marginBottom: '36px' }}>
                <label className="premium-label" style={{ display: 'block', marginBottom: '14px' }}>PRESETS LITÚRGICOS</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                  {[
                    { label: 'T. Ordinario',  gold: '#C8973A', navy: '#1A3B2B' },
                    { label: 'Cuaresma/Adv.', gold: '#C8973A', navy: '#3B1A3A' },
                    { label: 'Pascua/Nav.',   gold: '#D4AF37', navy: '#1A2744' },
                    { label: 'Mártires/Esp.', gold: '#C8973A', navy: '#441A1A' },
                  ].map(preset => (
                    <button
                      key={preset.label}
                      className="liturgical-preset-btn"
                      onClick={() => {
                        applyThemeColor(preset.navy, preset.gold);
                        setNavyHex(preset.navy);
                        setGoldHex(preset.gold);
                        showToast(`Temporada: ${preset.label} aplicada ✔`);
                      }}
                    >
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: preset.navy, border: '2px solid rgba(0,0,0,0.1)' }} />
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: preset.gold, border: '2px solid rgba(0,0,0,0.1)' }} />
                      </div>
                      <span className="premium-label" style={{ fontSize: '10px' }}>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--gold-pale)', margin: '0 0 30px' }} />

              {/* MANUAL COLOR PICKERS */}
              <h4 className="serif" style={{ fontSize: '1.15rem', marginBottom: '20px' }}>Personalización Manual</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', marginBottom: '32px' }}>

                {/* NAVY */}
                <div className="form-group">
                  <label className="premium-label" style={{ display: 'block', marginBottom: '10px' }}>Color Primario (Fondo, Footer, Encabezados)</label>
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
                          <button key={c} onClick={() => { setNavyHex(c); applyThemeColor(c, goldHex); }}
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
                <div className="form-group">
                  <label className="premium-label" style={{ display: 'block', marginBottom: '10px' }}>Color Secundario (Bordes, Botones, Detalles)</label>
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
                          <button key={c} onClick={() => { setGoldHex(c); applyThemeColor(navyHex, c); }}
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

              {/* PREVIEW */}
              <div style={{ background: navyHex, borderRadius: '12px', padding: '20px 28px', marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#fff', fontFamily: 'var(--font-display)', fontSize: '16px' }}>Vista previa de la paleta</span>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: goldHex, border: '2px solid rgba(255,255,255,0.3)' }} />
                  <span style={{ color: goldHex, fontWeight: 700, fontFamily: 'monospace', fontSize: '13px' }}>{goldHex.toUpperCase()}</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>/</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', fontSize: '13px' }}>{navyHex.toUpperCase()}</span>
                </div>
              </div>

              {/* SAVED PALETTES */}
              <div style={{ borderTop: '1px solid var(--gold-pale)', margin: '0 0 28px', paddingTop: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
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
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay paletas guardadas todavía. Personalizá los colores y presá «Guardar actual».</p>
                ) : (
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {savedPalettes.map((p, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <button
                          title={`${p.navy} / ${p.gold}`}
                          onClick={() => { setNavyHex(p.navy); setGoldHex(p.gold); applyThemeColor(p.navy, p.gold); showToast('Paleta aplicada ✔'); }}
                          style={{ display: 'flex', gap: '4px', background: 'none', border: '2px solid var(--gold-pale)', borderRadius: '10px', padding: '6px 10px', cursor: 'pointer', transition: '0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--gold-pale)'}
                        >
                          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: p.navy, border: '1px solid rgba(0,0,0,0.1)' }} />
                          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: p.gold, border: '1px solid rgba(0,0,0,0.1)' }} />
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

              <div style={{ display: 'flex', gap: '14px' }}>
                <button
                  onClick={() => {
                    const def = { gold: '#C8973A', navy: '#1A2744' };
                    applyThemeColor(def.navy, def.gold);
                    setNavyHex(def.navy);
                    setGoldHex(def.gold);
                    showToast('Colores restaurados al original ✔');
                  }}
                  className="btn-premium btn-premium-outline"
                >
                  Restaurar Originales
                </button>
                <button className="btn-premium btn-premium-gold" onClick={() => showToast('Paleta de colores guardada ✔')}>
                  Guardar Apariencia
                </button>
              </div>
            </div>
          )}

          {/* IDENTIDAD */}
          {mod === 'identidad' && (
            <div className="animate-reveal identity-admin-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              
              {/* LOGOS SECTION */}
              <div className="pjl-card" style={{ padding: '40px', background: 'linear-gradient(145deg, #ffffff, #fcfcfc)', border: '1px solid var(--gold-pale)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
                  <div style={{ width: '45px', height: '45px', background: 'var(--navy)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: 'var(--gold)' }}>🎨</div>
                  <div>
                    <h3 className="serif" style={{ color: 'var(--navy)', margin: 0 }}>Identidad de Marca</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Gestión de logotipos y colores por zona</p>
                  </div>
                </div>

                <div className="identity-admin-hero-grid" style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '16px', marginBottom: '18px' }}>
                  <div style={{ padding: '20px', borderRadius: '22px', background: 'linear-gradient(135deg, var(--navy), #31456f)', color: '#fff', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.7, marginBottom: '12px' }}>Vista de marca</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '62px', height: '62px', borderRadius: '18px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {branding.mainLogo ? <img src={branding.mainLogo} alt="Logo principal" style={{ width: '82%', height: '82%', objectFit: 'contain' }} /> : <span style={{ fontSize: '24px' }}>⛪</span>}
                      </div>
                      <div>
                        <div className="serif" style={{ fontSize: '1.4rem', lineHeight: 1.1 }}>PJL Admin</div>
                        <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '6px' }}>Panel premium de identidad visual institucional</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    <div style={{ padding: '16px', borderRadius: '18px', border: '1px solid var(--gold-pale)', background: '#fff' }}>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: '6px' }}>Activos visuales</div>
                      <div style={{ color: 'var(--navy)', fontSize: '28px', fontWeight: 900, lineHeight: 1 }}>{[branding.mainLogo, branding.whiteLogo, branding.favLogo, branding.zona1Logo, branding.zona2Logo, branding.zona3Logo, branding.zona4Logo].filter(Boolean).length}</div>
                    </div>
                    <div style={{ padding: '16px', borderRadius: '18px', border: '1px solid var(--gold-pale)', background: 'var(--cream)' }}>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: '6px' }}>Marca de agua</div>
                      <div style={{ color: 'var(--navy)', fontWeight: 800 }}>{branding.logoWatermark ? 'Activa en el sitio' : 'Desactivada'}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '15px' }}>
                  {/* MAIN LOGO CARD */}
                  <div style={{ padding: '20px', background: 'var(--cream)', borderRadius: '18px', border: '1px solid var(--gold-pale)', display: 'flex', gap: '20px', alignItems: 'center' }}>
                     <div style={{ width: '80px', height: '80px', background: '#fff', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 15px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.03)' }}>
                        {branding.mainLogo ? <img src={branding.mainLogo} style={{ width: '80%', height: '80%', objectFit: 'contain' }} alt="Logo" /> : <span style={{ fontSize: '30px', opacity: 0.2 }}>⛪</span>}
                     </div>
                     <div style={{ flex: 1 }}>
                        <p className="premium-label" style={{ marginBottom: '5px' }}>LOGO PRINCIPAL DEL SITIO</p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <label className="btn-premium btn-premium-gold" style={{ padding: '8px 16px', fontSize: '11px' }}>
                            CAMBIAR LOGO
                            <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileUpload(e, (url) => { setBranding({...branding, mainLogo: url}); showToast('Logo principal actualizado ✔'); })} />
                          </label>
                        </div>
                     </div>
                  </div>

                  {/* LOGO WATERMARK TOGGLE */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', background: 'var(--white)', borderRadius: '15px', border: '1px solid var(--gold-pale)' }}>
                    <div>
                      <p style={{ fontWeight: 700, color: 'var(--navy)', margin: 0, fontSize: '13px' }}>Marca de Agua del Logo</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Muestra el logo de fondo en todo el sitio</p>
                    </div>
                    <label className="pjl-switch">
                      <input type="checkbox" checked={!!branding.logoWatermark} onChange={(e) => setBranding({...branding, logoWatermark: e.target.checked})} />
                      <span className="pjl-slider"></span>
                    </label>
                  </div>

                  {/* EXTRA LOGOS (WHITE & FAVICON) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    {[
                      { key: 'whiteLogo', label: 'LOGO BLANCO', desc: 'Para fondos oscuros' },
                      { key: 'favLogo', label: 'FAVICON / SELLO', desc: 'Icono de pestaña' }
                    ].map(lg => (
                      <div key={lg.key} style={{ padding: '15px', background: 'var(--white)', borderRadius: '15px', border: '1px solid var(--gold-pale)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <p className="premium-label" style={{ fontSize: '10px', marginBottom: '0' }}>{lg.label}</p>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div style={{ width: '45px', height: '45px', background: lg.key === 'whiteLogo' ? 'var(--navy)' : 'var(--cream)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--gold-pale)', overflow: 'hidden' }}>
                            {branding[lg.key] ? <img src={branding[lg.key] as string} style={{ width: '80%', height: '80%', objectFit: 'contain' }} alt={lg.label} /> : <span style={{ fontSize: '18px', opacity: 0.2 }}>🖼️</span>}
                          </div>
                          <label className="btn-premium btn-premium-outline" style={{ padding: '6px 12px', fontSize: '9px', flex: 1, textAlign: 'center' }}>
                            SUBIR
                            <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileUpload(e, (url) => setBranding({...branding, [lg.key]: url}))} />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ZONES LOGOS & COLORS GRID */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    {[1, 2, 3, 4].map(z => (
                      <div key={z} style={{ padding: '18px', background: 'var(--white)', borderRadius: '15px', border: '1px solid var(--gold-pale)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <span className="premium-label" style={{ color: 'var(--navy)' }}>ZONA {z}</span>
                           <div style={{ position: 'relative', width: '30px', height: '30px', borderRadius: '8px', border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', background: branding[`zona${z}Color`] as string || '#C8973A' }}>
                              <input 
                                type="color" 
                                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} 
                                value={branding[`zona${z}Color`] as string || '#C8973A'} 
                                onChange={(e) => setBranding({...branding, [`zona${z}Color`]: e.target.value})} 
                              />
                           </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div style={{ width: '45px', height: '45px', background: 'var(--cream)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--gold-pale)', overflow: 'hidden' }}>
                            {branding[`zona${z}Logo`] ? <img src={branding[`zona${z}Logo`] as string} style={{ width: '80%', height: '80%', objectFit: 'contain' }} alt={`Logo Z${z}`} /> : <span style={{ fontSize: '20px', opacity: 0.2 }}>🛡️</span>}
                          </div>
                          <label className="btn-premium btn-premium-outline" style={{ padding: '6px 12px', fontSize: '10px', flex: 1, textAlign: 'center' }}>
                            SUBIR ESCUDO
                            <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileUpload(e, (url) => { setBranding({...branding, [`zona${z}Logo`]: url}); showToast(`Escudo Zona ${z} actualizado ✔`); })} />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}


          {/* CONTENIDO REORGANIZADO */}
          {mod === 'contenido' && (
            <div className="animate-reveal pjl-card" style={{ padding: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '2px solid var(--gold-pale)', paddingBottom: '15px' }}>
                <h3 className="serif">Gestión de Contenido</h3>
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
                    <h4 className="serif" style={{ marginBottom: '20px', color: 'var(--navy)' }}>📍 Información Principal</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '25px' }}>
                      <div className="form-group">
                        <label className="premium-label">TÍTULO INTRODUCTORIO</label>
                        <input className="pjl-input" value={content.instiTitulo || ''} onChange={e => setContent({ ...content, instiTitulo: e.target.value })} placeholder="Ej: Bienvenidos a la Pastoral" />
                      </div>
                      <div className="form-group">
                        <label className="premium-label">SUBTÍTULO / BREVE DESCRIPCIÓN</label>
                        <textarea className="pjl-input" rows={4} value={content.instiDesc || ''} onChange={e => setContent({ ...content, instiDesc: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="premium-label">FOTO DE PORTADA INSTITUCIONAL</label>
                        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', background: 'var(--cream)', padding: '20px', borderRadius: '15px' }}>
                          <div style={{ width: '150px', height: '100px', borderRadius: '12px', background: 'var(--white)', border: '2px solid var(--gold-pale)', overflow: 'hidden' }}>
                            {content.instiFoto && <img src={content.instiFoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          </div>
                          <div>
                            <p style={{ fontSize: '12px', marginBottom: '10px', opacity: 0.7 }}>Esta imagen aparece en la sección &quot;Sobre Nosotros&quot;.</p>
                            <label className="btn-premium btn-premium-gold" style={{ padding: '8px 20px', fontSize: '11px' }}>
                              SUBIR NUEVA IMAGEN
                              <input type="file" style={{ display: 'none' }} accept="image/*" onChange={e => handleFileUpload(e, url => setContent({...content, instiFoto: url}))} />
                            </label>
                          </div>
                        </div>
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
                    <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                      <div style={{ fontSize: '50px' }}>🗓️</div>
                      <div style={{ flex: 1 }}>
                        <h4 className="serif" style={{ color: 'var(--gold)', marginBottom: '15px', fontSize: '1.5rem' }}>Google Calendar</h4>
                        <p style={{ opacity: 0.8, marginBottom: '25px', lineHeight: '1.6' }}>
                          Integra tu calendario institucional para que los eventos se actualicen automáticamente en la web.
                          Solo necesitas copiar el enlace de <strong>Inserción (Embed URL)</strong> desde la configuración de tu Google Calendar.
                        </p>
                        <div className="form-group">
                          <label className="premium-label" style={{ color: 'var(--gold-pale)' }}>URL DE INSERCIÓN</label>
                          <input 
                            className="pjl-input" 
                            style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--gold)', padding: '15px' }}
                            value={content.googleCalendarUrl || ''} 
                            placeholder="https://calendar.google.com/calendar/embed?src=..."
                            onChange={e => setContent({ ...content, googleCalendarUrl: e.target.value })} 
                          />
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
          {mod === 'territorio' && (
            <div className="animate-reveal pjl-card" style={{ padding: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                  <h3 className="serif" style={{ fontSize: '2rem', color: 'var(--navy)', margin: 0 }}>Gestión de Territorio</h3>
                  <p className="premium-label" style={{ color: 'var(--gold)', marginTop: '5px' }}>DELIMITACIÓN DE ZONAS Y CALLES</p>
                </div>
                {!capturingZone && (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '300px', textAlign: 'right' }}>
                    Selecciona una zona para comenzar a dibujar sus límites en el mapa interactivo.
                  </p>
                )}
              </div>

              <div className="territory-editor-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '30px' }}>
                <div className="territory-map-shell" style={{ height: '600px', borderRadius: '25px', overflow: 'hidden', border: `3px solid ${capturingZone ? 'var(--gold)' : 'var(--gold-pale)'}`, position: 'relative', transition: 'border-color 0.3s ease', boxShadow: capturingZone ? '0 0 0 4px rgba(200,151,58,0.15)' : 'none' }}>
                  <ZonaMap 
                    selectedZone={capturingZone || 0}
                    showAllZones={capturingZone === null}
                    tempPolygon={tempPolygon}
                    scrollWheelZoom={true}
                    drawingMode={!!capturingZone}
                    hideFallbackPolygon={!!capturingZone && tempPolygon.length === 0 && !branding[`zona${capturingZone}Polygon`]}
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
                </div>

                <div className="territory-zone-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {[1, 2, 3, 4].map(num => (
                    <div key={num} style={{ 
                      padding: '20px', 
                      background: capturingZone === num ? 'var(--navy)' : 'var(--cream)', 
                      color: capturingZone === num ? '#fff' : 'var(--navy)',
                      borderRadius: '18px', 
                      border: `1px solid ${capturingZone === num ? 'var(--gold)' : 'var(--gold-pale)'}`,
                      transition: '0.3s ease'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 900 }}>ZONA {num}</h4>
                        <input 
                          type="color" 
                          value={branding[`zona${num}Color`] as string || '#C8973A'} 
                          onChange={e => setBranding({...branding, [`zona${num}Color`]: e.target.value})}
                          style={{ border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', background: 'transparent' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <button 
                          className={`btn-premium ${capturingZone === num ? 'btn-premium-gold' : 'btn-premium-outline'}`}
                          onClick={() => {
                            setCapturingZone(num);
                            setTempPolygon((branding[`zona${num}Polygon`] as [number, number][]) || []);
                          }}
                          style={{ width: '100%', fontSize: '12px' }}
                        >
                          {branding[`zona${num}Polygon`] ? '✏️ REDEFINIR LÍMITES' : '➕ DEFINIR LÍMITES'}
                        </button>
                        {branding[`zona${num}Polygon`] && (
                          <button 
                            className="btn-premium" 
                            style={{ width: '100%', fontSize: '11px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                            onClick={() => {
                              if(confirm('¿Eliminar límites de esta zona?')) {
                                setBranding({...branding, [`zona${num}Polygon`]: undefined});
                                showToast(`Límites de Zona ${num} eliminados`);
                                addLog('eliminar territorio', 'territorio', `Zona ${num}`);
                              }
                            }}
                          >🗑️ ELIMINAR POLÍGONO</button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: '20px', padding: '20px', background: 'var(--navy)', color: '#fff', borderRadius: '18px', border: '2px solid var(--gold)' }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: 'var(--gold)' }}>📌 Instrucciones</h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '11px', lineHeight: '1.8', opacity: 0.85 }}>
                      <li>Haz clic en <strong>DEFINIR LÍMITES</strong> para empezar.</li>
                      <li>Usa la <strong>rueda del mouse</strong> para acercarte.</li>
                      <li>Haz clic en el mapa para marcar cada vértice.</li>
                      <li>Usa <strong>↩ Deshacer</strong> si te equivocas.</li>
                      <li>Necesitas al menos <strong>3 puntos</strong> para guardar.</li>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                  <h3 className="serif" style={{ fontSize: '2rem', color: 'var(--navy)', margin: 0 }}>Historial de Actividad</h3>
                  <p className="premium-label" style={{ color: 'var(--gold)', marginTop: '5px' }}>REGISTRO DE ACCIONES ADMINISTRATIVAS</p>
                </div>
                <button className="btn-premium btn-premium-outline" onClick={() => {
                  if(confirm('¿Limpiar todo el historial?')) {
                    setLogs([]);
                    showToast('Historial limpiado');
                  }
                }}>LIMPIAR HISTORIAL</button>
              </div>

              <div className="pjl-table-container">
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
                        <td colSpan={5} style={{ textAlign: 'center', padding: '50px', opacity: 0.5 }}>No hay actividad registrada aún.</td>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h3 className="serif">Gestión de Noticias</h3>
                <button className="btn-premium btn-premium-gold" onClick={() => openNew('noticias')}>+ PUBLICAR NOTICIA</button>
              </div>
              <div className="news-admin-grid">
                <div style={{ display: 'grid', gap: '20px', alignContent: 'start' }}>
                  {news.map(n => (
                    <div key={n.id} style={{ display: 'flex', alignItems: 'center', padding: '20px 25px', background: 'var(--cream)', borderRadius: '15px', border: '1px solid var(--gold-pale)', gap: '20px', transition: 'all 0.3s ease', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }} className="hover-lift news-admin-card">
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--navy)', fontWeight: 800 }}>{n.title}</h4>
                          <span className="premium-label" style={{ fontSize: '0.7rem', padding: '4px 12px', background: n.published ? 'rgba(34,197,94,0.1)' : 'rgba(200,151,58,0.1)', color: n.published ? 'var(--green)' : 'var(--gold)', border: `1px solid ${n.published ? 'rgba(34,197,94,0.3)' : 'var(--gold-pale)'}` }}>
                            {n.published ? 'PUBLICADO' : 'BORRADOR'}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>📅 {n.date}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button onClick={() => openEdit('noticias', n)} className="btn-premium btn-premium-outline" style={{ padding: '8px 20px', fontSize: '0.8rem' }}>EDITAR</button>
                        <button onClick={() => deleteItem('news', n.id)} className="btn-premium" style={{ color: '#ef4444', padding: '8px 20px', fontSize: '0.8rem', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>ELIMINAR</button>
                      </div>
                    </div>
                  ))}
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

              <Script src="https://www.vaticannews.va/widget.js" strategy="lazyOnload" />
            </div>
          )}

          {/* CARRUSEL HERO */}
          {mod === 'carrusel' && (
            <div className="animate-reveal pjl-card" style={{ padding: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                  <h3 className="serif" style={{ margin: 0 }}>Administrador del Carrusel Hero</h3>
                  <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Las fotos, textos y segundos siguen siendo editables. El sitio ahora usa también la posición móvil y escritorio de cada slide.</p>
                </div>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
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
                    setLiveHeroImages([...liveHeroImages, { 
                      id: Date.now().toString(), imageUrl: '', title: '', subtitle: '', 
                      buttonText: '', buttonLink: '', mobilePosition: 'Centro (Default)', desktopPosition: 'Centro (Default)' 
                    }]);
                  }}>+ AGREGAR SLIDE</button>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '20px' }}>
                {liveHeroImages.map((slide, i) => (
                  <div key={slide.id} className="hero-slide-admin-card" style={{ display: 'flex', gap: '20px', padding: '20px', background: 'var(--cream)', borderRadius: '15px', border: '1px solid var(--gold-pale)' }}>
                    <div style={{ width: '150px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.9rem' }}>Slide #{i + 1}</div>
                      <div style={{ width: '100%', height: '100px', background: '#ddd', borderRadius: '10px', overflow: 'hidden' }}>
                        {slide.imageUrl ? <img src={slide.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Slide" /> : <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.8rem' }}>Sin Imagen</div>}
                      </div>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button disabled={i === 0} onClick={() => {
                          const newArr = [...liveHeroImages];
                          const temp = newArr[i];
                          newArr[i] = newArr[i - 1];
                          newArr[i - 1] = temp;
                          setLiveHeroImages(newArr);
                        }} className="btn-premium btn-premium-outline" style={{ padding: '5px', flex: 1 }}>↑</button>
                        <button disabled={i === liveHeroImages.length - 1} onClick={() => {
                          const newArr = [...liveHeroImages];
                          const temp = newArr[i];
                          newArr[i] = newArr[i + 1];
                          newArr[i + 1] = temp;
                          setLiveHeroImages(newArr);
                        }} className="btn-premium btn-premium-outline" style={{ padding: '5px', flex: 1 }}>↓</button>
                        <button onClick={() => {
                          if(confirm('¿Seguro que desea eliminar este slide?')) setLiveHeroImages(liveHeroImages.filter(s => s.id !== slide.id));
                        }} className="btn-premium" style={{ padding: '5px', background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', flex: 1 }}>🗑️</button>
                      </div>
                    </div>
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                          <label className="premium-label" style={{ fontSize: '0.7rem', marginBottom: '5px', display: 'block' }}>URL IMAGEN (Resolución recomendada 1920x1080)</label>
                          <input type="text" className="pjl-input" placeholder="https://" value={slide.imageUrl} onChange={e => setLiveHeroImages(liveHeroImages.map(s => s.id === slide.id ? {...s, imageUrl: e.target.value} : s))} />
                        </div>
                        <label className="btn-premium btn-premium-gold" style={{ cursor: 'pointer', padding: '12px 20px', whiteSpace: 'nowrap' }}>
                          Subir Foto
                          <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileUpload(e, (url) => setLiveHeroImages(liveHeroImages.map(s => s.id === slide.id ? {...s, imageUrl: url} : s)))} />
                        </label>
                      </div>
                      <div>
                        <label className="premium-label" style={{ fontSize: '0.7rem', marginBottom: '5px', display: 'block' }}>TÍTULO (Soporta HTML como &lt;i&gt;)</label>
                        <input type="text" className="pjl-input" value={slide.title} onChange={e => setLiveHeroImages(liveHeroImages.map(s => s.id === slide.id ? {...s, title: e.target.value} : s))} />
                      </div>
                      <div>
                        <label className="premium-label" style={{ fontSize: '0.7rem', marginBottom: '5px', display: 'block' }}>SUBTÍTULO</label>
                        <input type="text" className="pjl-input" value={slide.subtitle} onChange={e => setLiveHeroImages(liveHeroImages.map(s => s.id === slide.id ? {...s, subtitle: e.target.value} : s))} />
                      </div>
                      <div>
                        <label className="premium-label" style={{ fontSize: '0.7rem', marginBottom: '5px', display: 'block' }}>TEXTO BOTÓN</label>
                        <input type="text" className="pjl-input" placeholder="Dejar vacío para usar predeterminado" value={slide.buttonText} onChange={e => setLiveHeroImages(liveHeroImages.map(s => s.id === slide.id ? {...s, buttonText: e.target.value} : s))} />
                      </div>
                      <div>
                        <label className="premium-label" style={{ fontSize: '0.7rem', marginBottom: '5px', display: 'block' }}>LINK BOTÓN</label>
                        <input type="text" className="pjl-input" placeholder="ej. /noticias" value={slide.buttonLink} onChange={e => setLiveHeroImages(liveHeroImages.map(s => s.id === slide.id ? {...s, buttonLink: e.target.value} : s))} />
                      </div>
                      <div>
                        <label className="premium-label" style={{ fontSize: '0.7rem', marginBottom: '5px', display: 'block' }}>AJUSTE DE POSICIÓN IMAGEN (MÓVIL)</label>
                        <select className="pjl-input" value={slide.mobilePosition} onChange={e => setLiveHeroImages(liveHeroImages.map(s => s.id === slide.id ? {...s, mobilePosition: e.target.value} : s))}>
                          <option>Centro (Default)</option><option>Top</option><option>Bottom</option><option>Left</option><option>Right</option>
                        </select>
                      </div>
                      <div>
                        <label className="premium-label" style={{ fontSize: '0.7rem', marginBottom: '5px', display: 'block' }}>AJUSTE DE POSICIÓN IMAGEN (ESCRITORIO)</label>
                        <select className="pjl-input" value={slide.desktopPosition} onChange={e => setLiveHeroImages(liveHeroImages.map(s => s.id === slide.id ? {...s, desktopPosition: e.target.value} : s))}>
                          <option>Centro (Default)</option><option>Top</option><option>Bottom</option><option>Left</option><option>Right</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
                {liveHeroImages.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No hay slides configurados. Se mostrará una pantalla azul marino.</p>}
              </div>
            </div>
          )}

          {/* CAPILLAS */}
          {mod === 'capillas' && (
            <div className="animate-reveal pjl-card" style={{ padding: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
                <h3 className="serif" style={{ margin: 0 }}>Gestión de Capillas y Comunidades</h3>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="pjl-input"
                    placeholder="Buscar capilla o zona..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ minWidth: '250px' }}
                  />
                  <button className="btn-premium btn-premium-gold" onClick={() => openNew('capillas')}>+ REGISTRAR CAPILLA</button>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="pjl-table">
                  <thead><tr><th>CAPILLA</th><th>ZONA</th><th>COMUNIDAD</th><th>COORDENADAS</th><th>ESTADO</th><th>ACCIONES</th></tr></thead>
                  <tbody>
                    {chapels.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.zonaId.toString().includes(searchTerm)).map(c => (
                      <tr key={c.id}>
                        <td style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--cream)', border: '1px solid var(--gold-pale)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                            {c.logoUrl ? <img src={c.logoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={`Logo de la Capilla ${c.name}`} /> : '⛪'}
                          </div>
                          <span style={{ fontWeight: 700 }}>{c.name}</span>
                        </td>
                        <td>Zona {c.zonaId}</td>
                        <td>{c.comunidadNombre}</td>
                        <td>
                          <span style={{ fontSize: '10px', color: '#666' }}>
                            {c.lat ? `${c.lat.toFixed(4)}, ${c.lng?.toFixed(4)}` : 'Sin ubicar'}
                          </span>
                        </td>
                        <td>
                          <span className={`chapel-badge ${c.estadoComunidad === 'Activo' ? 'badge-active' : 'badge-nucleation'}`}>
                            {c.estadoComunidad}
                          </span>
                        </td>
                        <td>
                          <button onClick={() => openEdit('capillas', c)} className="btn-premium btn-premium-outline" style={{ padding: '5px 12px', fontSize: '0.65rem', marginRight: '5px' }}>EDITAR</button>
                          <button onClick={() => setChapels(chapels.filter(ch => ch.id !== c.id))} className="btn-premium" style={{ color: '#ef4444' }}>ELIMINAR</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '40px', padding: '30px', background: 'var(--cream)', borderRadius: '20px', border: '1px solid var(--gold-pale)' }}>
                <h4 className="serif" style={{ marginBottom: '15px', color: 'var(--navy)' }}>Mapa de Capillas</h4>
                <div style={{ width: '100%', height: '400px', borderRadius: '15px', overflow: 'hidden', border: '2px solid var(--gold-pale)' }}>
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
            </div>
          )}
          {/* ACTIVIDADES */}
          {mod === 'actividades' && (
            <div className="animate-reveal pjl-card" style={{ padding: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
                <div>
                  <h3 className="serif" style={{ margin: 0, color: 'var(--navy)' }}>Agenda Pastoral</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Administra eventos, retiros y asambleas</p>
                </div>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['Todos', 'Formación', 'Liturgia', 'Organización', 'Social'].map(cat => (
                      <button 
                        key={cat} 
                        onClick={() => setSearchTerm(cat === 'Todos' ? '' : cat)} 
                        className={`btn-premium ${searchTerm === cat ? 'btn-premium-gold' : 'btn-premium-outline'}`}
                        style={{ padding: '6px 12px', fontSize: '10px' }}
                      >
                        {cat.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <button className="btn-premium btn-premium-gold" onClick={() => openNew('actividades')}>+ AGREGAR ACTIVIDAD</button>
                </div>
              </div>
              
              {content.googleCalendarUrl && (
                <div style={{ marginBottom: '30px', borderRadius: '20px', overflow: 'hidden', border: '2px solid var(--gold-pale)', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                  <div style={{ padding: '12px 20px', background: 'var(--navy)', color: '#fff', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span>🗓️</span> VISTA PREVIA DE GOOGLE CALENDAR
                    </div>
                    <span style={{ fontSize: '9px', opacity: 0.7 }}>{content.googleCalendarUrl}</span>
                  </div>
                  <iframe 
                    src={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(content.googleCalendarUrl)}&ctz=America/Asuncion&showTitle=0&showNav=1&showPrint=0&showTabs=1&showCalendars=0&showTz=0`} 
                    style={{ border: 0 }} 
                    width="100%" 
                    height="500" 
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
                    {activities.filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()) || a.category.toLowerCase().includes(searchTerm.toLowerCase())).map(a => (
                      <tr key={a.id}>
                        <td>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: a.active ? '#10B981' : '#EF4444', display: 'inline-block', marginRight: '8px' }} />
                          <span style={{ fontSize: '10px', fontWeight: 600, color: a.active ? '#10B981' : '#EF4444' }}>{a.active ? 'ACTIVO' : 'PASADO'}</span>
                        </td>
                        <td style={{ fontWeight: 800, color: 'var(--navy)' }}>{a.title}</td>
                        <td>{a.date}</td>
                        <td><span className="premium-label" style={{ fontSize: '10px', background: 'var(--gold-pale)', color: 'var(--navy)' }}>{a.category}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => openEdit('actividades', a)} className="btn-premium btn-premium-outline" style={{ padding: '6px 12px', fontSize: '10px' }}>EDITAR</button>
                            <button onClick={() => deleteItem('activities', a.id)} className="btn-premium" style={{ color: '#EF4444', padding: '6px 12px', fontSize: '10px', border: '1px solid #EF4444' }}>BORRAR</button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
              </div>
            </div>
          )}

          {/* PERFILES */}
          {mod === 'perfiles' && (
            <div className="animate-reveal pjl-card" style={{ padding: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h3 className="serif" style={{ margin: 0 }}>Gestión de Currículos y Perfiles</h3>
                <button 
                  className="btn-premium btn-premium-gold" 
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
                  + AGREGAR MIEMBRO A ESTE EQUIPO
                </button>
              </div>
              <div className="custom-scrollbar" style={{ display: 'flex', gap: '12px', marginBottom: '40px', overflowX: 'auto', padding: '15px', borderRadius: '20px', border: '1px solid var(--gold-pale)', background: 'linear-gradient(to right, var(--cream), white)', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.02)' }}>
                {['coordinacion', 'efo', 'ecomu', 'eli', 'mmpjl', 'zona1', 'zona2', 'zona3', 'zona4'].map(tk => (
                  <button 
                    key={tk} 
                    onClick={() => setActiveProfileTeam(tk)} 
                    className={`btn-premium ${activeProfileTeam === tk ? 'btn-premium-gold' : ''}`} 
                    style={{ 
                      fontSize: '0.85rem', 
                      whiteSpace: 'nowrap', 
                      padding: '10px 24px', 
                      borderRadius: '30px',
                      background: activeProfileTeam === tk ? 'var(--gold)' : 'transparent',
                      color: activeProfileTeam === tk ? 'var(--navy)' : 'var(--navy)',
                      border: activeProfileTeam === tk ? 'none' : '1px solid var(--gold-pale)',
                      fontWeight: activeProfileTeam === tk ? 800 : 600,
                      boxShadow: activeProfileTeam === tk ? '0 4px 15px rgba(200,151,58,0.3)' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {tk.toUpperCase()}
                  </button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '25px' }}>
                {profiles.filter(p => p.teamKey === activeProfileTeam).map(p => (
            <div key={p.id} className="pjl-card" style={{ display: 'flex', gap: '25px', padding: '30px', position: 'relative' }}>
                    <button 
                      onClick={() => {
                        if (confirm(`¿Seguro que deseas eliminar a ${p.name}?`)) {
                          setProfiles(profiles.filter(x => x.id !== p.id));
                          showToast('Miembro eliminado ✖');
                        }
                      }}
                      style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: '0.2s' }}
                    >
                      Eliminar
                    </button>
                    <div style={{ position: 'relative', width: '120px', height: '120px', flexShrink: 0 }}>
                      <div style={{ width: '100%', height: '100%', borderRadius: '20px', overflow: 'hidden', border: '4px solid var(--gold-pale)', background: '#fff' }}>
                        {p.photo ? <img src={p.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={p.name} /> : <div style={{ fontSize: '40px', padding: '20px' }}>👤</div>}
                      </div>
                      <label style={{ position: 'absolute', bottom: '-5px', right: '-5px', background: 'var(--gold)', color: 'var(--navy)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                        📷
                        <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileUpload(e, (url) => { setProfiles(profiles.map(x => x.id === p.id ? {...x, photo: url} : x)); showToast('Foto guardada ✔'); })} />
                      </label>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ marginBottom: '15px', paddingRight: '40px' }}>
                        <input className="pjl-input" style={{ fontWeight: 800, border: 'none', background: 'transparent', padding: 0, fontSize: '1.1rem', height: 'auto', marginBottom: '4px' }} value={p.name} onChange={e => setProfiles(profiles.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))} placeholder="Nombre del Miembro" />
                        <input className="pjl-input" style={{ fontSize: '0.8rem', color: 'var(--navy)', border: 'none', background: 'transparent', padding: 0, height: 'auto', fontWeight: 600 }} value={p.role} onChange={e => setProfiles(profiles.map(x => x.id === p.id ? { ...x, role: e.target.value } : x))} placeholder="Rol o Cargo" />
                      </div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Historial Pastoral (Bio)</label>
                      <textarea className="pjl-input" style={{ fontSize: '0.8rem', minHeight: '70px', marginBottom: '12px', background: 'var(--cream)', border: '1px solid var(--gold-pale)', resize: 'vertical' }} value={p.bio} onChange={e => setProfiles(profiles.map(x => x.id === p.id ? { ...x, bio: e.target.value } : x))} />
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Currículum Pastoral (PDF)</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <label className="btn-premium btn-premium-gold" style={{ padding: '7px 16px', fontSize: '0.65rem', cursor: 'pointer' }}>
                          📄 SUBIR CV
                          <input type="file" style={{ display: 'none' }} accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => handleFileUpload(e, (url) => { setProfiles(profiles.map(x => x.id === p.id ? {...x, cvUrl: url} : x)); showToast('CV guardado ✔'); })} />
                        </label>
                        {p.cvUrl && (
                          <span style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            ✓ CV cargado
                            <button onClick={() => setProfiles(profiles.map(x => x.id === p.id ? {...x, cvUrl: ''} : x))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', padding: 0 }}>×</button>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* USUARIOS */}
          {mod === 'usuarios' && (
            <div className="animate-reveal pjl-card" style={{ padding: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <h3 className="serif" style={{ margin: 0 }}>Gestión de Acceso</h3>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
                    <input 
                      type="text" 
                      placeholder="Buscar usuario..." 
                      className="pjl-input" 
                      style={{ paddingLeft: '35px', width: '250px', height: '40px' }}
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <button className="btn-premium btn-premium-gold" onClick={() => {
                  setForm({ email: '', name: '', role: 'editor', permissions: ['dashboard'] });
                  setModal('usuarios');
                }}>+ NUEVO USUARIO</button>
              </div>
              {currentUser?.role === 'desarrollador' && (
                <div className="pjl-card" style={{ padding: '24px', marginBottom: '24px', background: '#fdf7e8', border: '1px dashed #f3ce66' }}>
                  <h4 className="serif" style={{ margin: '0 0 12px', color: 'var(--navy)' }}>Solicitudes pendientes</h4>
                  {pendingProfiles.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '13px', color: '#555' }}>No hay cuentas pendientes de aprobación.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {pendingProfiles.map(profile => (
                        <div key={profile.id} style={{ padding: '14px', borderRadius: '14px', background: '#fff', border: '1px solid #f1d77b' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <div>
                              <strong>{profile.name}</strong> <span style={{ color: '#666', fontSize: '12px' }}>{profile.email}</span>
                              <div style={{ fontSize: '11px', color: '#777', marginTop: '4px' }}>Registrado el {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}</div>
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
                                Aprobar cuenta
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '30px' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="pjl-table">
                    <thead><tr><th>NOMBRE</th><th>EMAIL (USUARIO)</th><th>ROL</th><th>ESTADO</th><th>ÚLT. ACCESO</th><th>ACCIONES</th></tr></thead>
                    <tbody>
                      {allUsers.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 800 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 900 }}>
                                {u.name[0]}
                              </div>
                              {u.name}
                            </div>
                          </td>
                          <td><code>{u.email}</code></td>
                          <td><span className={`premium-label ${u.role === 'desarrollador' ? 'badge-active' : ''}`}>{u.role.toUpperCase()}</span></td>
                          <td>
                            <span style={{ 
                              padding: '4px 8px', 
                              borderRadius: '4px', 
                              fontSize: '10px', 
                              fontWeight: 700,
                              background: u.status === 'activo' ? '#dcfce7' : '#fee2e2',
                              color: u.status === 'activo' ? '#166534' : '#991b1b'
                            }}>
                              {u.status?.toUpperCase() || 'ACTIVO'}
                            </span>
                          </td>
                          <td style={{ fontSize: '11px', color: '#666' }}>{u.lastActive ? new Date(u.lastActive).toLocaleString() : '-'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '5px' }}>
                              <button onClick={() => openEdit('usuarios', u)} className="btn-premium btn-premium-outline" style={{ padding: '5px 12px', fontSize: '0.65rem' }}>EDITAR</button>
                              <button onClick={() => void deleteItem('users', u.id)} className="btn-premium" style={{ color: '#ef4444', padding: '5px 12px', fontSize: '0.65rem', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>ELIMINAR</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ROLE PERMISSIONS INFO */}
                <div className="pjl-card" style={{ padding: '25px', background: 'var(--cream)', border: '1px solid var(--gold-pale)' }}>
                  <h4 className="serif" style={{ color: 'var(--navy)', marginBottom: '15px', borderBottom: '1px solid var(--gold-pale)', paddingBottom: '10px' }}>Permisos por Rol</h4>
                  <div style={{ display: 'grid', gap: '15px' }}>
                    <div style={{ padding: '12px', background: '#fff', borderRadius: '10px', border: '1px solid var(--gold-pale)' }}>
                      <p style={{ fontWeight: 800, color: 'var(--navy)', fontSize: '12px', margin: '0 0 5px' }}>SUPERADMIN</p>
                      <p style={{ fontSize: '11px', color: '#666', margin: 0 }}>Acceso total. Puede gestionar usuarios, configuración del sistema y branding.</p>
                    </div>
                    <div style={{ padding: '12px', background: '#fff', borderRadius: '10px', border: '1px solid var(--gold-pale)' }}>
                      <p style={{ fontWeight: 800, color: 'var(--gold)', fontSize: '12px', margin: '0 0 5px' }}>EDITOR</p>
                      <p style={{ fontSize: '11px', color: '#666', margin: 0 }}>Puede crear y editar noticias, actividades, capillas y contenido general.</p>
                    </div>
                    <div style={{ padding: '12px', background: '#fff', borderRadius: '10px', border: '1px solid var(--gold-pale)' }}>
                      <p style={{ fontWeight: 800, color: '#999', fontSize: '12px', margin: '0 0 5px' }}>VIEWER</p>
                      <p style={{ fontSize: '11px', color: '#666', margin: 0 }}>Acceso de solo lectura. Puede ver estadísticas y listados sin modificar datos.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CONFIGURACIÓN */}
          {mod === 'configuracion' && (
            <div className="animate-reveal" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              
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
                      <label className="premium-label">ID DE GOOGLE CALENDAR</label>
                      <input 
                        className="pjl-input" 
                        value={content.googleCalendarUrl || ''} 
                        onChange={e => setContent({...content, googleCalendarUrl: e.target.value})} 
                        placeholder="ej: tu-email@gmail.com"
                      />
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '5px' }}>Necesario para mostrar el calendario en la agenda.</p>
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
          )}

        </div>
      </main>

      {/* MODALS */}
      {modal && (
        <div className="glass-modal-overlay" onClick={closeModal}>
          <div className="pjl-card animate-reveal modal-responsive-card" style={{ maxWidth: '600px', width: '100%', padding: '50px' }} onClick={e => e.stopPropagation()}>
            <h3 className="serif" style={{ marginBottom: '30px' }}>Editar / Crear Elemento</h3>

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
                      {form.logoUrl ? <img src={form.logoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Previsualización de Logo" /> : '⛪'}
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
                    <input type="number" step="any" className="pjl-input" value={form.lat || ''} onChange={e => setForm({...form, lat: parseFloat(e.target.value)})} placeholder="-25.2688" />
                  </div>
                  <div className="form-group">
                    <label className="premium-label">LONGITUD</label>
                    <input type="number" step="any" className="pjl-input" value={form.lng || ''} onChange={e => setForm({...form, lng: parseFloat(e.target.value)})} placeholder="-57.4754" />
                  </div>
                </div>
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
                      {NAV_ITEMS.filter(n => !['usuarios', 'configuracion'].includes(n.id)).map(n => (
                        <label key={n.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: '#fff', padding: '10px', borderRadius: '10px', border: '1px solid #eee', transition: '0.2s' }} className="hover-lift">
                          <input 
                            type="checkbox" 
                            style={{ accentColor: 'var(--gold)' }}
                            checked={(form.permissions || []).includes(n.id)} 
                            onChange={e => {
                              const perms = form.permissions || [];
                              if (e.target.checked) setForm({...form, permissions: [...perms, n.id]});
                              else setForm({...form, permissions: perms.filter((p: string) => p !== n.id)});
                            }}
                          />
                          <span>{n.icon} {n.label}</span>
                        </label>
                      ))}
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
