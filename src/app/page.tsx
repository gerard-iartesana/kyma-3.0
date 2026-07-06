'use client';

import React, { useState, useEffect } from 'react';
import { dbClient, KymaItem, getDbState, setDbState } from '../lib/db/client';
import { DOOR_MODULES, DoorModule } from '../lib/modules';
import { LogoFull, LogoIcon } from '../components/Logo';
import { ItemCard } from '../components/ItemCard';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { OrbitsView } from '../components/OrbitsView';
import { InterestsMapView } from '../components/InterestsMapView';
import { CalendarView } from '../components/CalendarView';
import { EstelaTimelineView } from '../components/EstelaTimelineView';
import { EstelaHorizontalTimelineView } from '../components/EstelaHorizontalTimelineView';
import { KymaChat } from '../components/KymaChat';
import { usePWA } from '../components/PWAProvider';
import * as Icons from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

export default function Home() {
  const { isOnline, isInstallable, promptInstall, updateAvailable, applyUpdate, showIOSHint, dismissIOSHint } = usePWA();
  const [user, setUser] = useState<User | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    nombre: string;
    edad: string;
    lugarResidencia: string;
    idioma: string;
    autoApprove: boolean;
  }>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kyma_user_profile');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return {
            nombre: parsed.nombre || '',
            edad: parsed.edad || '',
            lugarResidencia: parsed.lugarResidencia || '',
            idioma: parsed.idioma || 'Español',
            autoApprove: parsed.autoApprove ?? false
          };
        } catch (e) {}
      }
    }
    return {
      nombre: '',
      edad: '',
      lugarResidencia: '',
      idioma: 'Español',
      autoApprove: false
    };
  });

  const [trustLogs, setTrustLogs] = useState<Array<{ timestamp: string; action: 'confirm' | 'discard' }>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kyma_trust_logs');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return [];
  });

  const recordTrustAction = (action: 'confirm' | 'discard') => {
    const newLog = { timestamp: new Date().toISOString(), action };
    setTrustLogs(prev => {
      const next = [...prev, newLog];
      if (typeof window !== 'undefined') {
        localStorage.setItem('kyma_trust_logs', JSON.stringify(next));
      }
      return next;
    });
  };

  const handleUpdateUserProfile = (updates: Partial<typeof userProfile>) => {
    setUserProfile(prev => {
      const next = { ...prev, ...updates };
      if (typeof window !== 'undefined') {
        localStorage.setItem('kyma_user_profile', JSON.stringify(next));
      }
      return next;
    });
  };

  const [isMounted, setIsMounted] = useState(false);
  const [dbState, setLocalDbState] = useState<'populated' | 'empty'>('populated');

  // Google Calendar Integration States
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<any[]>([]);
  const [loadingGoogleEvents, setLoadingGoogleEvents] = useState(false);
  const [googleCalendars, setGoogleCalendars] = useState<any[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [loadingGoogleCalendars, setLoadingGoogleCalendars] = useState(false);
  const [googleEnvStatus, setGoogleEnvStatus] = useState<{ hasClientId: boolean; hasClientSecret: boolean } | null>(null);
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null);
  const [items, setItems] = useState<KymaItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<KymaItem | null>(null);
  const [chatContextItem, setChatContextItem] = useState<KymaItem | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Mobile navigation state ('chat' | 'panel')
  const [mobileTab, setMobileTab] = useState<'chat' | 'panel'>('panel');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // View mode & Sort mode for Personas ('orbits' | 'grid') and ('recientes' | 'cercania')
  const [personasViewMode, setPersonasViewMode] = useState<'orbits' | 'grid'>('grid');
  const [personasSortMode, setPersonasSortMode] = useState<'recientes' | 'cercania'>('recientes');

  // View mode for Agenda ('calendar' | 'grid')
  const [agendaViewMode, setAgendaViewMode] = useState<'calendar' | 'grid'>('grid');

  // View mode for Intereses ('orbits' | 'grid')
  const [interesesViewMode, setInteresesViewMode] = useState<'orbits' | 'grid'>('grid');
  const [interesesSortMode, setInteresesSortMode] = useState<'recientes' | 'destacados'>('recientes');

  // Sort mode for Reflexiones
  const [reflexionesSortMode, setReflexionesSortMode] = useState<'recientes' | 'destacados'>('recientes');

  // View mode for Estela de vida ('grid' | 'timeline')
  const [estelaViewMode, setEstelaViewMode] = useState<'grid' | 'timeline'>('grid');

  // Sort direction for Estela de vida
  const [estelaSortAsc, setEstelaSortAsc] = useState(true);

  // Timeline scale for Estela de vida (60 = Compact, 120 = Medium, 200 = Spacious)
  const [estelaTimelineScale, setEstelaTimelineScale] = useState<number>(60);

  // Orbits view settings for Vínculos (personas)
  const [personasOrbitsScale, setPersonasOrbitsScale] = useState<number>(1.0);
  const [personasShowNucleo, setPersonasShowNucleo] = useState<boolean>(true);
  const [personasShowCercana, setPersonasShowCercana] = useState<boolean>(true);
  const [personasShowOrbita, setPersonasShowOrbita] = useState<boolean>(true);

  // Tag filtering state
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [undoToast, setUndoToast] = useState<{ show: boolean; title?: string } | null>(null);

  // Search state for Búsqueda global
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDoorFilter, setSearchDoorFilter] = useState<string | null>(null);

  // Chat view state ('normal' | 'expanded' | 'hidden')
  const [chatState, setChatState] = useState<'normal' | 'expanded' | 'hidden'>('normal');

  // Compact view state for list cards
  const [isCompactView, setIsCompactView] = useState(false);

  // Dashboard sort tab state ('novedades' | 'destacados')
  const [dashboardSort, setDashboardSort] = useState<'novedades' | 'destacados'>('novedades');
  const [dashboardExpanded, setDashboardExpanded] = useState(true);

  // Quick-creation forms states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newPeso, setNewPeso] = useState<1 | 2 | 3>(1);
  const [newCercania, setNewCercania] = useState<'nucleo' | 'cercana' | 'orbita'>('orbita');
  const [newRecurrencia, setNewRecurrencia] = useState<'none' | 'semanal' | 'mensual' | 'anual'>('none');
  const [showPastAgendaEvents, setShowPastAgendaEvents] = useState(false);
  const [showAllCompletedTasks, setShowAllCompletedTasks] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [configLoaded, setConfigLoaded] = useState(false);

  // Toast Notification state
  const [toastNotification, setToastNotification] = useState<{
    show: boolean;
    message: string;
    doorId: string;
    item?: KymaItem;
  } | null>(null);

  // Dynamic time and visibility synchronization to keep calendar/agenda items up-to-date
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date());
    };

    const interval = setInterval(updateTime, 30000); // 30 seconds

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        updateTime();
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error || !session) {
            console.warn('Session expired or invalid on wake-up. Resetting auth.');
            setUser(null);
          } else {
            setUser(session.user);
            refreshItems();
          }
        } catch (e) {
          console.error('Failed to verify session on wake-up:', e);
          refreshItems();
        }
      }
    };

    window.addEventListener('focus', updateTime);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', updateTime);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Load database state and session on mount, and sync offline queue
  useEffect(() => {
    if (isOnline) {
      dbClient.syncOfflineQueue().then(() => refreshItems());
    }
  }, [isOnline]);

  useEffect(() => {
    // 1. Get initial session safely
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        try {
          setUser(session?.user ?? null);
          if (session?.user) {
            const config = await dbClient.getUserConfig();
            if (config) {
              if (config.perfil) {
                setUserProfile(config.perfil);
                localStorage.setItem('kyma_user_profile', JSON.stringify(config.perfil));
              }
              if (config.logs) {
                setTrustLogs(config.logs);
                localStorage.setItem('kyma_trust_logs', JSON.stringify(config.logs));
              }
              if (config.googleCalendar && config.googleCalendar.connected) {
                setGoogleCalendarConnected(true);
                setSelectedCalendarIds(config.googleCalendar.selectedCalendars || []);
              }
            }
            setConfigLoaded(true);
          }
          refreshItems();
        } catch (err) {
          console.warn('Error loading initial session config:', err);
        } finally {
          setLoadingSession(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to get initial auth session:', err);
        setLoadingSession(false);
      });

    // 2. Set auth listener safely
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        setUser(session?.user ?? null);
        if (session?.user) {
          const config = await dbClient.getUserConfig();
          if (config) {
            if (config.perfil) {
              setUserProfile(config.perfil);
              localStorage.setItem('kyma_user_profile', JSON.stringify(config.perfil));
            }
            if (config.logs) {
              setTrustLogs(config.logs);
              localStorage.setItem('kyma_trust_logs', JSON.stringify(config.logs));
            }
            if (config.googleCalendar && config.googleCalendar.connected) {
              setGoogleCalendarConnected(true);
              setSelectedCalendarIds(config.googleCalendar.selectedCalendars || []);
            }
          }
          setConfigLoaded(true);
          refreshItems();
        } else {
          setItems([]);
          setConfigLoaded(false);
          setGoogleCalendarConnected(false);
          setGoogleEvents([]);
        }
      } catch (err) {
        console.warn('Error in auth state change handler:', err);
      } finally {
        setLoadingSession(false);
      }
    });

    setLocalDbState(getDbState());

    const handleProfileEvent = (e: any) => {
      if (e.detail) {
        setUserProfile(e.detail);
      }
    };
    const handleSyncError = (e: any) => {
      if (e.detail) {
        setToastNotification({
          show: true,
          message: `Error de Google Calendar: ${e.detail}`,
          doorId: 'agenda'
        });
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('kyma_user_profile_updated', handleProfileEvent);
      window.addEventListener('kyma_calendar_sync_error', handleSyncError);
    }

    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 800);

    // 3. Timeout de seguridad: Forzar visualización tras 5 segundos en caso de bloqueos de red o Supabase
    const safetyTimer = setTimeout(() => {
      setLoadingSession((prev) => {
        if (prev) {
          console.warn('Safety timeout reached for initial session. Forcing UI display.');
          return false;
        }
        return prev;
      });
      setIsMounted(true);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('kyma_user_profile_updated', handleProfileEvent);
        window.removeEventListener('kyma_calendar_sync_error', handleSyncError);
      }
      clearTimeout(timer);
      clearTimeout(safetyTimer);
    };
  }, []);

  // Synchronize profile and trust logs to Supabase whenever they change
  useEffect(() => {
    if (user && configLoaded) {
      dbClient.saveUserConfig(userProfile, trustLogs);
    }
  }, [userProfile, trustLogs, user, configLoaded]);

  // Load Google Calendar Events
  const fetchGoogleEvents = async (token: string) => {
    setLoadingGoogleEvents(true);
    try {
      const res = await fetch('/api/calendar/events', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          setGoogleEvents(data.events || []);
          setGoogleCalendarConnected(true);
        } else {
          setGoogleCalendarConnected(false);
        }
      }
    } catch (err) {
      console.error('Error fetching Google events:', err);
    } finally {
      setLoadingGoogleEvents(false);
    }
  };

  // Load Google Calendar List
  const fetchGoogleCalendars = async (token: string) => {
    setLoadingGoogleCalendars(true);
    try {
      const res = await fetch('/api/calendar/list', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          setGoogleCalendars(data.calendars || []);
          setGoogleCalendarConnected(true);
        } else {
          setGoogleCalendarConnected(false);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setToastNotification({
          show: true,
          message: `Error al cargar tus calendarios: ${errData.error || res.statusText}`,
          doorId: 'configuracion'
        });
      }
    } catch (err: any) {
      console.error('Error fetching Google calendars:', err);
      setToastNotification({
        show: true,
        message: `Error de conexión al cargar calendarios: ${err.message}`,
        doorId: 'configuracion'
      });
    } finally {
      setLoadingGoogleCalendars(false);
    }
  };

  // Toggle calendar selection and sync with Supabase config
  const handleToggleCalendar = async (calendarId: string) => {
    if (!user) return;

    let newSelectedIds = [...selectedCalendarIds];
    
    // Initialize if empty using the primary calendar id
    if (newSelectedIds.length === 0 && googleCalendars.length > 0) {
      const primaryCal = googleCalendars.find(c => c.primary);
      if (primaryCal) {
        newSelectedIds = [primaryCal.id];
      }
    }

    if (newSelectedIds.includes(calendarId)) {
      newSelectedIds = newSelectedIds.filter(id => id !== calendarId);
    } else {
      newSelectedIds.push(calendarId);
    }

    setSelectedCalendarIds(newSelectedIds);

    try {
      const config = await dbClient.getUserConfig();
      const currentPerfil = config?.perfil || userProfile;
      const currentLogs = config?.logs || trustLogs;
      const currentGoogleCalendar = config?.googleCalendar || {};

      const datos = {
        is_system_config: true,
        perfil: currentPerfil,
        logs: currentLogs,
        googleCalendar: {
          ...currentGoogleCalendar,
          selectedCalendars: newSelectedIds
        }
      };

      const { data: existing } = await supabase
        .from('elementos')
        .select('id')
        .eq('user_id', user.id)
        .eq('tipo', 'nota')
        .eq('titulo', 'kyma_system_user_configuration');

      if (existing && existing.length > 0) {
        await supabase
          .from('elementos')
          .update({ datos, updated_at: new Date().toISOString() })
          .eq('id', existing[0].id);
      }

      // Refresh events immediately
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      if (token) {
        await fetchGoogleEvents(token);
      }
    } catch (e) {
      console.error('Error toggling calendar selection:', e);
    }
  };

  // Load Google calendars list automatically when connected
  useEffect(() => {
    if (user && googleCalendarConnected) {
      (async () => {
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token;
        if (token) {
          await fetchGoogleCalendars(token);
        }
      })();
    }
  }, [user, googleCalendarConnected]);

  // Check Google environment configuration status on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/calendar/config-check');
        if (res.ok) {
          const data = await res.json();
          setGoogleEnvStatus(data);
        }
      } catch (e) {
        console.error('Error checking Google env status:', e);
      }
    })();
  }, [googleCalendarConnected]);

  // Process Google Calendar temp connection after redirect callback
  useEffect(() => {
    if (typeof window !== 'undefined' && user && configLoaded) {
      const urlParams = new URLSearchParams(window.location.search);
      const isGoogleCallback = urlParams.get('google_callback') === 'success';
      const calendarError = urlParams.get('calendar_error');

      if (calendarError) {
        // Clean up URL parameters immediately
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);

        setToastNotification({
          show: true,
          message: `Error al conectar Google Calendar: ${decodeURIComponent(calendarError)}`,
          doorId: 'configuracion'
        });
        return;
      }

      if (isGoogleCallback) {
        const accessToken = urlParams.get('access_token');
        const refreshToken = urlParams.get('refresh_token');
        const expiresIn = urlParams.get('expires_in');

        // Clean up the URL parameters immediately for security
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);

        if (accessToken) {
          const calendarData = {
            connected: true,
            accessToken,
            refreshToken: refreshToken || undefined,
            tokenExpiry: new Date(Date.now() + (parseInt(expiresIn || '3600') * 1000)).toISOString(),
            selectedCalendars: []
          };

          (async () => {
            try {
              const config = await dbClient.getUserConfig();
              const currentPerfil = config?.perfil || userProfile;
              const currentLogs = config?.logs || trustLogs;

              await dbClient.saveUserConfig(currentPerfil, currentLogs, calendarData);

              setGoogleCalendarConnected(true);
              setToastNotification({
                show: true,
                message: 'Google Calendar conectado con éxito.',
                doorId: 'configuracion'
              });

              const sessionRes = await supabase.auth.getSession();
              const token = sessionRes.data.session?.access_token;
              if (token) {
                await fetchGoogleEvents(token);
              }
            } catch (e) {
              console.error('Error saving Google Calendar config from callback:', e);
            }
          })();
        }
      }
    }
  }, [user, configLoaded]);

  // Fetch Google Calendar events when selecting Agenda tab
  useEffect(() => {
    if (selectedDoorId === 'agenda' && user && googleCalendarConnected) {
      (async () => {
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token;
        if (token) {
          await fetchGoogleEvents(token);
        }
      })();
    }
  }, [selectedDoorId, user, googleCalendarConnected]);

  const handleConnectGoogleCalendar = async () => {
    if (!user) return;
    window.location.href = `/api/calendar/auth?userId=${user.id}`;
  };

  const handleDisconnectGoogleCalendar = async () => {
    try {
      const config = await dbClient.getUserConfig();
      const currentPerfil = config?.perfil || userProfile;
      const currentLogs = config?.logs || trustLogs;

      const datos = {
        is_system_config: true,
        perfil: currentPerfil,
        logs: currentLogs,
        googleCalendar: {
          connected: false
        }
      };

      if (user) {
        const { data: existing } = await supabase
          .from('elementos')
          .select('id')
          .eq('user_id', user.id)
          .eq('tipo', 'nota')
          .eq('titulo', 'kyma_system_user_configuration');

        if (existing && existing.length > 0) {
          await supabase
            .from('elementos')
            .update({ datos, updated_at: new Date().toISOString() })
            .eq('id', existing[0].id);
        }
      }

      setGoogleCalendarConnected(false);
      setGoogleEvents([]);
      setGoogleCalendars([]);
      setSelectedCalendarIds([]);
      setToastNotification({
        show: true,
        message: 'Google Calendar desconectado.',
        doorId: 'agenda'
      });
    } catch (e) {
      console.error('Error disconnecting calendar:', e);
    }
  };

  useEffect(() => {
    if (undoToast && undoToast.show) {
      const timer = setTimeout(() => {
        setUndoToast(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [undoToast]);

  const refreshItems = async () => {
    try {
      const dbItems = await dbClient.getItems();
      setItems(dbItems);
    } catch (e) {
      console.error('Error loading items from Supabase:', e);
    }
  };

  useEffect(() => {
    if (userProfile.autoApprove && items.length > 0) {
      const tentativeItems = items.filter(i => i.origen === 'kyma_sugerido');
      if (tentativeItems.length > 0) {
        Promise.all(tentativeItems.map(item => dbClient.confirmItem(item.id)))
          .then(() => refreshItems())
          .catch(err => console.error('Error auto-approving items:', err));
      }
    }
  }, [items, userProfile.autoApprove]);

  const handleItemAddedOrModified = async (item?: KymaItem, action?: string) => {
    if (item) {
      try {
        const cached = localStorage.getItem('kyma_cached_items');
        if (cached) {
          const itemsList: KymaItem[] = JSON.parse(cached);
          const filtered = itemsList.filter(i => i.id !== item.id);
          if (action !== 'delete') {
            filtered.unshift(item);
          }
          localStorage.setItem('kyma_cached_items', JSON.stringify(filtered));
        }
      } catch (e) {
        console.error('Error updating local cache with server item:', e);
      }
    }
    await refreshItems();
    if (item && item.doorId) {
      const doorMod = DOOR_MODULES.find(m => m.id === item.doorId);
      const doorTitle = doorMod ? doorMod.title.toUpperCase() : item.doorId.toUpperCase();
      const actionLabel = action === 'enrich' ? 'Modificación en' : 'Nueva tarjeta en';
      const message = `${actionLabel} ${doorTitle}`;

      setToastNotification({
        show: true,
        message,
        doorId: item.doorId,
        item
      });

      setTimeout(() => {
        setToastNotification(prev => (prev?.item?.id === item.id ? null : prev));
      }, 5000);
    }
  };

  const handleToggleDbState = () => {
    const nextState = dbState === 'populated' ? 'empty' : 'populated';
    setDbState(nextState);
    setLocalDbState(nextState);
    setSelectedDoorId(null);
    setChatContextItem(null);
    setSelectedItem(null);
    setShowAddForm(false);
    refreshItems();
    window.location.reload();
  };

  const handleResetDb = async () => {
    if (confirm('¿Restablecer toda la base de datos? Esto borrará tus cambios locales, volverá a sembrar los datos iniciales en Supabase y recargará Kyma.')) {
      try {
        await dbClient.resetDatabase();
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert('Error al restablecer la base de datos.');
      }
    }
  };

  const handleSelectDoor = (doorId: string | null, targetTab: 'panel' | 'chat' = 'panel') => {
    setSelectedDoorId(doorId);
    setSelectedTag(null); // Reset tag filter
    setShowAddForm(false);
    setNewTitle('');
    setNewContent('');
    setNewDate('');
    setNewTime('');
    setNewPeso(1);
    setNewCercania('orbita');
    setMobileMenuOpen(false);
    setMobileTab(targetTab);
  };

  // Quick Item Addition
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoorId || !newTitle.trim()) return;

    const itemData: Omit<KymaItem, 'id' | 'createdAt' | 'userId'> = {
      doorId: selectedDoorId as any,
      title: newTitle,
      content: newContent,
      tags: [`#${selectedDoorId}`],
      peso: newPeso
    };

    if (selectedDoorId === 'agenda') {
      itemData.eventDate = newDate || new Date().toISOString().split('T')[0];
      if (newTime) itemData.eventTime = newTime;
      if (newRecurrencia !== 'none') itemData.recurrencia = newRecurrencia;
    } else if (selectedDoorId === 'personas') {
      itemData.cercania = newCercania;
      itemData.frecuencia = 50;
      itemData.peso = newCercania === 'nucleo' ? 3 : newCercania === 'cercana' ? 2 : 1;
    } else if (selectedDoorId === 'tareas') {
      itemData.completed = false;
    }

    try {
      await dbClient.createItem(itemData);
      await refreshItems();
      
      // Clear form
      setNewTitle('');
      setNewContent('');
      setNewDate('');
      setNewTime('');
      setNewPeso(1);
      setNewCercania('orbita');
      setNewRecurrencia('none');
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
      alert('Error al añadir el elemento.');
    }
  };

  const handleToggleComplete = async (item: KymaItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const nextCompleted = !item.completed;
      const nextEstado = nextCompleted ? 'archivado' : 'activo';
      const todayStr = nextCompleted ? new Date().toISOString().split('T')[0] : undefined;
      await dbClient.updateItem(item.id, { 
        completed: nextCompleted, 
        estado: nextEstado,
        fechaEjecucion: todayStr
      });
      await refreshItems();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectItem = (item: KymaItem) => {
    if (item.id && item.id.includes('-rec-')) {
      const realId = item.id.split('-rec-')[0];
      const realItem = items.find(i => i.id === realId);
      if (realItem) {
        setSelectedItem(realItem);
        return;
      }
    }
    setSelectedItem(item);
  };

  const handleAskKyma = (item: KymaItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setChatContextItem(item);
    setSelectedItem(null);
    setMobileTab('chat');
  };

  const handleConfirmItem = async (item: KymaItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    recordTrustAction('confirm');
    try {
      await dbClient.confirmItem(item.id);
      refreshItems();
    } catch (err) {
      console.error('Error al confirmar elemento:', err);
    }
  };

  const handleDiscardItem = async (item: KymaItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    recordTrustAction('discard');
    try {
      await dbClient.discardItem(item.id);
      refreshItems();
    } catch (err) {
      console.error('Error al descartar elemento:', err);
    }
  };

  const handleBrandClick = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const renderIcon = (iconName: string, size = 18, className = "") => {
    const IconComponent = (Icons as any)[iconName] || Icons.HelpCircle;
    return <IconComponent size={size} className={className} />;
  };

  const expandRecurringAgendaItems = (agendaItems: KymaItem[]): KymaItem[] => {
    const expanded: KymaItem[] = [];
    for (const item of agendaItems) {
      expanded.push(item);
      if (item.recurrencia && item.recurrencia !== 'none' && item.eventDate) {
        const parts = item.eventDate.split('-');
        if (parts.length === 3) {
          const year = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1;
          const day = parseInt(parts[2]);
          for (let k = 1; k <= 12; k++) {
            let nextDate = new Date(year, month, day);
            if (item.recurrencia === 'semanal') {
              nextDate.setDate(nextDate.getDate() + k * 7);
            } else if (item.recurrencia === 'mensual') {
              nextDate.setMonth(nextDate.getMonth() + k);
            } else if (item.recurrencia === 'anual') {
              if (k > 1) break;
              nextDate.setFullYear(nextDate.getFullYear() + k);
            } else if (item.recurrencia === 'primer_lunes_mes') {
              const targetMonth = (month + k) % 12;
              const targetYear = year + Math.floor((month + k) / 12);
              nextDate = new Date(targetYear, targetMonth, 1);
              while (nextDate.getDay() !== 1) { // 1 is Monday
                nextDate.setDate(nextDate.getDate() + 1);
              }
            } else if (item.recurrencia === 'ultimo_viernes_mes') {
              const targetMonth = (month + k) % 12;
              const targetYear = year + Math.floor((month + k) / 12);
              nextDate = new Date(targetYear, targetMonth + 1, 0); // Last day of month
              while (nextDate.getDay() !== 5) { // 5 is Friday
                nextDate.setDate(nextDate.getDate() - 1);
              }
            } else {
              break;
            }
            const yyyy = nextDate.getFullYear();
            const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
            const dd = String(nextDate.getDate()).padStart(2, '0');
            expanded.push({
              ...item,
              id: `${item.id}-rec-${k}`,
              eventDate: `${yyyy}-${mm}-${dd}`
            });
          }
        }
      }
    }
    return expanded;
  };

  const baseDoorItems = selectedDoorId
    ? (selectedDoorId === 'agenda' 
        ? expandRecurringAgendaItems(items.filter(item => item.doorId === 'agenda')) 
        : selectedDoorId === 'tareas'
          ? items.filter(item => {
              if (item.doorId !== 'tareas') return false;
              if (showAllCompletedTasks) return true; // Mostrar todas las completadas (Historial)
              if (!item.completed) return true; // Mostrar pendientes por defecto
              
              // Si está completada, solo mostrar si se completó en los últimos 30 días
              if (item.fechaEjecucion) {
                const executionDate = new Date(item.fechaEjecucion);
                const oneMonthAgo = new Date();
                oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                return executionDate >= oneMonthAgo;
              }
              if (item.createdAt) {
                const createdDate = new Date(item.createdAt);
                const oneMonthAgo = new Date();
                oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                return createdDate >= oneMonthAgo;
              }
              return true;
            })
          : items.filter(item => item.doorId === selectedDoorId))
    : [];

  let filteredItems = selectedDoorId 
    ? baseDoorItems
        .filter(item => !selectedTag || item.tags.includes(selectedTag))
        .filter(item => {
          if (selectedDoorId === 'agenda' && !showPastAgendaEvents && agendaViewMode !== 'calendar') {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const localTodayStr = `${year}-${month}-${day}`;
            const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            if (!item.eventDate) return true;
            if (item.eventDate < localTodayStr) return false;
            if (item.eventDate === localTodayStr && item.eventTime) {
              return item.eventTime >= currentTimeStr;
            }
            return true;
          }
          return true;
        })
        .sort((a, b) => {
          if (selectedDoorId === 'agenda') {
            const dateA = a.eventDate ? `${a.eventDate}T${a.eventTime || '00:00'}` : '9999-99-99';
            const dateB = b.eventDate ? `${b.eventDate}T${b.eventTime || '00:00'}` : '9999-99-99';
            return dateA.localeCompare(dateB);
          }
          if (selectedDoorId === 'personas') {
            if (personasSortMode === 'cercania') {
              const cercaniaOrder: Record<string, number> = { nucleo: 3, cercana: 2, orbita: 1 };
              const valA = a.cercania ? (cercaniaOrder[a.cercania] || 1) : (a.peso || 1);
              const valB = b.cercania ? (cercaniaOrder[b.cercania] || 1) : (b.peso || 1);
              if (valA !== valB) {
                return valB - valA;
              }
              // Criterio secundario: desempatar por frecuencia de contacto (mayor frecuencia primero)
              const freqA = a.frecuencia !== undefined ? a.frecuencia : 50;
              const freqB = b.frecuencia !== undefined ? b.frecuencia : 50;
              if (freqA !== freqB) {
                return freqB - freqA;
              }
            }
            const timeA = new Date((a as any).updatedAt || a.createdAt || 0).getTime();
            const timeB = new Date((b as any).updatedAt || b.createdAt || 0).getTime();
            return timeB - timeA;
          }
          if (selectedDoorId === 'reflexiones') {
            if (reflexionesSortMode === 'destacados') {
              const isFeaturedA = a.peso === 3 ? 1 : 0;
              const isFeaturedB = b.peso === 3 ? 1 : 0;
              if (isFeaturedA !== isFeaturedB) {
                return isFeaturedB - isFeaturedA;
              }
            }
            const timeA = new Date((a as any).updatedAt || a.createdAt || 0).getTime();
            const timeB = new Date((b as any).updatedAt || b.createdAt || 0).getTime();
            return timeB - timeA;
          }
          if (selectedDoorId === 'intereses') {
            if (interesesSortMode === 'destacados') {
              const isFeaturedA = a.peso === 3 ? 1 : 0;
              const isFeaturedB = b.peso === 3 ? 1 : 0;
              if (isFeaturedA !== isFeaturedB) {
                return isFeaturedB - isFeaturedA;
              }
            }
            const timeA = new Date((a as any).updatedAt || a.createdAt || 0).getTime();
            const timeB = new Date((b as any).updatedAt || b.createdAt || 0).getTime();
            return timeB - timeA;
          }
          if (selectedDoorId === 'tareas' || selectedDoorId === 'notas') {
            const isFeaturedA = a.peso === 3 ? 1 : 0;
            const isFeaturedB = b.peso === 3 ? 1 : 0;
            if (isFeaturedA !== isFeaturedB) {
              return isFeaturedB - isFeaturedA; // Featured/Urgent first
            }
          }
          return 0; // Maintain original order
        })
    : [];

  if (selectedDoorId === 'agenda' && showPastAgendaEvents) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const localTodayStr = `${year}-${month}-${day}`;
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const futureOrCurrent: KymaItem[] = [];
    const past: KymaItem[] = [];

    for (const item of filteredItems) {
      if (!item.eventDate) {
        futureOrCurrent.push(item);
        continue;
      }
      const isPast = item.eventDate < localTodayStr || (item.eventDate === localTodayStr && item.eventTime ? item.eventTime < currentTimeStr : false);
      if (isPast) {
        past.push(item);
      } else {
        futureOrCurrent.push(item);
      }
    }

    // Limit past events to at most 20 back
    const limitedPast = past.slice(-20);
    filteredItems = [...limitedPast, ...futureOrCurrent];
  }
  const currentDoor = selectedDoorId === 'configuracion'
    ? { id: 'configuracion', title: 'Configuración y Contexto', icon: 'Settings', category: 'utility' as const, description: 'Ajustes del espacio y datos de contexto personal.', emptyPromise: '' }
    : selectedDoorId === 'busqueda'
    ? { id: 'busqueda', title: 'Búsqueda Global', icon: 'Search', category: 'utility' as const, description: 'Encuentra cualquier recuerdo, tarea, persona o nota.', emptyPromise: '' }
    : selectedDoorId === 'ayuda'
    ? { id: 'ayuda', title: 'Ayuda y Consejos de Uso', icon: 'HelpCircle', category: 'utility' as const, description: 'Guía y recomendaciones para exprimir al máximo tu espacio con Kyma.', emptyPromise: '' }
    : DOOR_MODULES.find(d => d.id === selectedDoorId);
  const isVelado = !['configuracion', 'busqueda', 'ayuda'].includes(selectedDoorId || '') && currentDoor?.category === 'map' && filteredItems.length === 0;

  // Render Premium Loading Screen before mounting completes or session is loading
  if (!isMounted || loadingSession) {
    return (
      <div className="kyma-loading-screen">
        <div className="loading-content">
          <div className="minimal-spinner-large" />
        </div>
        <style jsx>{`
          .kyma-loading-screen {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: #08080a;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
          }
          .loading-content {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .minimal-spinner-large {
            width: 38px;
            height: 38px;
            border: 3px solid rgba(255, 255, 255, 0.12);
            border-top-color: #ec4899;
            border-right-color: #a855f7;
            border-radius: 50%;
            animation: kymaSpin 0.75s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }
          @keyframes kymaSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const handleLoginWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        }
      });
      if (error) throw error;
    } catch (err) {
      console.error(err);
      alert('Error al iniciar sesión con Google.');
    }
  };

  const handleExportAllData = async () => {
    try {
      const allItems = await dbClient.getItems();
      
      let markdown = `# Volcado Completo de Datos de Kyma v3.0\n`;
      markdown += `Generado el: ${new Date().toLocaleString()}\n`;
      markdown += `Email de usuario: ${user?.email || 'N/A'}\n\n`;
      markdown += `Este documento contiene la totalidad de tus fichas y relaciones guardadas en Kyma, estructuradas por sección.\n\n---\n\n`;

      const doors = ['agenda', 'tareas', 'notas', 'intereses', 'personas', 'reflexiones', 'estela'];
      const doorNames: Record<string, string> = {
        agenda: 'Agenda (Eventos)',
        tareas: 'Tareas',
        notas: 'Notas',
        intereses: 'Intereses',
        personas: 'Vínculos (Personas)',
        reflexiones: 'Reflexiones',
        estela: 'Estela de vida (Recuerdos del pasado)'
      };

      for (const door of doors) {
        const doorItems = allItems.filter(item => item.doorId === door);
        markdown += `## 🚪 Puerta: ${doorNames[door] || door} (${doorItems.length} elementos)\n\n`;
        
        if (doorItems.length === 0) {
          markdown += `*No hay elementos guardados en esta sección.*\n\n`;
        } else {
          for (const item of doorItems) {
            markdown += `### 📄 ${item.title}\n`;
            markdown += `- **Relevancia / Peso**: ${item.peso}\n`;
            markdown += `- **Fecha de creación**: ${item.createdAt}\n`;
            markdown += `- **Etiquetas**: ${item.tags.join(', ')}\n`;
            
            if (item.doorId === 'agenda') {
              markdown += `- **Fecha del evento**: ${item.eventDate || 'N/A'}\n`;
              if (item.eventTime) markdown += `- **Hora del evento**: ${item.eventTime}\n`;
            } else if (item.doorId === 'tareas') {
              markdown += `- **Estado**: ${item.completed ? '✅ Completada' : '⬜ Pendiente'}\n`;
            } else if (item.doorId === 'personas') {
              markdown += `- **Cercanía afectiva**: ${item.cercania || 'orbita'}\n`;
              markdown += `- **Frecuencia registrada**: ${item.frecuencia || 50}%\n`;
            } else if (item.doorId === 'estela') {
              markdown += `- **Año**: ${item.year || 'N/A'}\n`;
              if (item.dateStr) markdown += `- **Fecha redactada**: ${item.dateStr}\n`;
              if (item.lugar) markdown += `- **Lugar**: ${item.lugar}\n`;
              if (item.emocion) {
                const emotionText: Record<number, string> = { 1: 'Muy triste', 2: 'Triste', 3: 'Neutro', 4: 'Alegre', 5: 'Muy alegre' };
                markdown += `- **Tono emocional**: ${emotionText[item.emocion] || item.emocion}/5\n`;
              }
            }
            
            markdown += `\n**Contenido:**\n${item.content || '*Sin descripción*'}\n\n`;
            markdown += `---\n\n`;
          }
        }
      }

      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `kyma-volcado-total-${new Date().toISOString().split('T')[0]}.md`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Error al exportar los datos.');
    }
  };

  if (!user) {
    return (
      <div className="kyma-login-container">
        <div className="login-card glass-panel">
          <LogoIcon size={80} className="login-logo animate-premium-glow" style={{ marginBottom: '16px' }} />
          <h1 className="serif-title font-serif text-white">Kyma 3.0</h1>
          <p className="login-subtitle">Tu observatorio personal y diario de autoconocimiento lento.</p>
          
          <button className="btn btn-primary login-btn" onClick={handleLoginWithGoogle}>
            <Icons.LogIn size={18} style={{ marginRight: '8px' }} />
            Entrar con Google
          </button>
          
          <p className="login-disclaimer">
            Soberanía de datos garantizada. RLS por usuario.
            <br />
            Derecho al olvido y exportación Markdown integrados.
          </p>
        </div>
        <style jsx>{`
          .kyma-login-container {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100vw;
            height: 100vh;
            background: #08080a;
            background-image: radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 60%);
            padding: 16px;
          }
          .login-card {
            width: 100%;
            max-width: 420px;
            padding: 40px 32px;
            border-radius: var(--border-radius-lg);
            border: 1px solid var(--border-subtle);
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          }
          .login-subtitle {
            color: var(--text-secondary);
            font-size: 0.95rem;
            margin-top: 8px;
            margin-bottom: 32px;
            line-height: 1.5;
          }
          .login-btn {
            width: 100%;
            padding: 12px 24px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            box-shadow: 0 4px 14px rgba(139, 92, 246, 0.25);
            background: var(--accent-gradient);
            border: none;
            color: white;
            border-radius: var(--border-radius-md);
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .login-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(139, 92, 246, 0.4);
          }
          .login-disclaimer {
            color: var(--text-muted);
            font-size: 0.72rem;
            line-height: 1.6;
            margin-top: 32px;
          }
          .text-white {
            color: #ffffff;
            margin: 0;
          }
          .animate-premium-glow {
            color: #ffffff;
            animation: premiumFloatGlow 2.4s infinite ease-in-out;
          }
          @keyframes premiumFloatGlow {
            0% {
              transform: translateY(0) scale(0.95) rotate(-4deg);
              filter: drop-shadow(0 0 10px rgba(139, 92, 246, 0.25));
              opacity: 0.65;
            }
            50% {
              transform: translateY(-12px) scale(1.05) rotate(4deg);
              filter: drop-shadow(0 0 26px rgba(139, 92, 246, 0.7));
              opacity: 1;
            }
            100% {
              transform: translateY(0) scale(0.95) rotate(-4deg);
              filter: drop-shadow(0 0 10px rgba(139, 92, 246, 0.25));
              opacity: 0.65;
            }
          .animate-pop-up-upwards {
            transform-origin: bottom left;
            animation: popUpUpwards 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          @keyframes popUpUpwards {
            from { opacity: 0; transform: translateY(12px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* 0. CABECERA MÓVIL SUPERIOR (Fija en móvil) */}
      <header className="mobile-header">
        <div 
          className="mobile-header-brand" 
          onClick={() => handleSelectDoor(null, 'chat')}
          title="Ir al chat con Kyma"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <LogoFull height={36} className="text-white" />
        </div>
        
        <button 
          className="menu-toggle-btn" 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          title="Menú de módulos"
        >
          {mobileMenuOpen ? <Icons.X size={26} /> : <Icons.Menu size={26} />}
        </button>
      </header>

      {/* 1. SIDEBAR (Escritorio y menú móvil) */}
      <aside className={`sidebar glass-panel ${mobileMenuOpen ? 'mobile-open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div 
          className="sidebar-brand" 
          onClick={handleBrandClick}
          title={sidebarCollapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}
        >
          <LogoFull className="logo-text" height={36} />
          <LogoIcon className="logo-icon-mobile" size={32} />
        </div>

        <nav className="sidebar-nav">
          <div className="nav-list">
            {DOOR_MODULES.map(door => {
              const isLocked = dbState === 'empty' && door.category === 'map';
              return (
                <button
                  key={door.id}
                  className={`nav-item ${selectedDoorId === door.id ? 'active' : ''} ${isLocked ? 'item-locked' : ''}`}
                  onClick={() => handleSelectDoor(door.id)}
                  title={sidebarCollapsed ? `${door.title} ${isLocked ? '(Velado)' : ''}` : undefined}
                >
                  {renderIcon(door.icon, 18)}
                  <span>{door.title}</span>
                  
                  <span className="item-count">
                    {door.id === 'agenda'
                      ? (showPastAgendaEvents 
                          ? items.filter(i => i.doorId === 'agenda').length 
                          : items.filter(i => i.doorId === 'agenda' && (!i.eventDate || i.eventDate >= new Date().toISOString().split('T')[0])).length)
                      : door.id === 'tareas'
                        ? items.filter(i => i.doorId === 'tareas' && !i.completed && i.estado !== 'archivado').length
                        : items.filter(i => i.doorId === door.id).length}
                  </span>
                  
                  {isLocked && (
                    <Icons.Lock size={12} className="lock-icon" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-action-bar">
            {isInstallable && (
              <button 
                type="button"
                className="sidebar-footer-action-btn"
                onClick={promptInstall}
                title="Instalar Kyma como aplicación"
                style={{ color: '#c084fc' }}
              >
                <Icons.Download size={18} />
              </button>
            )}

            <button 
              type="button"
              className={`sidebar-footer-action-btn ${selectedDoorId === 'configuracion' ? 'active' : ''}`}
              onClick={() => handleSelectDoor('configuracion')}
              title="Configuración y Contexto"
            >
              <Icons.Settings size={18} />
            </button>

            <button 
              type="button"
              className={`sidebar-footer-action-btn ${selectedDoorId === 'busqueda' ? 'active' : ''}`}
              onClick={() => handleSelectDoor('busqueda')}
              title="Búsqueda Global"
            >
              <Icons.Search size={18} />
            </button>

            <button 
              type="button"
              className={`sidebar-footer-action-btn ${selectedDoorId === 'ayuda' ? 'active' : ''}`}
              onClick={() => handleSelectDoor('ayuda')}
              title="Ayuda y Consejos de Uso"
            >
              <Icons.HelpCircle size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. PANEL CENTRAL */}
      <main className={`content-pane ${chatState === 'expanded' ? 'pane-hidden' : ''} ${mobileTab === 'panel' ? 'mobile-visible' : 'mobile-hidden'} ${((selectedDoorId === 'personas' && personasViewMode === 'orbits') || (selectedDoorId === 'intereses' && interesesViewMode === 'orbits') || (selectedDoorId === 'estela' && estelaViewMode === 'timeline')) ? 'no-scroll' : ''}`}>
        {!isOnline && (
          <div style={{
            background: 'rgba(234, 179, 8, 0.15)',
            borderBottom: '1px solid rgba(234, 179, 8, 0.3)',
            padding: '10px 16px',
            fontSize: '0.84rem',
            color: '#fef08a',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            justifyContent: 'center',
            textAlign: 'center'
          }}>
            <Icons.WifiOff size={16} style={{ flexShrink: 0 }} />
            <span><strong>Modo sin conexión:</strong> Tus capturas se guardan localmente y se sincronizarán al reconectar. El chat con Kyma requiere red.</span>
          </div>
        )}

        {updateAvailable && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(109, 40, 217, 0.3))',
            borderBottom: '1px solid rgba(139, 92, 246, 0.4)',
            padding: '10px 16px',
            fontSize: '0.86rem',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LogoIcon size={18} />
              <span>Hay una nueva versión de Kyma disponible.</span>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={applyUpdate}
              style={{ padding: '4px 12px', fontSize: '0.8rem' }}
            >
              Actualizar
            </button>
          </div>
        )}

        {showIOSHint && (
          <div style={{
            background: 'rgba(24, 24, 27, 0.95)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            margin: '12px',
            padding: '14px 16px',
            fontSize: '0.84rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Icons.Share size={18} color="var(--accent-purple)" />
              <span>Instala Kyma en tu iPhone: pulsa el botón <strong>Compartir</strong> <Icons.Share size={14} style={{ display: 'inline' }} /> y elige <strong>Añadir a la pantalla de inicio</strong>.</span>
            </div>
            <button 
              onClick={dismissIOSHint}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <Icons.X size={16} />
            </button>
          </div>
        )}



        {selectedDoorId === null ? (
          <div className="home-view animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <div className="home-hero" style={{ position: 'relative', width: '100%' }}>
              {/* VIEW TOGGLE CONTROL: BOTÓN CIRCULAR CON FLECHAS EN TOP RIGHT */}
              <button 
                className={`btn btn-secondary ${!dashboardExpanded ? 'active' : ''}`}
                onClick={() => setDashboardExpanded(!dashboardExpanded)}
                title={dashboardExpanded ? "Simplificar vista de tarjetas" : "Ver vista detallada"}
                style={{ 
                  position: 'absolute',
                  top: '0',
                  right: '0',
                  width: '38px', 
                  height: '38px', 
                  padding: 0, 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: !dashboardExpanded ? 'rgba(139, 92, 246, 0.2)' : 'var(--bg-tertiary)',
                  borderColor: !dashboardExpanded ? 'var(--accent-purple)' : 'var(--border-subtle)',
                  color: !dashboardExpanded ? '#ffffff' : 'var(--text-secondary)',
                  zIndex: 10
                }}
              >
                {dashboardExpanded ? <Icons.Minimize2 size={16} /> : <Icons.Maximize2 size={16} />}
              </button>

              <h1 className="serif-title font-serif">
                ¡Hola, {userProfile.nombre?.trim() || user?.user_metadata?.full_name?.split(' ')[0] || (user?.email ? user.email.split('@')[0] : 'David')}!
              </h1>
              <p className="hero-subtitle">
                Tu espacio personal de un vistazo. Accede directamente a tus novedades y actividad reciente.
              </p>
            </div>

            {/* RESPONSIVE MODULAR DASHBOARD GRID (2 to 3 columns) */}
            <div 
              className="dashboard-modular-grid" 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', 
                gap: '24px',
                alignItems: 'start'
              }}
            >
              {(() => {
                const isRecentDashboardItem = (item: KymaItem) => {
                  if (!item.createdAt) return true;
                  const itemDate = new Date(item.createdAt).getTime();
                  if (isNaN(itemDate)) return true;
                  const now = Date.now();
                  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
                  return (now - itemDate) <= oneWeekMs || itemDate >= now;
                };

                // 1. Agenda: Próximos eventos
                const agendaItems = expandRecurringAgendaItems(items.filter(i => i.doorId === 'agenda'))
                  .filter(i => {
                    if (!i.eventDate) return false;
                    const year = currentTime.getFullYear();
                    const month = String(currentTime.getMonth() + 1).padStart(2, '0');
                    const day = String(currentTime.getDate()).padStart(2, '0');
                    const localTodayStr = `${year}-${month}-${day}`;
                    const currentTimeStr = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
                    
                    if (i.eventDate < localTodayStr) return false;
                    if (i.eventDate === localTodayStr && i.eventTime) {
                      return i.eventTime >= currentTimeStr;
                    }
                    return true;
                  })
                  .sort((a, b) => {
                    const dateCompare = (a.eventDate || '').localeCompare(b.eventDate || '');
                    if (dateCompare !== 0) return dateCompare;
                    return (a.eventTime || '').localeCompare(b.eventTime || '');
                  });
                
                // 2. Tareas urgentes (solo si hay alguna marcada con peso === 3)
                const urgentTaskItems = items
                  .filter(i => i.doorId === 'tareas' && !i.completed && i.peso === 3);

                // 3. Nuevos vínculos (creados la última semana)
                const newVinculoItems = items
                  .filter(i => i.doorId === 'personas' && isRecentDashboardItem(i))
                  .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

                // 4. Intereses (últimos modificados/creados en la última semana)
                const recienteIntereses = items
                  .filter(i => i.doorId === 'intereses' && isRecentDashboardItem(i))
                  .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

                // 5. Reflexiones (últimas modificadas en la última semana)
                const recienteReflexiones = items
                  .filter(i => i.doorId === 'reflexiones' && isRecentDashboardItem(i))
                  .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

                // 6. Notas (últimas añadidas en la última semana)
                const recienteNotas = items
                  .filter(i => i.doorId === 'notas' && isRecentDashboardItem(i))
                  .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

                // 7. Recuerdos añadidos (Estela de vida, ÚLTIMO BLOQUE)
                const recienteEstela = items
                  .filter(i => i.doorId === 'estela' && isRecentDashboardItem(i))
                  .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

                const hasAnyContent = agendaItems.length > 0 || urgentTaskItems.length > 0 || newVinculoItems.length > 0 || recienteIntereses.length > 0 || recienteReflexiones.length > 0 || recienteNotas.length > 0 || recienteEstela.length > 0;

                if (!hasAnyContent) {
                  return (
                    <div style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-subtle)', borderRadius: '16px', padding: '32px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <Icons.Sparkles size={24} color="var(--accent-purple-light, #c084fc)" style={{ margin: '0 auto 12px' }} />
                      <h3 className="font-serif" style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>Tu mapa está tranquilo</h3>
                      <p style={{ fontSize: '0.88rem', maxWidth: '460px', margin: '0 auto', color: 'var(--text-muted)' }}>
                        No hay novedades recientes esta semana. Explora tus puertas en el menú lateral o habla con Kyma en el chat para registrar nuevas ideas y recuerdos.
                      </p>
                    </div>
                  );
                }

                return (
                  <>
                    {/* 1. AGENDA */}
                    {agendaItems.length > 0 && (
                      <div className="home-section-block" style={{ background: 'transparent', border: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div 
                            onClick={() => handleSelectDoor('agenda')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                            title="Ver sección Agenda"
                          >
                            <Icons.Calendar size={16} color="var(--accent-purple-light, #c084fc)" />
                            <h2 className="font-serif" style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-secondary, #a1a1aa)', margin: 0 }}>Próximos eventos</h2>
                          </div>
                        </div>
                        <ItemCard
                          item={agendaItems[0]}
                          isCompact={!dashboardExpanded}
                          onClick={(clickedItem) => handleSelectItem(clickedItem)}
                          onAskKyma={(item, e) => handleAskKyma(item, e)}
                          onConfirmItem={(item, e) => handleConfirmItem(item, e)}
                          onDiscardItem={(item, e) => handleDiscardItem(item, e)}
                        />
                      </div>
                    )}

                    {/* 2. TAREAS URGENTES */}
                    {urgentTaskItems.length > 0 && (
                      <div className="home-section-block" style={{ background: 'transparent', border: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div 
                            onClick={() => handleSelectDoor('tareas')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                            title="Ver sección Tareas"
                          >
                            <Icons.CheckSquare size={16} color="var(--accent-purple-light, #c084fc)" />
                            <h2 className="font-serif" style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-secondary, #a1a1aa)', margin: 0 }}>Tareas urgentes</h2>
                          </div>
                        </div>
                        <ItemCard
                          item={urgentTaskItems[0]}
                          isCompact={!dashboardExpanded}
                          onClick={(clickedItem) => handleSelectItem(clickedItem)}
                          onAskKyma={(item, e) => handleAskKyma(item, e)}
                          onToggleComplete={handleToggleComplete}
                          onConfirmItem={(item, e) => handleConfirmItem(item, e)}
                          onDiscardItem={(item, e) => handleDiscardItem(item, e)}
                        />
                      </div>
                    )}

                    {/* 3. NUEVOS VÍNCULOS */}
                    {newVinculoItems.length > 0 && (
                      <div className="home-section-block" style={{ background: 'transparent', border: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div 
                            onClick={() => handleSelectDoor('personas')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                            title="Ver sección Vínculos"
                          >
                            <Icons.Users size={16} color="var(--accent-purple-light, #c084fc)" />
                            <h2 className="font-serif" style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-secondary, #a1a1aa)', margin: 0 }}>Nuevos vínculos</h2>
                          </div>
                        </div>
                        <ItemCard
                          item={newVinculoItems[0]}
                          isCompact={!dashboardExpanded}
                          onClick={(clickedItem) => handleSelectItem(clickedItem)}
                          onAskKyma={(item, e) => handleAskKyma(item, e)}
                          onConfirmItem={(item, e) => handleConfirmItem(item, e)}
                          onDiscardItem={(item, e) => handleDiscardItem(item, e)}
                        />
                      </div>
                    )}

                    {/* 4. INTERESES */}
                    {recienteIntereses.length > 0 && (
                      <div className="home-section-block" style={{ background: 'transparent', border: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div 
                            onClick={() => handleSelectDoor('intereses')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                            title="Ver sección Intereses"
                          >
                            <Icons.Compass size={16} color="var(--accent-purple-light, #c084fc)" />
                            <h2 className="font-serif" style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-secondary, #a1a1aa)', margin: 0 }}>Intereses</h2>
                          </div>
                        </div>
                        <ItemCard
                          item={recienteIntereses[0]}
                          isCompact={!dashboardExpanded}
                          onClick={(clickedItem) => handleSelectItem(clickedItem)}
                          onAskKyma={(item, e) => handleAskKyma(item, e)}
                          onConfirmItem={(item, e) => handleConfirmItem(item, e)}
                          onDiscardItem={(item, e) => handleDiscardItem(item, e)}
                        />
                      </div>
                    )}

                    {/* 5. REFLEXIONES */}
                    {recienteReflexiones.length > 0 && (
                      <div className="home-section-block" style={{ background: 'transparent', border: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div 
                            onClick={() => handleSelectDoor('reflexiones')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                            title="Ver sección Reflexiones"
                          >
                            <Icons.Lightbulb size={16} color="var(--accent-purple-light, #c084fc)" />
                            <h2 className="font-serif" style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-secondary, #a1a1aa)', margin: 0 }}>Reflexiones</h2>
                          </div>
                        </div>
                        <ItemCard
                          item={recienteReflexiones[0]}
                          isCompact={!dashboardExpanded}
                          onClick={(clickedItem) => handleSelectItem(clickedItem)}
                          onAskKyma={(item, e) => handleAskKyma(item, e)}
                          onConfirmItem={(item, e) => handleConfirmItem(item, e)}
                          onDiscardItem={(item, e) => handleDiscardItem(item, e)}
                        />
                      </div>
                    )}

                    {/* 6. NOTAS */}
                    {recienteNotas.length > 0 && (
                      <div className="home-section-block" style={{ background: 'transparent', border: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div 
                            onClick={() => handleSelectDoor('notas')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                            title="Ver sección Notas"
                          >
                            <Icons.FileText size={16} color="var(--accent-purple-light, #c084fc)" />
                            <h2 className="font-serif" style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-secondary, #a1a1aa)', margin: 0 }}>Notas</h2>
                          </div>
                        </div>
                        <ItemCard
                          item={recienteNotas[0]}
                          isCompact={!dashboardExpanded}
                          onClick={(clickedItem) => handleSelectItem(clickedItem)}
                          onAskKyma={(item, e) => handleAskKyma(item, e)}
                          onConfirmItem={(item, e) => handleConfirmItem(item, e)}
                          onDiscardItem={(item, e) => handleDiscardItem(item, e)}
                        />
                      </div>
                    )}

                    {/* 7. RECUERDOS AÑADIDOS (ESTELA DE VIDA - ÚLTIMO BLOQUE) */}
                    {recienteEstela.length > 0 && (
                      <div className="home-section-block" style={{ background: 'transparent', border: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div 
                            onClick={() => handleSelectDoor('estela')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                            title="Ver sección Estela de vida"
                          >
                            <Icons.Activity size={16} color="var(--accent-purple-light, #c084fc)" />
                            <h2 className="font-serif" style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-secondary, #a1a1aa)', margin: 0 }}>Recuerdos añadidos</h2>
                          </div>
                        </div>
                        <ItemCard
                          item={recienteEstela[0]}
                          isCompact={!dashboardExpanded}
                          onClick={(clickedItem) => handleSelectItem(clickedItem)}
                          onAskKyma={(item, e) => handleAskKyma(item, e)}
                          onConfirmItem={(item, e) => handleConfirmItem(item, e)}
                          onDiscardItem={(item, e) => handleDiscardItem(item, e)}
                        />
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className={`door-view animate-fade-in ${((selectedDoorId === 'personas' && personasViewMode === 'orbits') || (selectedDoorId === 'intereses' && interesesViewMode === 'orbits') || (selectedDoorId === 'estela' && estelaViewMode === 'timeline')) ? 'full-width-door-view' : ''}`}>
            <div className="door-header">
              <div className="door-header-main-row">
                <div className="door-header-title-group">
                  <button 
                    className="back-to-home-btn circular-back-btn" 
                    onClick={() => handleSelectDoor(null)}
                    title="Volver"
                  >
                    <Icons.ArrowLeft size={18} />
                  </button>

                  <h1 className="door-title font-serif">
                    {renderIcon(currentDoor?.icon || '', 24, "text-purple inline-icon")}
                    {currentDoor?.title}
                  </h1>
                </div>

                <div className="door-controls">
                  {selectedDoorId === 'intereses' && !isVelado && (
                    <div className="view-mode-selector radio-group">
                      <button 
                        className={`radio-label ${interesesViewMode === 'grid' ? 'active' : ''}`}
                        onClick={() => setInteresesViewMode('grid')}
                        title="Vista de Lista"
                        style={{ width: '38px', height: '38px', padding: 0, justifyContent: 'center' }}
                      >
                        <Icons.Grid size={16} />
                      </button>
                      <button 
                        className={`radio-label ${interesesViewMode === 'orbits' ? 'active' : ''}`}
                        onClick={() => setInteresesViewMode('orbits')}
                        title="Vista de Universo"
                        style={{ width: '38px', height: '38px', padding: 0, justifyContent: 'center' }}
                      >
                        <Icons.Orbit size={16} />
                      </button>
                    </div>
                  )}

                  {selectedDoorId === 'personas' && !isVelado && (
                    <div className="view-mode-selector radio-group">
                      <button 
                        className={`radio-label ${personasViewMode === 'grid' ? 'active' : ''}`}
                        onClick={() => setPersonasViewMode('grid')}
                        title="Vista de Lista"
                        style={{ width: '38px', height: '38px', padding: 0, justifyContent: 'center' }}
                      >
                        <Icons.Grid size={16} />
                      </button>
                      <button 
                        className={`radio-label ${personasViewMode === 'orbits' ? 'active' : ''}`}
                        onClick={() => setPersonasViewMode('orbits')}
                        title="Vista de Universo"
                        style={{ width: '38px', height: '38px', padding: 0, justifyContent: 'center' }}
                      >
                        <Icons.Orbit size={16} />
                      </button>
                    </div>
                  )}

                  {selectedDoorId === 'tareas' && !isVelado && (
                    <button 
                      className={`btn btn-secondary ${showAllCompletedTasks ? 'active' : ''}`}
                      onClick={() => setShowAllCompletedTasks(!showAllCompletedTasks)}
                      title={showAllCompletedTasks ? "Mostrando todas las tareas (historial completo) - Clic para ver activas" : "Ver todas las tareas (historial completo)"}
                      style={{ 
                        width: '38px', 
                        height: '38px', 
                        padding: 0, 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        background: showAllCompletedTasks ? 'rgba(139, 92, 246, 0.2)' : 'var(--bg-tertiary)',
                        borderColor: showAllCompletedTasks ? 'var(--accent-purple)' : 'var(--border-subtle)',
                        color: showAllCompletedTasks ? '#ffffff' : 'var(--text-secondary)'
                      }}
                    >
                      <Icons.Clock size={16} />
                    </button>
                  )}

                  {selectedDoorId === 'agenda' && !isVelado && (
                    <>
                      <div className="view-mode-selector radio-group">
                        <button 
                          className={`radio-label ${agendaViewMode === 'grid' ? 'active' : ''}`}
                          onClick={() => setAgendaViewMode('grid')}
                          title="Vista de Lista"
                          style={{ width: '38px', height: '38px', padding: 0, justifyContent: 'center' }}
                        >
                          <Icons.Grid size={16} />
                        </button>
                        <button 
                          className={`radio-label ${agendaViewMode === 'calendar' ? 'active' : ''}`}
                          onClick={() => setAgendaViewMode('calendar')}
                          title="Vista de Calendario"
                          style={{ width: '38px', height: '38px', padding: 0, justifyContent: 'center' }}
                        >
                          <Icons.Calendar size={16} />
                        </button>
                      </div>
                      <button 
                        className={`btn btn-secondary ${showPastAgendaEvents ? 'active' : ''}`}
                        onClick={() => setShowPastAgendaEvents(!showPastAgendaEvents)}
                        title={showPastAgendaEvents ? "Mostrando todos los eventos (click para mostrar solo próximos)" : "Mostrar histórico de eventos pasados"}
                        style={{ 
                          width: '38px', 
                          height: '38px', 
                          padding: 0, 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          background: showPastAgendaEvents ? 'rgba(139, 92, 246, 0.2)' : 'var(--bg-tertiary)',
                          borderColor: showPastAgendaEvents ? 'var(--accent-purple)' : 'var(--border-subtle)',
                          color: showPastAgendaEvents ? '#ffffff' : 'var(--text-secondary)'
                        }}
                      >
                        <Icons.Clock size={16} />
                      </button>
                    </>
                  )}

                  {selectedDoorId === 'estela' && !isVelado && (
                    <div className="view-mode-selector radio-group">
                      <button 
                        className={`radio-label ${estelaViewMode === 'grid' ? 'active' : ''}`}
                        onClick={() => setEstelaViewMode('grid')}
                        title="Vista de Lista"
                        style={{ width: '38px', height: '38px', padding: 0, justifyContent: 'center' }}
                      >
                        <Icons.Grid size={16} />
                      </button>
                      <button 
                        className={`radio-label ${estelaViewMode === 'timeline' ? 'active' : ''}`}
                        onClick={() => setEstelaViewMode('timeline')}
                        title="Vista de Línea de vida"
                        style={{ width: '38px', height: '38px', padding: 0, justifyContent: 'center' }}
                      >
                        <Icons.GitCommit size={16} />
                      </button>
                    </div>
                  )}

                  {selectedDoorId === 'estela' && !isVelado && (
                    <>
                      <button 
                        className="btn btn-secondary"
                        onClick={() => setEstelaSortAsc(!estelaSortAsc)}
                        title={estelaSortAsc ? "Ordenar: Más recientes primero" : "Ordenar: Más antiguos primero"}
                        style={{ 
                          width: '38px', 
                          height: '38px', 
                          padding: 0, 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          background: 'var(--bg-tertiary)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        {estelaSortAsc ? <Icons.ArrowUp size={16} /> : <Icons.ArrowDown size={16} />}
                      </button>

                      {estelaViewMode === 'timeline' && (
                        <button 
                          className="btn btn-secondary animate-fade-in"
                          onClick={() => {
                            setEstelaTimelineScale(prev => {
                              if (prev === 60) return 120;
                              if (prev === 120) return 200;
                              return 60;
                            });
                          }}
                          title={
                            estelaTimelineScale === 60 ? "Escala: Compacta (junta las fechas) - Clic para Mediana" :
                            estelaTimelineScale === 120 ? "Escala: Mediana - Clic para Amplia" :
                            "Escala: Amplia (separa las fechas) - Clic para Compacta"
                          }
                          style={{ 
                            width: '38px', 
                            height: '38px', 
                            padding: 0, 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            background: 'var(--bg-tertiary)',
                            borderColor: 'var(--border-subtle)',
                            color: estelaTimelineScale !== 60 ? '#ec4899' : 'var(--text-secondary)',
                            marginLeft: '8px'
                          }}
                        >
                          <Icons.Ruler size={16} />
                        </button>
                      )}
                    </>
                  )}

                  {/* Sorting button for Personas (Cercanía afectiva vs Recientes) */}
                  {selectedDoorId === 'personas' && !isVelado && personasViewMode === 'grid' && (
                    <button 
                      className={`btn btn-secondary ${personasSortMode === 'cercania' ? 'active' : ''}`}
                      onClick={() => setPersonasSortMode(personasSortMode === 'cercania' ? 'recientes' : 'cercania')}
                      title={personasSortMode === 'cercania' ? 'Ordenado por cercanía afectiva (Núcleo > Cercana > Órbita)' : 'Ordenar por cercanía afectiva'}
                      style={{ 
                        width: '38px', 
                        height: '38px', 
                        padding: 0, 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        background: personasSortMode === 'cercania' ? 'rgba(236, 72, 153, 0.2)' : 'var(--bg-tertiary)',
                        borderColor: personasSortMode === 'cercania' ? '#ec4899' : 'var(--border-subtle)',
                        color: personasSortMode === 'cercania' ? '#ec4899' : 'var(--text-secondary)'
                      }}
                    >
                      <Icons.Heart size={16} fill={personasSortMode === 'cercania' ? '#ec4899' : 'none'} />
                    </button>
                  )}

                  {/* Orbits controls for Personas */}
                  {selectedDoorId === 'personas' && !isVelado && personasViewMode === 'orbits' && (
                    <>
                      {/* Scale (Ruler) */}
                      <button 
                        className="btn btn-secondary animate-fade-in"
                        onClick={() => {
                          setPersonasOrbitsScale(prev => {
                            if (prev === 0.65) return 1.0;
                            if (prev === 1.0) return 1.45;
                            return 0.65;
                          });
                        }}
                        title={
                          personasOrbitsScale === 0.65 ? "Órbitas: Compactas - Clic para Medianas" :
                          personasOrbitsScale === 1.0 ? "Órbitas: Medianas - Clic para Amplias" :
                          "Órbitas: Amplias - Clic para Compactas"
                        }
                        style={{ 
                          width: '38px', 
                          height: '38px', 
                          padding: 0, 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          background: 'var(--bg-tertiary)',
                          borderColor: 'var(--border-subtle)',
                          color: personasOrbitsScale !== 1.0 ? '#c084fc' : 'var(--text-secondary)',
                          marginLeft: '8px'
                        }}
                      >
                        <Icons.Ruler size={16} />
                      </button>

                      {/* Filter: Nucleo (Target) */}
                      <button 
                        className={`btn btn-secondary animate-fade-in ${personasShowNucleo ? 'active' : ''}`}
                        onClick={() => setPersonasShowNucleo(prev => !prev)}
                        title={personasShowNucleo ? "Ocultar Vínculos del Núcleo" : "Mostrar Vínculos del Núcleo"}
                        style={{ 
                          width: '38px', 
                          height: '38px', 
                          padding: 0, 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          background: personasShowNucleo ? 'rgba(236, 72, 153, 0.2)' : 'var(--bg-tertiary)',
                          borderColor: personasShowNucleo ? '#ec4899' : 'var(--border-subtle)',
                          color: personasShowNucleo ? '#ec4899' : 'var(--text-muted)',
                          marginLeft: '8px'
                        }}
                      >
                        <Icons.Target size={16} />
                      </button>

                      {/* Filter: Cercana (Users) */}
                      <button 
                        className={`btn btn-secondary animate-fade-in ${personasShowCercana ? 'active' : ''}`}
                        onClick={() => setPersonasShowCercana(prev => !prev)}
                        title={personasShowCercana ? "Ocultar Vínculos Cercanos" : "Mostrar Vínculos Cercanos"}
                        style={{ 
                          width: '38px', 
                          height: '38px', 
                          padding: 0, 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          background: personasShowCercana ? 'rgba(56, 189, 248, 0.2)' : 'var(--bg-tertiary)',
                          borderColor: personasShowCercana ? '#38bdf8' : 'var(--border-subtle)',
                          color: personasShowCercana ? '#38bdf8' : 'var(--text-muted)',
                          marginLeft: '8px'
                        }}
                      >
                        <Icons.Users size={16} />
                      </button>

                      {/* Filter: Orbita (Globe) */}
                      <button 
                        className={`btn btn-secondary animate-fade-in ${personasShowOrbita ? 'active' : ''}`}
                        onClick={() => setPersonasShowOrbita(prev => !prev)}
                        title={personasShowOrbita ? "Ocultar Vínculos de la Órbita" : "Mostrar Vínculos de la Órbita"}
                        style={{ 
                          width: '38px', 
                          height: '38px', 
                          padding: 0, 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          background: personasShowOrbita ? 'rgba(148, 163, 184, 0.2)' : 'var(--bg-tertiary)',
                          borderColor: personasShowOrbita ? '#94a3b8' : 'var(--border-subtle)',
                          color: personasShowOrbita ? '#94a3b8' : 'var(--text-muted)',
                          marginLeft: '8px'
                        }}
                      >
                        <Icons.Globe size={16} />
                      </button>
                    </>
                  )}

                  {/* Sorting button for Reflexiones (Destacados vs Recientes) */}
                  {selectedDoorId === 'reflexiones' && !isVelado && (
                    <button 
                      className={`btn btn-secondary ${reflexionesSortMode === 'destacados' ? 'active' : ''}`}
                      onClick={() => setReflexionesSortMode(reflexionesSortMode === 'destacados' ? 'recientes' : 'destacados')}
                      title={reflexionesSortMode === 'destacados' ? 'Ordenado por principios destacados' : 'Ordenar por principios destacados'}
                      style={{ 
                        width: '38px', 
                        height: '38px', 
                        padding: 0, 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        background: reflexionesSortMode === 'destacados' ? 'rgba(236, 72, 153, 0.2)' : 'var(--bg-tertiary)',
                        borderColor: reflexionesSortMode === 'destacados' ? '#ec4899' : 'var(--border-subtle)',
                        color: reflexionesSortMode === 'destacados' ? '#ec4899' : 'var(--text-secondary)'
                      }}
                    >
                      <Icons.Heart size={16} fill={reflexionesSortMode === 'destacados' ? '#ec4899' : 'none'} />
                    </button>
                  )}

                  {/* Sorting button for Intereses (Pasión/Destacados vs Recientes) */}
                  {selectedDoorId === 'intereses' && !isVelado && interesesViewMode === 'grid' && (
                    <button 
                      className={`btn btn-secondary ${interesesSortMode === 'destacados' ? 'active' : ''}`}
                      onClick={() => setInteresesSortMode(interesesSortMode === 'destacados' ? 'recientes' : 'destacados')}
                      title={interesesSortMode === 'destacados' ? 'Ordenado por pasión (destacados primero)' : 'Ordenar por grado de pasión'}
                      style={{ 
                        width: '38px', 
                        height: '38px', 
                        padding: 0, 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        background: interesesSortMode === 'destacados' ? 'rgba(236, 72, 153, 0.2)' : 'var(--bg-tertiary)',
                        borderColor: interesesSortMode === 'destacados' ? '#ec4899' : 'var(--border-subtle)',
                        color: interesesSortMode === 'destacados' ? '#ec4899' : 'var(--text-secondary)'
                      }}
                    >
                      <Icons.Heart size={16} fill={interesesSortMode === 'destacados' ? '#ec4899' : 'none'} />
                    </button>
                  )}

                  {/* Simplified/Compact View Toggle Button */}
                  {!isVelado && !['configuracion', 'ayuda'].includes(selectedDoorId || '') &&
                   (selectedDoorId !== 'estela' || estelaViewMode === 'grid') &&
                   (!selectedDoorId || 
                    (selectedDoorId !== 'personas' || personasViewMode === 'grid') && 
                    (selectedDoorId !== 'intereses' || interesesViewMode === 'grid') && 
                    (selectedDoorId !== 'agenda' || agendaViewMode === 'grid')) && (
                    <button 
                      className={`btn btn-secondary ${isCompactView ? 'active' : ''}`}
                      onClick={() => setIsCompactView(!isCompactView)}
                      title={isCompactView ? "Ver vista detallada" : "Simplificar vista de tarjetas"}
                      style={{ 
                        width: '38px', 
                        height: '38px', 
                        padding: 0, 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        background: isCompactView ? 'rgba(139, 92, 246, 0.2)' : 'var(--bg-tertiary)',
                        borderColor: isCompactView ? 'var(--accent-purple)' : 'var(--border-subtle)',
                        color: isCompactView ? '#ffffff' : 'var(--text-secondary)'
                      }}
                    >
                      {isCompactView ? <Icons.Maximize2 size={16} /> : <Icons.Minimize2 size={16} />}
                    </button>
                  )}

                  {!isVelado && !['configuracion', 'busqueda', 'ayuda'].includes(selectedDoorId || '') && (
                    <button 
                      className="btn btn-secondary" 
                      onClick={async () => {
                        try {
                          const restored = await dbClient.restoreLastDeletedItem();
                          if (restored) {
                            refreshItems();
                            setUndoToast(null);
                            setToastNotification({ show: true, message: `Ficha "${restored.title}" recuperada con éxito`, doorId: restored.doorId as any, item: restored });
                          } else {
                            setToastNotification({ show: true, message: 'No hay fichas en la papelera para recuperar', doorId: selectedDoorId as any });
                          }
                        } catch (e) {
                          console.error('Error al recuperar ficha:', e);
                        }
                      }}
                      title="Deshacer acción / Recuperar ficha eliminada"
                      style={{ 
                        width: '38px', 
                        height: '38px', 
                        padding: 0, 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        background: 'var(--bg-tertiary)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      <Icons.RotateCcw size={16} />
                    </button>
                  )}

                  {currentDoor?.category === 'utility' && !['configuracion', 'busqueda', 'ayuda'].includes(selectedDoorId || '') && !showAddForm && (
                    <button 
                      className="btn btn-primary" 
                      onClick={() => setShowAddForm(true)}
                      title="Añadir elemento"
                      style={{ width: '38px', height: '38px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Icons.Plus size={18} />
                    </button>
                  )}
                </div>
              </div>

              {/* Active tag filter badge */}
              {selectedTag && (
                <div className="active-tag-filter animate-fade-in" style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  marginTop: '2px', 
                  fontSize: '0.78rem', 
                  background: 'rgba(139, 92, 246, 0.12)', 
                  border: '1px solid rgba(139, 92, 246, 0.25)', 
                  padding: '4px 10px', 
                  borderRadius: '14px', 
                  color: 'var(--text-primary)' 
                }}>
                  <span>Filtrado por: <strong>{selectedTag.startsWith('#') ? selectedTag.slice(1) : selectedTag}</strong></span>
                  <button 
                    onClick={() => setSelectedTag(null)} 
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: 'var(--text-secondary)', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      padding: '2px', 
                      borderRadius: '50%',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                    title="Quitar filtro"
                  >
                    <Icons.X size={12} />
                  </button>
                </div>
              )}
            </div>

            {showAddForm && (
              <form onSubmit={handleAddItem} className="quick-add-form card animate-fade-in">
                <div className="form-group">
                  <input
                    type="text"
                    className="input-field form-title-input"
                    placeholder="Título del elemento..."
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                
                <div className="form-group">
                  <textarea
                    className="input-field"
                    placeholder="Descripción o anotación..."
                    value={newContent}
                    onChange={e => setNewContent(e.target.value)}
                    rows={2}
                    required
                  />
                </div>

                <div className="form-row">
                  {selectedDoorId === 'agenda' && (
                    <>
                      <div className="form-group flex-1">
                        <label className="form-label">Fecha del evento</label>
                        <input
                          type="date"
                          className="input-field"
                          value={newDate}
                          onChange={e => setNewDate(e.target.value)}
                        />
                      </div>
                      <div className="form-group flex-1">
                        <label className="form-label">Hora</label>
                        <input
                          type="time"
                          className="input-field"
                          value={newTime}
                          onChange={e => setNewTime(e.target.value)}
                        />
                      </div>
                      <div className="form-group flex-1">
                        <label className="form-label">Repetición</label>
                        <select
                          className="input-field"
                          value={newRecurrencia}
                          onChange={e => setNewRecurrencia(e.target.value as any)}
                        >
                          <option value="none">No se repite</option>
                          <option value="semanal">Semanal</option>
                          <option value="mensual">Mensual</option>
                          <option value="anual">Anual</option>
                          <option value="primer_lunes_mes">Primer lunes de cada mes</option>
                          <option value="ultimo_viernes_mes">Último viernes de cada mes</option>
                        </select>
                      </div>
                    </>
                  )}

                  {selectedDoorId === 'personas' && (
                    <div className="form-group flex-1">
                      <label className="form-label">Cercanía Afectiva</label>
                      <select
                        className="input-field"
                        value={newCercania}
                        onChange={e => setNewCercania(e.target.value as any)}
                      >
                        <option value="nucleo">Núcleo</option>
                        <option value="cercana">Cercana</option>
                        <option value="orbita">Órbita</option>
                      </select>
                    </div>
                  )}

                  {selectedDoorId !== 'personas' && (
                    <div className="form-group flex-1">
                      <label className="form-label">Relevancia</label>
                      <select
                        className="input-field"
                        value={newPeso}
                        onChange={e => setNewPeso(Number(e.target.value) as any)}
                      >
                        <option value="1">Normal</option>
                        <option value="3">{selectedDoorId === 'tareas' ? 'Urgente' : 'Destacado'}</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Guardar
                  </button>
                </div>
              </form>
            )}

            <div className="door-viewport">


              {isVelado ? (
                <div className="velado-container animate-fade-in">
                  <div className="velado-overlay">
                    <Icons.Lock size={32} className="text-purple" style={{ marginBottom: 12 }} />
                    <h2 className="velado-title font-serif">Esta puerta está velada</h2>
                    <p className="velado-promise">
                      {currentDoor?.emptyPromise}
                    </p>
                    <button 
                      className="btn btn-primary"
                      onClick={() => {
                        setChatContextItem({
                          id: `velado-${currentDoor?.id}`,
                          title: currentDoor?.title || '',
                          doorId: currentDoor?.id as any,
                          content: '',
                          createdAt: '',
                          tags: [],
                          peso: 1,
                          userId: 'user1'
                        });
                        setMobileTab('chat');
                      }}
                      style={{ marginTop: 16 }}
                    >
                      <Icons.MessageSquare size={16} />
                      <span>Hablar con Kyma de esto</span>
                    </button>
                  </div>

                  <div className={`velado-blur-content grid-layout ${isCompactView ? 'compact-layout' : ''}`}>
                    <div className={`card ${isCompactView ? 'card-compact' : ''}`}>
                      <h3 className="card-title">Ejemplo Velado</h3>
                      {!isCompactView && <p>Información oculta que emergerá con el tiempo...</p>}
                    </div>
                    <div className={`card ${isCompactView ? 'card-compact' : ''}`}>
                      <h3 className="card-title">Otro Elemento</h3>
                      {!isCompactView && <p>Información oculta que emergerá con el tiempo...</p>}
                    </div>
                  </div>
                </div>
              ) : selectedDoorId === 'configuracion' ? (
                <div className="configuracion-section animate-fade-in" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '24px',
                  maxWidth: '800px',
                  margin: '0 auto',
                  padding: '10px 0 40px 0'
                }}>
                  <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
                      <Icons.User size={20} className="text-purple" />
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>Datos de Contexto Personal</h3>
                    </div>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      Los datos básicos que le permiten a Kyma comunicarse contigo de forma natural y contextualizar tus momentos. Puedes editarlos directamente aquí o conversarlos con Kyma en el chat para que los anote sola.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '8px' }}>
                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label className="form-label">Nombre (para Kyma)</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          value={userProfile.nombre} 
                          onChange={e => handleUpdateUserProfile({ nombre: e.target.value })}
                          placeholder="Tu nombre..."
                        />
                      </div>

                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label className="form-label">Edad</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          value={userProfile.edad} 
                          onChange={e => handleUpdateUserProfile({ edad: e.target.value })}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (!val) return;
                            
                            // 1. Check for 4-digit birth year (e.g. 1980)
                            if (/^\b(19\d{2}|20[0-2]\d)\b$/.test(val)) {
                              const calculated = new Date().getFullYear() - parseInt(val);
                              handleUpdateUserProfile({ edad: String(calculated) });
                            }
                            // 2. Check for DD/MM/YYYY or DD-MM-YYYY format
                            const dateMatch = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                            if (dateMatch) {
                              const day = parseInt(dateMatch[1]);
                              const month = parseInt(dateMatch[2]) - 1;
                              const year = parseInt(dateMatch[3]);
                              const now = new Date();
                              let calculated = now.getFullYear() - year;
                              const currentMonth = now.getMonth();
                              const currentDay = now.getDate();
                              if (currentMonth < month || (currentMonth === month && currentDay < day)) {
                                calculated--;
                              }
                              handleUpdateUserProfile({ edad: String(calculated) });
                            }
                            // 3. Check for YYYY-MM-DD ISO format
                            const isoMatch = val.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
                            if (isoMatch) {
                              const year = parseInt(isoMatch[1]);
                              const month = parseInt(isoMatch[2]) - 1;
                              const day = parseInt(isoMatch[3]);
                              const now = new Date();
                              let calculated = now.getFullYear() - year;
                              const currentMonth = now.getMonth();
                              const currentDay = now.getDate();
                              if (currentMonth < month || (currentMonth === month && currentDay < day)) {
                                calculated--;
                              }
                              handleUpdateUserProfile({ edad: String(calculated) });
                            }
                          }}
                          placeholder="ej: 34 o 1980"
                        />
                      </div>

                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label className="form-label">Lugar de Residencia</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          value={userProfile.lugarResidencia} 
                          onChange={e => handleUpdateUserProfile({ lugarResidencia: e.target.value })}
                          placeholder="ej: Mahón, Menorca"
                        />
                      </div>

                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label className="form-label">Idioma Preferido</label>
                        <select 
                          className="input-field" 
                          value={userProfile.idioma} 
                          onChange={e => handleUpdateUserProfile({ idioma: e.target.value })}
                        >
                          <option value="Español">Español</option>
                          <option value="English">English</option>
                          <option value="Català">Català</option>
                          <option value="Galego">Galego</option>
                          <option value="Euskara">Euskara</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* CONFIANZA EN KYMA PANEL */}
                  <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
                      <Icons.Award size={20} className="text-purple" />
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>Confianza en Kyma</h3>
                    </div>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      Métrica de precisión calculada a partir de tus confirmaciones y descartes de fichas sugeridas.
                    </p>

                    {(() => {
                      const now = Date.now();
                      const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
                      const recentLogs = trustLogs.filter(l => (now - new Date(l.timestamp).getTime()) <= oneMonthMs);
                      const confirms = recentLogs.filter(l => l.action === 'confirm').length;
                      const discards = recentLogs.filter(l => l.action === 'discard').length;
                      const total = confirms + discards;
                      const percentage = total > 0 ? Math.round((confirms / total) * 100) : 100;

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px 8px', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Confirmadas</span>
                              <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10b981' }}>{confirms}</span>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px 8px', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Descartadas</span>
                              <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#ef4444' }}>{discards}</span>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px 8px', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Confianza</span>
                              <span style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-purple-light, #c084fc)' }}>{percentage}%</span>
                            </div>
                          </div>
                          
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                            Datos de los últimos 30 días
                          </div>

                          {/* AUTO-APPROVAL TOGGLE SWITCH */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '12px', padding: '14px 18px', marginTop: '4px' }}>
                            <div>
                              <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#ffffff', display: 'block' }}>Aprobar sugerencias automáticamente</span>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Si se activa, Kyma guardará las sugerencias directamente como confirmadas sin solicitar validación previa.</span>
                            </div>
                            <button 
                              className={`btn ${userProfile.autoApprove ? 'btn-primary' : 'btn-secondary'}`}
                              onClick={() => handleUpdateUserProfile({ autoApprove: !userProfile.autoApprove })}
                              style={{ padding: '8px 16px', fontSize: '0.82rem', fontWeight: 600 }}
                            >
                              {userProfile.autoApprove ? 'Activado (Confianza ciega)' : 'Desactivado (Validación manual)'}
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
                      <Icons.Shield size={20} className="text-purple" />
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>Soberanía de Datos y Exportación</h3>
                    </div>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      Tus datos te pertenecen. Puedes exportar la totalidad de tus fichas y recuerdos en un único documento estructurado en formato Markdown.
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
                      <button className="btn btn-secondary" onClick={handleExportAllData} style={{ gap: '10px', padding: '10px 18px' }}>
                        <Icons.Download size={16} />
                        <span>Exportar todo el Panel en Markdown (.md)</span>
                      </button>

                      <button className="btn btn-secondary" onClick={handleResetDb} style={{ gap: '10px', padding: '10px 18px' }}>
                        <Icons.RefreshCw size={16} />
                        <span>Restablecer y Sembrar Datos</span>
                      </button>
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
                      <Icons.Smartphone size={20} className="text-purple" />
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>Aplicación PWA y Almacenamiento Local</h3>
                    </div>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      Kyma está optimizado como PWA instalable directamente desde tu navegador. Puedes guardar tus notas y fichas en modo sin conexión y gestionar la memoria caché de tu dispositivo.
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
                      {isInstallable && (
                        <button className="btn btn-primary" onClick={promptInstall} style={{ gap: '10px', padding: '10px 18px' }}>
                          <Icons.Download size={16} />
                          <span>Instalar Kyma como aplicación</span>
                        </button>
                      )}
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => {
                          dbClient.clearLocalCache();
                          alert('Caché y cola local limpiadas correctamente. Tus datos en Supabase permanecen a salvo.');
                        }} 
                        style={{ gap: '10px', padding: '10px 18px' }}
                      >
                        <Icons.Trash2 size={16} />
                        <span>Limpiar caché y datos locales</span>
                      </button>
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
                      <Icons.Calendar size={20} className="text-purple" />
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>Integración con Google Calendar</h3>
                    </div>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      Sincroniza tus eventos de la Agenda de Kyma directamente con tu Google Calendar general. Podrás ver tus eventos programados y las nuevas tarjetas se añadirán de forma automática.
                    </p>

                    {googleEnvStatus && (!googleEnvStatus.hasClientId || !googleEnvStatus.hasClientSecret) && (
                      <div style={{ 
                        padding: '12px 16px', 
                        background: 'rgba(239, 68, 68, 0.08)', 
                        border: '1px solid rgba(239, 68, 68, 0.25)', 
                        borderRadius: '12px',
                        fontSize: '0.82rem',
                        color: '#f87171',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        marginTop: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                          <Icons.AlertTriangle size={16} />
                          <span>Variables de entorno de Google no configuradas en el servidor</span>
                        </div>
                        <div style={{ margin: 0, color: 'rgba(248, 113, 113, 0.85)', fontSize: '0.8rem', lineHeight: 1.4 }}>
                          Falta configurar:
                          <ul style={{ margin: '4px 0 0 16px', padding: 0, listStyleType: 'disc' }}>
                            {!googleEnvStatus.hasClientId && <li><code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code></li>}
                            {!googleEnvStatus.hasClientSecret && <li><code>GOOGLE_CLIENT_SECRET</code></li>}
                          </ul>
                          <p style={{ marginTop: '8px', marginBottom: 0 }}>
                            Por favor, entra a tu panel de **Vercel ➔ Settings ➔ Environment Variables**, agrégalas y haz un **Redeploy** de la app.
                          </p>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {googleCalendarConnected ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '0.88rem', fontWeight: 500 }}>
                              <Icons.CheckCircle size={16} />
                              <span>Google Calendar Conectado</span>
                            </div>
                            <button 
                              className="btn btn-secondary" 
                              onClick={handleDisconnectGoogleCalendar} 
                              style={{ padding: '8px 14px', fontSize: '0.8rem' }}
                            >
                              Desconectar
                            </button>
                          </>
                        ) : (
                          <button 
                            className="btn btn-primary" 
                            onClick={handleConnectGoogleCalendar} 
                            style={{ gap: '8px', padding: '10px 16px' }}
                          >
                            <Icons.Calendar size={16} />
                            <span>Conectar Google Calendar</span>
                          </button>
                        )}
                      </div>

                      {googleCalendarConnected && (
                        <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px' }}>
                          <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ffffff', marginBottom: '8px' }}>
                            Mis Calendarios activos:
                          </h4>
                          {loadingGoogleCalendars ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                              <Icons.Loader className="animate-spin" size={12} />
                              <span>Recuperando calendarios de Google...</span>
                            </div>
                          ) : googleCalendars.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto', paddingRight: '4px' }}>
                              {googleCalendars.map((cal) => {
                                const isChecked = selectedCalendarIds.includes(cal.id) || 
                                  (selectedCalendarIds.length === 0 && cal.primary);
                                return (
                                  <label 
                                    key={cal.id} 
                                    style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '8px', 
                                      padding: '6px 10px', 
                                      borderRadius: '8px', 
                                      background: 'rgba(255, 255, 255, 0.01)',
                                      border: `1px solid ${isChecked ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)'}`,
                                      cursor: 'pointer',
                                      fontSize: '0.8rem',
                                      color: isChecked ? '#ffffff' : 'var(--text-secondary)',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    <input 
                                      type="checkbox" 
                                      checked={isChecked}
                                      onChange={() => handleToggleCalendar(cal.id)}
                                      style={{ accentColor: 'var(--accent-purple)', cursor: 'pointer' }}
                                    />
                                    <div style={{ 
                                      width: '8px', 
                                      height: '8px', 
                                      borderRadius: '50%', 
                                      background: cal.backgroundColor || 'var(--accent-purple)',
                                      flexShrink: 0 
                                    }} />
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {cal.summary} {cal.primary && '(Principal)'}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              No se encontraron calendarios. Asegúrate de tener al menos un calendario activo en tu cuenta.
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid rgba(239, 68, 68, 0.25)', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
                      <Icons.UserX size={20} style={{ color: '#ef4444' }} />
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>Cuenta y Sesión</h3>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255, 255, 255, 0.02)', padding: '12px 16px', borderRadius: '12px' }}>
                      {user?.user_metadata?.avatar_url ? (
                        <img src={user?.user_metadata?.avatar_url} alt="Avatar" style={{ width: '42px', height: '42px', borderRadius: '50%' }} />
                      ) : (
                        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                          <Icons.User size={20} />
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }}>{userProfile.nombre || user?.user_metadata?.full_name || 'Usuario Kyma'}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user?.email}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <button 
                        className="btn btn-secondary flex-1" 
                        onClick={() => supabase.auth.signOut()}
                        style={{ gap: '8px', justifyContent: 'center', padding: '10px 16px' }}
                      >
                        <Icons.LogOut size={16} />
                        <span>Cerrar Sesión</span>
                      </button>

                      <button 
                        className="btn btn-danger flex-1" 
                        onClick={async () => {
                          if (confirm('⚠️ ¿BORRAR CUENTA COMPLETAMENTE?\n\nEsta acción es definitiva. Eliminará tu cuenta de usuario de Supabase Auth, borrando instantáneamente en cascada todas tus notas, tareas, agenda, intereses, personas y historial de chat. No podrás recuperar esta información.\n\n¿Quieres proceder con la eliminación?')) {
                            try {
                              await dbClient.deleteAccount();
                            } catch (err) {
                              console.error(err);
                              alert('Error al borrar la cuenta.');
                            }
                          }
                        }}
                        style={{ gap: '8px', justifyContent: 'center', padding: '10px 16px' }}
                      >
                        <Icons.UserX size={16} />
                        <span>Borrar Cuenta Permanentemente</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : selectedDoorId === 'busqueda' ? (
                <div className="busqueda-section animate-fade-in" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '24px',
                  maxWidth: '900px',
                  margin: '0 auto',
                  padding: '10px 0 40px 0'
                }}>
                  <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                      <Icons.Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input 
                        type="text"
                        className="input-field"
                        placeholder="Busca cualquier recuerdo, tarea, persona, fecha o tag..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        autoFocus
                        style={{ paddingLeft: '48px', paddingRight: searchQuery ? '44px' : '16px', fontSize: '1rem', height: '48px', borderRadius: '12px' }}
                      />
                      {searchQuery && (
                        <button 
                          onClick={() => setSearchQuery('')} 
                          style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                        >
                          <Icons.X size={18} />
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: '4px' }}>Filtrar por puerta:</span>
                      <button 
                        className={`btn btn-secondary ${searchDoorFilter === null ? 'active' : ''}`}
                        onClick={() => setSearchDoorFilter(null)}
                        style={{ padding: '4px 12px', fontSize: '0.78rem', borderRadius: '20px' }}
                      >
                        Todas
                      </button>
                      {DOOR_MODULES.map(door => (
                        <button 
                          key={door.id}
                          className={`btn btn-secondary ${searchDoorFilter === door.id ? 'active' : ''}`}
                          onClick={() => setSearchDoorFilter(searchDoorFilter === door.id ? null : door.id)}
                          style={{ padding: '4px 12px', fontSize: '0.78rem', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          {renderIcon(door.icon, 12)}
                          <span>{door.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Search Results */}
                  {(() => {
                    const q = searchQuery.trim().toLowerCase();
                    const results = items.filter(item => {
                      if (searchDoorFilter && item.doorId !== searchDoorFilter) return false;
                      if (!q) return true;
                      const inTitle = item.title.toLowerCase().includes(q);
                      const inContent = item.content.toLowerCase().includes(q);
                      const inTags = item.tags.some(t => t.toLowerCase().includes(q));
                      const inLugar = (item.lugar || '').toLowerCase().includes(q);
                      return inTitle || inContent || inTags || inLugar;
                    });

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                          <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                            {q ? `Resultados para "${searchQuery}"` : 'Todos tus elementos'} ({results.length})
                          </span>
                        </div>

                        {results.length === 0 ? (
                          <div className="glass-panel" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', borderRadius: '16px' }}>
                            <Icons.Search size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                            <p>No se han encontrado elementos que coincidan con tu búsqueda.</p>
                          </div>
                        ) : (
                          <div className={`grid-layout ${isCompactView ? 'compact-layout' : ''}`}>
                            {results.map(item => (
                              <ItemCard
                                key={item.id}
                                item={item}
                                isCompact={isCompactView}
                                onClick={(clickedItem) => setSelectedItem(clickedItem)}
                                onAskKyma={(item, e) => handleAskKyma(item, e)}
                                onToggleComplete={item.doorId === 'tareas' ? handleToggleComplete : undefined}
                                onConfirmItem={(item, e) => handleConfirmItem(item, e)}
                                onDiscardItem={(item, e) => handleDiscardItem(item, e)}
                                onTagSelect={(tag) => setSelectedTag(tag)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : selectedDoorId === 'ayuda' ? (
                <div className="ayuda-section animate-fade-in" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '24px',
                  maxWidth: '800px',
                  margin: '0 auto',
                  padding: '10px 0 40px 0'
                }}>
                  <div className="glass-panel" style={{ padding: '28px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '14px' }}>
                      <Icons.HelpCircle size={24} className="text-purple" />
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>Guía y Consejos de uso de Kyma</h2>
                    </div>

                    <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                      Kyma es tu espejo inteligente y espacio de autoconocimiento. Diseñado para acompañarte sin juzgarte, organizando de forma fluida tus ideas, tareas, vínculos afectivos y recuerdos.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '12px' }}>
                      <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-purple)', fontWeight: 600, fontSize: '0.9rem' }}>
                          <Icons.MessageSquare size={16} />
                          <span>Conversa naturalmente</span>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                          Háblale a Kyma de lo que has vivido hoy, de tus proyectos o emociones. Kyma extraerá automáticamente los momentos relevantes a su puerta correspondiente.
                        </p>
                      </div>

                      <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-purple)', fontWeight: 600, fontSize: '0.9rem' }}>
                          <Icons.Sparkles size={16} />
                          <span>Actualizaciones en vivo</span>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                          Si en la conversación dices algo como <em>"Nací el 11 de agosto de 1980"</em> o <em>"Me llamo María"</em>, Kyma calculará y actualizará tu perfil de configuración en tiempo real.
                        </p>
                      </div>

                      <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-purple)', fontWeight: 600, fontSize: '0.9rem' }}>
                          <Icons.Sliders size={16} />
                          <span>Ecualizador emocional</span>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                          En la Estela de Vida puedes asignar 5 tonos emocionales a tus hitos (desde "Muy triste" en azul hasta "Muy alegre" en magenta) para ver su resplandor en la línea de tiempo.
                        </p>
                      </div>

                      <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-purple)', fontWeight: 600, fontSize: '0.9rem' }}>
                          <Icons.Layers size={16} />
                          <span>Modos de visión alternativos</span>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                          Explora tus Vínculos e Intereses en vista de Órbitas, tu Agenda en vista de Calendario, y tu Estela de vida en vista de Línea de tiempo horizontal.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="empty-utility-state animate-fade-in">
                  {renderIcon(currentDoor?.icon || '', 32, "text-muted")}
                  <p>{currentDoor?.emptyPromise}</p>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setShowAddForm(true)}
                    title="Añadir el primero"
                    style={{ width: '38px', height: '38px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icons.Plus size={16} />
                  </button>
                </div>
              ) : selectedDoorId === 'personas' && personasViewMode === 'orbits' ? (
                <OrbitsView 
                  people={filteredItems.filter(p => {
                    const closeness = p.cercania || 'orbita';
                    if (closeness === 'nucleo') return personasShowNucleo;
                    if (closeness === 'cercana') return personasShowCercana;
                    return personasShowOrbita;
                  })}
                  scale={personasOrbitsScale}
                  onPersonClick={(person) => handleSelectItem(person)}
                />
              ) : selectedDoorId === 'intereses' && interesesViewMode === 'orbits' ? (
                <InterestsMapView 
                  interests={filteredItems}
                  onInterestClick={(interest) => handleSelectItem(interest)}
                  onTagSelect={setSelectedTag}
                />
              ) : selectedDoorId === 'agenda' && agendaViewMode === 'calendar' ? (
                <CalendarView 
                  items={filteredItems}
                  googleCalendarConnected={googleCalendarConnected}
                  googleEvents={googleCalendarConnected ? googleEvents : []}
                  onItemClick={(item) => handleSelectItem(item)}
                  onAskKyma={(item, e) => handleAskKyma(item, e)}
                  onConfirmItem={(item, e) => handleConfirmItem(item, e)}
                  onDiscardItem={(item, e) => handleDiscardItem(item, e)}
                  onTagSelect={(tag) => setSelectedTag(tag)}
                />
              ) : selectedDoorId === 'estela' && estelaViewMode === 'timeline' ? (
                <EstelaHorizontalTimelineView
                  items={filteredItems}
                  sortAsc={estelaSortAsc}
                  onItemClick={(item) => handleSelectItem(item)}
                  pxPerYear={estelaTimelineScale}
                />
              ) : selectedDoorId === 'estela' ? (
                <EstelaTimelineView
                  items={filteredItems}
                  isCompact={isCompactView}
                  sortAsc={estelaSortAsc}
                  onItemClick={(item) => handleSelectItem(item)}
                  onAskKyma={(item, e) => handleAskKyma(item, e)}
                  onTagSelect={(tag) => setSelectedTag(tag)}
                  onConfirmItem={(item, e) => handleConfirmItem(item, e)}
                  onDiscardItem={(item, e) => handleDiscardItem(item, e)}
                />
              ) : (
                (() => {
                  const displayItems = (() => {
                    if (selectedDoorId === 'agenda' && googleCalendarConnected) {
                      const virtualGoogleItems = googleEvents.map(evt => {
                        const dateStr = (evt.start.dateTime || evt.start.date).split('T')[0];
                        const timeStr = evt.start.dateTime ? evt.start.dateTime.split('T')[1]?.substring(0, 5) : undefined;
                        const rawName = evt.organizer?.displayName || (evt.organizer?.email ? evt.organizer.email.split('@')[0] : 'Google');
                        const organizerName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
                        return {
                          id: `google-${evt.id}`,
                          userId: '',
                          doorId: 'agenda' as const,
                          title: evt.summary || '(Sin título)',
                          content: evt.description || '',
                          eventDate: dateStr,
                          eventTime: timeStr,
                          origen: 'google_calendar' as const,
                          tags: ['Google Calendar'],
                          completed: false,
                          peso: 1 as const,
                          createdAt: evt.created || new Date().toISOString(),
                          organizerName: organizerName
                        };
                      });
                      
                      return [...filteredItems, ...virtualGoogleItems].sort((a, b) => {
                        const dateA = a.eventDate || '';
                        const dateB = b.eventDate || '';
                        const dateCompare = dateA.localeCompare(dateB);
                        if (dateCompare !== 0) return dateCompare;
                        
                        const timeA = a.eventTime || '00:00';
                        const timeB = b.eventTime || '00:00';
                        return timeA.localeCompare(timeB);
                      });
                    }
                    return filteredItems;
                  })();

                  return (
                    <div className={`grid-layout ${isCompactView ? 'compact-layout' : ''} animate-fade-in`}>
                      {displayItems.map(item => {
                        if (item.origen === 'google_calendar') {
                          const startDate = item.eventDate ? new Date(item.eventDate + 'T00:00:00') : new Date();
                          const formattedDate = startDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).toUpperCase();
                          return (
                            <div 
                              key={item.id} 
                              className="google-event-text-item"
                              style={{
                                padding: '10px 16px',
                                background: 'transparent',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '12px',
                                gridColumn: '1 / -1'
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                                <h4 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center' }}>
                                  <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>•</span>
                                  {item.title}
                                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '8px' }}>
                                    ({(item as any).organizerName || 'Google'})
                                  </span>
                                </h4>
                                {item.content && (
                                  <p style={{ margin: '2px 0 0 14px', fontSize: '0.84rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {item.content}
                                  </p>
                                )}
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{item.eventTime || 'Todo el día'}</span>
                                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)', minWidth: '60px', textAlign: 'right' }}>{formattedDate}</span>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <ItemCard
                            key={item.id}
                            item={item}
                            isCompact={isCompactView}
                            onClick={(clickedItem) => handleSelectItem(clickedItem)}
                            onAskKyma={(item, e) => handleAskKyma(item, e)}
                            onToggleComplete={selectedDoorId === 'tareas' ? handleToggleComplete : undefined}
                            onConfirmItem={(item, e) => handleConfirmItem(item, e)}
                            onDiscardItem={(item, e) => handleDiscardItem(item, e)}
                            onTagSelect={(tag) => setSelectedTag(tag)}
                          />
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        )}
      </main>

      {/* DIVIDER HANDLE */}
      <div className={`chat-divider-bar state-${chatState}`}>
        <div className="divider-line" />
        <div 
          className="handle-container"
          onClick={chatState === 'hidden' ? () => setChatState('normal') : undefined}
          style={chatState === 'hidden' ? { cursor: 'pointer' } : undefined}
          title={chatState === 'hidden' ? "Mostrar chat" : undefined}
        >
          {chatState === 'hidden' ? (
            <button 
              type="button"
              className="handle-btn-docked" 
              onClick={() => setChatState('normal')}
              title="Mostrar chat"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: 'inherit',
                width: '100%',
                height: '100%'
              }}
            >
              <Icons.ChevronLeft size={14} className="handle-btn-icon" />
              <LogoIcon size={18} className="docked-logo-icon" />
            </button>
          ) : (
            <>
              {(chatState === 'normal') && (
                <div className="handle-btn-wrapper">
                  <button 
                    type="button"
                    className="handle-btn btn-left" 
                    onClick={() => setChatState('expanded')}
                    title="Expandir chat a pantalla completa"
                  >
                    <Icons.ChevronLeft size={14} />
                  </button>
                </div>
              )}
              {(chatState === 'normal' || chatState === 'expanded') && (
                <button 
                  type="button"
                  className="handle-btn btn-right" 
                  onClick={() => setChatState(chatState === 'expanded' ? 'normal' : 'hidden')}
                  title={chatState === 'expanded' ? "Restaurar tamaño del chat" : "Ocultar chat"}
                >
                  <Icons.ChevronRight size={14} />
                </button>
              )}
            </>
          )}
        </div>

      </div>

      {/* 3. COLUMNA CHAT DE KYMA */}
      <section className={`chat-pane state-${chatState} ${mobileTab === 'chat' ? 'mobile-visible' : 'mobile-hidden'}`}>
        <KymaChat
          contextItem={chatContextItem}
          onClearContext={() => setChatContextItem(null)}
          onItemAddedOrModified={handleItemAddedOrModified}
          onUserProfileUpdated={(updatedProf) => setUserProfile(updatedProf)}
          onMessageSent={() => setMobileTab('chat')}
        />
      </section>



      {/* 5. DETALLE MODAL */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSave={() => {
            refreshItems();
            setSelectedItem(null);
          }}
          onDelete={() => {
            const deletedTitle = selectedItem?.title || 'Ficha';
            refreshItems();
            setSelectedItem(null);
            setUndoToast({ show: true, title: deletedTitle });
          }}
          onAskKyma={(item) => handleAskKyma(item)}
        />
      )}

      {/* UNDO TOAST NOTIFICATION WINDOW */}
      {undoToast && undoToast.show && (
        <div className="toast-notification">
          <div className="toast-content">
            <div className="toast-icon-wrapper">
              <LogoIcon size={16} />
            </div>
            <span className="toast-message">Ficha "{undoToast.title}" eliminada</span>
            <button 
              className="toast-action-btn"
              onClick={async () => {
                try {
                  const restored = await dbClient.restoreLastDeletedItem();
                  if (restored) {
                    refreshItems();
                    setUndoToast(null);
                    setToastNotification({ show: true, message: `Ficha "${restored.title}" recuperada con éxito`, doorId: restored.doorId as any, item: restored });
                  }
                } catch (e) {
                  console.error('Error restaurando elemento:', e);
                }
              }}
            >
              <span>Deshacer</span>
              <Icons.RotateCcw size={14} />
            </button>
            <button 
              className="toast-close-btn"
              onClick={() => setUndoToast(null)}
            >
              <Icons.X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 7. TOAST NOTIFICATION WINDOW */}
      {toastNotification && toastNotification.show && (
        <div className="toast-notification">
          <div className="toast-content">
            <div className="toast-icon-wrapper">
              <LogoIcon size={16} />
            </div>
            <span className="toast-message">{toastNotification.message}</span>
            <button 
              className="toast-action-btn"
              onClick={() => {
                setSelectedDoorId(toastNotification.doorId);
                if (toastNotification.item) {
                  setSelectedItem(toastNotification.item);
                }
                setMobileTab('panel');
                setToastNotification(null);
              }}
            >
              <span>Ver</span>
              <Icons.ChevronRight size={14} />
            </button>
            <button 
              className="toast-close-btn"
              onClick={() => setToastNotification(null)}
            >
              <Icons.X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ESTILOS DE LAYOUT */}
      <style jsx global>{`
        /* Toast Notification Styling */
        .toast-notification {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          background: linear-gradient(135deg, rgba(26, 20, 42, 0.96) 0%, rgba(38, 22, 64, 0.96) 100%);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(139, 92, 246, 0.5);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6), 0 0 24px rgba(139, 92, 246, 0.3);
          border-radius: 14px;
          padding: 10px 16px;
          animation: toastSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes toastSlideUp {
          from {
            opacity: 0;
            transform: translate(-50%, 20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
        }

        .toast-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .toast-icon-wrapper {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.35), rgba(109, 40, 217, 0.45));
          border: 1px solid rgba(139, 92, 246, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          flex-shrink: 0;
        }

        .toast-message {
          font-size: 0.9rem;
          font-weight: 600;
          color: #f8fafc;
          white-space: nowrap;
        }

        .toast-action-btn {
          background: linear-gradient(135deg, #8b5cf6, #6d28d9);
          box-shadow: 0 2px 10px rgba(139, 92, 246, 0.4);
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 6px 14px;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s ease;
          margin-left: 4px;
        }

        .toast-action-btn:hover {
          filter: brightness(1.15);
          transform: translateY(-1px);
        }

        .toast-close-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: background 0.2s ease;
        }

        .toast-close-btn:hover {
          color: #f1f5f9;
          background: rgba(255, 255, 255, 0.1);
        }

        @media (max-width: 768px) {
          .toast-notification {
            bottom: 80px;
            width: calc(100% - 32px);
            max-width: 400px;
          }
        }

        /* Sidebar Footer and Settings styling */
        .sidebar-footer {
          width: 100%;
          border-top: none;
          padding-top: 8px;
          margin-top: auto;
        }
        .sidebar-action-bar {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-around;
          width: 100%;
          gap: 4px;
        }
        .sidebar-footer-action-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 38px;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .sidebar-footer-action-btn:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.05);
        }
        .sidebar-footer-action-btn.active {
          color: #ffffff;
          background: rgba(139, 92, 246, 0.18);
        }
        .user-profile-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          border-radius: var(--border-radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
          width: 100%;
          background: transparent;
          border: none;
          text-align: left;
        }
        .user-profile-btn:hover {
          background: var(--bg-secondary);
        }
        .user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .user-avatar-placeholder {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--bg-tertiary);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
        }
        .user-info-text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          flex: 1;
        }
        .user-name {
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .user-email {
          font-size: 0.72rem;
          color: var(--text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
        }
        .settings-gear {
          color: var(--text-secondary);
          transition: transform 0.3s ease;
        }
        .user-profile-btn:hover .settings-gear {
          transform: rotate(45deg);
          color: var(--text-primary);
        }
        
        /* Collapsed footer */
        .sidebar.collapsed .sidebar-footer {
          padding-top: 12px;
        }
        .sidebar.collapsed .sidebar-action-bar {
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .sidebar.collapsed .sidebar-footer-action-btn {
          flex: none;
          width: 38px;
        }
        .sidebar.collapsed .user-info-text,
        .sidebar.collapsed .settings-gear {
          display: none;
        }
        .sidebar.collapsed .user-profile-btn {
          justify-content: center;
          padding: 8px 0;
        }

        .app-layout {
          display: flex;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background: var(--bg-primary);
        }

        /* Sidebar Styling with Collapsible Transition */
        .sidebar {
          width: 260px;
          height: 100%;
          border-right: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          align-items: flex-start; /* Aligns all children strictly to the left axis */
          padding: 24px 16px;
          flex-shrink: 0;
          z-index: 50;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding-left 0.3s ease;
        }

        .sidebar.collapsed {
          width: 78px;
          overflow: hidden;
        }

        .sidebar-brand {
          padding: 8px 12px;
          margin-bottom: 28px;
          cursor: pointer;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          width: 100%;
          height: 36px;
          min-height: 36px;
          transition: padding-left 0.3s ease;
        }
        
        .sidebar.collapsed .sidebar-brand {
          padding-left: 8px; /* Perfectly centers the brand logo circle on the 39px axis */
        }
        
        .logo-text {
          flex-shrink: 0;
          color: var(--text-primary);
          width: 107px !important;
          height: 36px !important;
        }
        
        .logo-letters {
          transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          opacity: 1;
        }

        .sidebar.collapsed .logo-letters {
          opacity: 0;
          pointer-events: none;
        }

        .logo-icon-mobile {
          display: none;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 24px;
          flex: 1;
          overflow: hidden;
          width: 100%;
        }

        .nav-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: var(--border-radius-md);
          color: var(--text-secondary);
          background: transparent;
          border: 1px solid transparent; /* Avoid layout shifting */
          font-size: 1.05rem;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
          width: 100%;
          overflow: hidden;
          white-space: nowrap;
        }

        .nav-item svg {
          flex-shrink: 0;
        }

        .nav-item:hover {
          background: var(--bg-secondary);
          color: var(--text-primary);
        }

        .nav-item.active {
          background: rgba(139, 92, 246, 0.12);
          color: var(--text-primary);
        }

        .nav-item.active svg {
          color: var(--accent-purple) !important;
          filter: drop-shadow(0 0 4px rgba(139, 92, 246, 0.45));
        }

        .nav-item span {
          transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          opacity: 1;
        }

        .sidebar.collapsed .nav-item span {
          opacity: 0;
          pointer-events: none;
        }

        .item-count {
          margin-left: auto;
          font-size: 0.72rem;
          background: rgba(252, 252, 253, 0.08);
          color: var(--text-secondary);
          padding: 2px 6px;
          border-radius: 9999px;
          transition: opacity 0.2s ease;
          opacity: 1;
        }

        .item-locked {
          opacity: 0.6;
        }
        .lock-icon {
          margin-left: auto;
          color: var(--text-muted);
          transition: opacity 0.2s ease;
          opacity: 1;
        }

        .sidebar.collapsed .item-count,
        .sidebar.collapsed .lock-icon {
          opacity: 0;
          pointer-events: none;
        }


        /* Content pane Layout */
        .content-pane {
          flex: 1;
          height: 100%;
          overflow-y: auto;
          padding: 32px;
          display: flex;
          flex-direction: column;
          z-index: 10;
          transition: flex 0.4s cubic-bezier(0.4, 0, 0.2, 1), 
                      width 0.4s cubic-bezier(0.4, 0, 0.2, 1), 
                      padding 0.4s cubic-bezier(0.4, 0, 0.2, 1), 
                      opacity 0.3s ease;
          opacity: 1;
        }
        
        .content-pane.no-scroll {
          overflow-y: hidden !important;
          overflow: hidden !important;
          flex: 1 !important;
          min-height: 0 !important;
          padding: 16px 24px 0 24px !important;
        }
        
        .mobile-header {
          display: none;
        }

        /* Home View Styles */
        .home-view {
          display: flex;
          flex-direction: column;
          gap: 40px;
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
          padding-top: 20px;
        }
        
        .home-hero {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .serif-title {
          font-size: 3rem;
          font-weight: 500;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }
        .hero-subtitle {
          font-size: 1.15rem;
          color: var(--text-secondary);
          max-width: 600px;
          line-height: 1.6;
        }

        .home-dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 20px;
        }
        
        .home-card {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: var(--border-radius-md);
          padding: 24px;
          cursor: pointer;
          transition: all 0.25s ease;
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-height: 160px;
        }
        .home-card:hover {
          border-color: var(--border-focus);
          background: var(--bg-card-hover);
          transform: translateY(-2px);
        }
        
        .home-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .home-card-header h3 {
          font-family: var(--font-noto), var(--font-sans), sans-serif;
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        
        .home-card-text {
          font-size: 0.88rem;
          line-height: 1.5;
        }

        .home-card-preview {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .preview-title {
          font-family: var(--font-noto), var(--font-sans), sans-serif;
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .preview-snippet {
          font-size: 0.82rem;
          color: var(--text-secondary);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .home-card-locked {
          opacity: 0.65;
          background: rgba(8, 8, 10, 0.3);
        }
        
        /* Door specific Layout */
        .door-view {
          display: flex;
          flex-direction: column;
          gap: 28px;
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
          padding-top: 10px;
        }

        .door-view.full-width-door-view {
          max-width: 100% !important;
          margin: 0 !important;
          flex: 1 !important;
          height: 100% !important;
          min-height: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 12px !important;
        }

        .full-width-door-view .door-viewport {
          flex: 1 !important;
          height: 100% !important;
          min-height: 0 !important;
          display: flex !important;
          flex-direction: column !important;
        }

        .door-header {
          display: flex;
          flex-direction: column;
          width: 100%;
          gap: 12px;
        }

        .door-header-main-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          gap: 16px;
          flex-wrap: nowrap;
        }

        .door-header-title-group {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 1;
          min-width: 0;
        }

        .door-controls {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .circular-back-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-primary);
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }
        .circular-back-btn:hover {
          background: var(--bg-card-hover);
          border-color: var(--border-focus);
        }
        .back-to-home-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          color: var(--text-secondary);
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px 4px;
        }
        .back-to-home-btn:hover {
          color: var(--text-primary);
        }
        
        .door-title {
          font-size: 2.2rem;
          font-weight: 500;
          display: flex;
          align-items: center;
        }
        .inline-icon {
          margin-right: 12px;
        }

        .view-mode-selector {
          background: var(--bg-secondary);
          padding: 4px;
          border-radius: var(--border-radius-md);
          border: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .view-mode-selector .radio-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          border-radius: var(--border-radius-sm);
          transition: all 0.2s ease;
        }
        .view-mode-selector .radio-label:hover {
          color: var(--text-primary);
        }
        .view-mode-selector .radio-label.active {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          box-shadow: var(--shadow-sm);
        }
        .view-mode-selector .radio-label svg {
          color: inherit;
        }

        /* Quick Add Form */
        .quick-add-form {
          border: 1px solid var(--border-focus);
          animation: slideDown 0.25s ease-out;
        }
        
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 8px;
        }

        /* Door Grid Viewport */
        .door-viewport {
          min-height: 300px;
          display: flex;
          flex-direction: column;
        }

        .grid-layout {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
          gap: 20px;
          align-items: start;
        }

        .grid-layout.compact-layout {
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .card.card-compact {
          padding: 10px 16px;
        }

        /* Empty states */
        .empty-utility-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 60px 24px;
          text-align: center;
          background: rgba(20, 20, 23, 0.4);
          border-radius: var(--border-radius-lg);
          border: 1px dashed var(--border-subtle);
          color: var(--text-secondary);
          flex: 1;
        }
        .empty-utility-state p {
          max-width: 400px;
          line-height: 1.5;
        }

        /* Chat Pane with state transitions */
        .chat-pane {
          width: 400px;
          height: 100%;
          padding: 24px 20px 24px 16px;
          border-left: 1px solid var(--border-subtle);
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1), 
                      padding 0.4s cubic-bezier(0.4, 0, 0.2, 1), 
                      opacity 0.3s ease,
                      border-color 0.4s ease;
          opacity: 1;
          overflow: hidden;
        }

        @media (min-width: 769px) {
          .chat-pane.state-expanded {
            flex: 1;
            width: auto;
          }

          .chat-pane.state-hidden {
            width: 0px;
            padding-left: 0;
            padding-right: 0;
            opacity: 0;
            pointer-events: none;
          }

          .content-pane.pane-hidden {
            flex: 0 0 0px;
            width: 0px;
            padding: 0;
            overflow: hidden;
            opacity: 0;
            pointer-events: none;
          }
        }

        /* Divider Bar container */
        .chat-divider-bar {
          position: relative;
          width: 0px;
          height: 100%;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .divider-line {
          position: absolute;
          top: 0;
          bottom: 0;
          left: -0.5px;
          width: 1px;
          background: var(--border-subtle);
          transition: background 0.3s ease;
        }
        
        .chat-divider-bar:hover .divider-line {
          background: var(--border-focus);
        }

        .chat-divider-bar::before {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          left: -6px;
          width: 12px;
          cursor: pointer;
          z-index: -1;
        }

        /* Handle container */
        .handle-container {
          position: absolute;
          display: flex;
          flex-direction: column;
          gap: 6px;
          background: var(--bg-primary);
          border: 1px solid var(--border-subtle);
          border-radius: 20px;
          padding: 6px 3px;
          box-shadow: var(--shadow-md);
          opacity: 0.6;
          transition: all 0.25s ease;
        }
        
        .chat-divider-bar:hover .handle-container {
          opacity: 1;
          border-color: var(--border-focus);
          background: var(--bg-secondary);
          transform: scale(1.05);
        }

        /* Adjustments for docked hidden state on the right edge */
        .chat-divider-bar.state-hidden .handle-container {
          right: 0px;
          border-right: none;
          border-radius: 20px 0 0 20px;
          padding: 6px 6px 6px 8px;
          opacity: 0.95;
          border-color: rgba(139, 92, 246, 0.4);
          box-shadow: 0 0 10px rgba(139, 92, 246, 0.2);
        }

        .handle-btn-wrapper {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .docked-logo-icon {
          color: var(--text-primary);
          margin-right: 2px;
          flex-shrink: 0;
          opacity: 0.9;
          transition: transform 0.2s ease;
        }

        .chat-divider-bar.state-hidden:hover .docked-logo-icon {
          transform: rotate(15deg);
        }

        .chat-divider-bar.state-hidden .handle-btn {
          color: var(--text-primary);
        }

        .chat-divider-bar.state-hidden:hover .handle-container {
          transform: scale(1.08) translateX(-2px);
          border-color: var(--accent-purple);
          box-shadow: 0 0 15px rgba(139, 92, 246, 0.35);
        }

        .chat-divider-bar.state-hidden::before {
          left: -20px;
          width: 20px;
        }

        .handle-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          transition: all 0.2s ease;
        }

        .handle-btn:hover {
          color: var(--text-primary);
          background: var(--bg-tertiary);
        }

        @media (max-width: 768px) {
          .chat-divider-bar {
            display: none !important;
          }
        }

        /* Mobile specific elements */
        .mobile-tab-bar {
          display: none;
        }

        /* Helper colors */
        .text-purple { color: var(--accent-purple); }
        .text-secondary { color: var(--text-secondary); }
        .text-muted { color: var(--text-muted); }

        .mobile-header {
          display: none;
        }

        /* RESPONSIVE MEDIA QUERIES (Mobile and Tablet) */
        @media (max-width: 1024px) {
          .app-layout {
            flex-direction: column;
            height: 100dvh;
            height: 100vh;
            overflow: hidden;
            position: relative;
          }

          /* Header on Mobile: pinned fixed to top with Glassmorphism */
          .mobile-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            width: 100%;
            height: calc(64px + env(safe-area-inset-top, 0px));
            padding-top: env(safe-area-inset-top, 0px);
            padding-left: 16px;
            padding-right: 16px;
            background: rgba(18, 18, 20, 0.88) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
            border-radius: 0;
            flex-shrink: 0;
            z-index: 250 !important;
            box-sizing: border-box;
          }
          .menu-toggle-btn {
            background: none;
            border: none;
            color: var(--text-primary);
            cursor: pointer;
            padding: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          /* Reset sidebar width overrides on mobile: Slide from RIGHT */
          .sidebar, .sidebar.collapsed {
            width: 100% !important;
            padding: 20px 16px !important;
            position: fixed;
            top: calc(64px + env(safe-area-inset-top, 0px));
            right: 0;
            left: auto;
            height: calc(100dvh - 64px - env(safe-area-inset-top, 0px));
            background: var(--bg-primary);
            border-left: 1px solid var(--border-subtle);
            border-right: none;
            border-bottom: 1px solid var(--border-subtle);
            transform: translateX(100%);
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            z-index: 200 !important;
            overflow-y: auto;
          }
          
          .sidebar.mobile-open {
            transform: translateX(0);
          }
          
          /* Hide brand logo inside mobile menu drawer as requested */
          .sidebar .sidebar-brand {
            display: none !important;
          }

          /* Increase font size and icons of menu buttons, reduce item-count size and place inline right after text */
          .sidebar .sidebar-nav {
            gap: 8px !important;
          }
          .sidebar .nav-list {
            display: flex !important;
            flex-direction: column !important;
            gap: 4px !important;
          }
          .sidebar .nav-item {
            padding: 12px 16px !important;
            font-size: 1.35rem !important;
            border-radius: 14px !important;
            gap: 12px !important;
            margin-bottom: 2px !important;
            min-height: 52px !important;
            justify-content: flex-start !important;
          }
          .sidebar .nav-item svg {
            width: 22px !important;
            height: 22px !important;
            flex-shrink: 0 !important;
          }
          .sidebar .nav-item span {
            display: block !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            font-size: 1.35rem !important;
            font-weight: 600 !important;
          }
          .sidebar.collapsed .item-count,
          .sidebar.collapsed .lock-icon,
          .sidebar .nav-item .item-count {
            opacity: 1 !important;
            pointer-events: auto !important;
            font-size: 0.76rem !important;
            padding: 2px 7px !important;
            margin-left: 8px !important;
            margin-right: auto !important;
            border-radius: 10px !important;
            font-weight: 600 !important;
            line-height: 1 !important;
          }

          .logo-text, .logo-icon-mobile {
            display: none !important;
          }

          /* Active tab handling: Browser mode (Mobile Web Browser) */
          .content-pane {
            padding: calc(76px + env(safe-area-inset-top, 0px)) 16px 36px 16px !important;
            margin-top: 0 !important;
            height: 100dvh !important;
            height: 100vh !important;
            flex: 1;
            overflow-y: auto;
            box-sizing: border-box;
          }
          .content-pane.no-scroll {
            padding-top: calc(76px + env(safe-area-inset-top, 0px)) !important;
            padding-left: 16px !important;
            padding-right: 16px !important;
            padding-bottom: 95px !important;
          }
          .door-view {
            padding-top: 0 !important;
          }
          .door-header-main-row {
            flex-wrap: wrap !important;
            gap: 10px !important;
          }
          .content-pane.mobile-hidden {
            display: none;
          }
          .content-pane.mobile-visible {
            display: flex;
            padding-bottom: 95px !important;
          }

          .chat-pane {
            width: 100%;
            margin-top: 0 !important;
            height: 100dvh !important;
            height: 100vh !important;
            flex: 1;
            border-left: none;
            padding: 0 !important;
            overflow: hidden;
            box-sizing: border-box;
          }
          .chat-pane.mobile-hidden {
            display: flex !important;
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            top: auto !important;
            height: auto !important;
            min-height: 0 !important;
            z-index: 95 !important;
            background: #09090b !important;
            border-top: 1px solid rgba(255, 255, 255, 0.12) !important;
            padding-bottom: env(safe-area-inset-bottom, 0px) !important;
          }
          .chat-pane.mobile-hidden .chat-container {
            height: auto !important;
            min-height: 0 !important;
          }
          .chat-pane.mobile-hidden .messages-area,
          .chat-pane.mobile-hidden .clear-chat-floating-btn {
            display: none !important;
          }
          .chat-pane.mobile-visible {
            display: flex !important;
            position: fixed !important;
            top: 0 !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 100 !important;
            background: var(--bg-primary) !important;
          }

          .mic-icon-svg {
            width: 26px !important;
            height: 26px !important;
          }

          /* Hide scrollbars on mobile views */
          .content-pane, .chat-pane, .sidebar {
            -ms-overflow-style: none !important;
            scrollbar-width: none !important;
          }
          .content-pane::-webkit-scrollbar, 
          .chat-pane::-webkit-scrollbar, 
          .sidebar::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
        }

        /* INSTALLED PWA STANDALONE APP RULES (UNTOUCHED AND PRESERVED EXACTLY AS REQUESTED) */
        @media all and (display-mode: standalone) and (max-width: 1024px) {
          .content-pane {
            padding: calc(84px + env(safe-area-inset-top, 0px)) 16px 36px 16px !important;
            margin-top: 0 !important;
            height: 100dvh !important;
          }
          .chat-pane {
            margin-top: 0 !important;
            height: 100dvh !important;
          }
        }

          /* Adjust headings on mobile */
          .serif-title {
            font-size: 2.2rem !important;
          }
          .door-title {
            font-size: 2.1rem !important;
            color: var(--text-secondary, #a1a1aa) !important;
          }
          .home-section-block h2 {
            color: var(--text-muted, #8a8a93) !important;
          }
        }
      `}</style>
    </div>
  );
}
