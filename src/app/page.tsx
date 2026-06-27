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
  }>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kyma_user_profile');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return {
      nombre: '',
      edad: '',
      lugarResidencia: '',
      idioma: 'Español'
    };
  });

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
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null);
  const [items, setItems] = useState<KymaItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<KymaItem | null>(null);
  const [chatContextItem, setChatContextItem] = useState<KymaItem | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Mobile navigation state ('chat' | 'panel')
  const [mobileTab, setMobileTab] = useState<'chat' | 'panel'>('chat');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // View mode for Personas ('orbits' | 'grid')
  const [personasViewMode, setPersonasViewMode] = useState<'orbits' | 'grid'>('grid');

  // View mode for Agenda ('calendar' | 'grid')
  const [agendaViewMode, setAgendaViewMode] = useState<'calendar' | 'grid'>('grid');

  // View mode for Intereses ('orbits' | 'grid')
  const [interesesViewMode, setInteresesViewMode] = useState<'orbits' | 'grid'>('grid');

  // View mode for Estela de vida ('grid' | 'timeline')
  const [estelaViewMode, setEstelaViewMode] = useState<'grid' | 'timeline'>('grid');

  // Sort direction for Estela de vida
  const [estelaSortAsc, setEstelaSortAsc] = useState(false);

  // Tag filtering state
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Search state for Búsqueda global
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDoorFilter, setSearchDoorFilter] = useState<string | null>(null);

  // Chat view state ('normal' | 'expanded' | 'hidden')
  const [chatState, setChatState] = useState<'normal' | 'expanded' | 'hidden'>('normal');

  // Compact view state for list cards
  const [isCompactView, setIsCompactView] = useState(false);

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

  // Toast Notification state
  const [toastNotification, setToastNotification] = useState<{
    show: boolean;
    message: string;
    doorId: string;
    item?: KymaItem;
  } | null>(null);

  // Load database state and session on mount, and sync offline queue
  useEffect(() => {
    if (isOnline) {
      dbClient.syncOfflineQueue().then(() => refreshItems());
    }
  }, [isOnline]);

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      refreshItems();
      setLoadingSession(false);
    });

    // 2. Set auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        refreshItems();
      } else {
        setItems([]);
      }
      setLoadingSession(false);
    });

    setLocalDbState(getDbState());

    const handleProfileEvent = (e: any) => {
      if (e.detail) {
        setUserProfile(e.detail);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('kyma_user_profile_updated', handleProfileEvent);
    }

    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 800);

    return () => {
      subscription.unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('kyma_user_profile_updated', handleProfileEvent);
      }
      clearTimeout(timer);
    };
  }, []);

  const refreshItems = async () => {
    try {
      const dbItems = await dbClient.getItems();
      setItems(dbItems);
    } catch (e) {
      console.error('Error loading items from Supabase:', e);
    }
  };

  const handleItemAddedOrModified = async (item?: KymaItem, action?: string) => {
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

  const handleSelectDoor = (doorId: string | null) => {
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
    if (doorId) {
      setMobileTab('panel');
    } else {
      setMobileTab('chat');
    }
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
      await dbClient.updateItem(item.id, { completed: !item.completed });
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
    try {
      await dbClient.confirmItem(item.id);
      refreshItems();
    } catch (err) {
      console.error('Error al confirmar elemento:', err);
    }
  };

  const handleDiscardItem = async (item: KymaItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
    ? (selectedDoorId === 'agenda' ? expandRecurringAgendaItems(items.filter(item => item.doorId === 'agenda')) : items.filter(item => item.doorId === selectedDoorId))
    : [];

  const filteredItems = selectedDoorId 
    ? baseDoorItems
        .filter(item => !selectedTag || item.tags.includes(selectedTag))
        .filter(item => {
          if (selectedDoorId === 'agenda' && !showPastAgendaEvents) {
            const today = new Date().toISOString().split('T')[0];
            return !item.eventDate || item.eventDate >= today;
          }
          return true;
        })
        .sort((a, b) => {
          if (selectedDoorId === 'agenda') {
            const dateA = a.eventDate ? `${a.eventDate}T${a.eventTime || '00:00'}` : '9999-99-99';
            const dateB = b.eventDate ? `${b.eventDate}T${b.eventTime || '00:00'}` : '9999-99-99';
            return dateA.localeCompare(dateB);
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
          <LogoIcon size={96} className="loading-logo animate-premium-glow" />
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

      const doors = ['agenda', 'tareas', 'notas', 'intereses', 'personas', 'reflexiones'];
      const doorNames: Record<string, string> = {
        agenda: 'Agenda (Eventos)',
        tareas: 'Tareas',
        notas: 'Notas',
        intereses: 'Intereses',
        personas: 'Vínculos (Personas)',
        reflexiones: 'Reflexiones'
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
          onClick={() => handleSelectDoor(null)}
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
                    {items.filter(i => i.doorId === door.id).length}
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
      <main className={`content-pane ${chatState === 'expanded' ? 'pane-hidden' : ''} ${mobileTab === 'panel' ? 'mobile-visible' : 'mobile-hidden'} ${((selectedDoorId === 'personas' && personasViewMode === 'orbits') || (selectedDoorId === 'intereses' && interesesViewMode === 'orbits')) ? 'no-scroll' : ''}`}>
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
          <div className="home-view animate-fade-in">
            <div className="home-hero">
              <h1 className="serif-title font-serif">
                {userProfile.nombre?.trim() ? `¡Hola, ${userProfile.nombre.trim()}!` : '¡Hola!'}
              </h1>
              <p className="hero-subtitle">
                Aquí tienes un resumen con tus últimas novedades y actividad en tu espacio.
              </p>
            </div>

            <div className="home-dashboard-grid">
              {DOOR_MODULES.map(door => {
                const doorItems = items.filter(i => i.doorId === door.id);
                const isLocked = dbState === 'empty' && door.category === 'map';
                
                return (
                  <div 
                    key={door.id} 
                    className={`home-card ${isLocked ? 'home-card-locked' : ''}`}
                    onClick={() => handleSelectDoor(door.id)}
                  >
                    <div className="home-card-header">
                      {renderIcon(door.icon, 20, "text-purple")}
                      <h3>{door.title}</h3>
                      {isLocked && <Icons.Lock size={12} className="lock-icon" />}
                    </div>
                    
                    {isLocked ? (
                      <p className="home-card-text text-muted">
                        Esta puerta se abrirá a medida que hables con Kyma sobre este tema.
                      </p>
                    ) : doorItems.length > 0 ? (
                      <div className="home-card-preview">
                        <span className="preview-title">{doorItems[0].title}</span>
                        <p className="preview-snippet">{doorItems[0].content}</p>
                      </div>
                    ) : (
                      <p className="home-card-text text-secondary">
                        Sin datos guardados. Haz clic para explorarla.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="door-view animate-fade-in">
            <div className="door-header" style={{ alignItems: ((selectedDoorId === 'personas' && personasViewMode === 'orbits') || (selectedDoorId === 'intereses' && interesesViewMode === 'orbits')) ? 'flex-start' : 'center' }}>
              <div className="door-title-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                <button className="back-to-home-btn" onClick={() => handleSelectDoor(null)}>
                  <Icons.ArrowLeft size={16} />
                  <span>Volver</span>
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h1 className="door-title font-serif" style={{ margin: 0 }}>
                    {renderIcon(currentDoor?.icon || '', 24, "text-purple inline-icon")}
                    {currentDoor?.title}
                  </h1>
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
                
                {/* Inline Legend for Personas Universe View */}
                {selectedDoorId === 'personas' && personasViewMode === 'orbits' && (
                  <div className="orbits-legend-inline" style={{ display: 'flex', gap: '16px', marginTop: '4px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-purple)', boxShadow: '0 0 6px var(--accent-purple)', display: 'inline-block' }} />
                      <span>Núcleo afectivo</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text-primary)', display: 'inline-block' }} />
                      <span>Relaciones cercanas</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--border-focus)', display: 'inline-block' }} />
                      <span>Órbita / Contactos</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="door-controls" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {selectedDoorId === 'intereses' && !isVelado && (
                  <div className="view-mode-selector radio-group">
                    <button 
                      className={`radio-label ${interesesViewMode === 'grid' ? 'active' : ''}`}
                      onClick={() => setInteresesViewMode('grid')}
                    >
                      <Icons.Grid size={14} />
                      <span>Lista</span>
                    </button>
                    <button 
                      className={`radio-label ${interesesViewMode === 'orbits' ? 'active' : ''}`}
                      onClick={() => setInteresesViewMode('orbits')}
                    >
                      <Icons.Orbit size={14} />
                      <span>Universo</span>
                    </button>
                  </div>
                )}

                {selectedDoorId === 'personas' && !isVelado && (
                  <div className="view-mode-selector radio-group">
                    <button 
                      className={`radio-label ${personasViewMode === 'grid' ? 'active' : ''}`}
                      onClick={() => setPersonasViewMode('grid')}
                    >
                      <Icons.Grid size={14} />
                      <span>Lista</span>
                    </button>
                    <button 
                      className={`radio-label ${personasViewMode === 'orbits' ? 'active' : ''}`}
                      onClick={() => setPersonasViewMode('orbits')}
                    >
                      <Icons.Orbit size={14} />
                      <span>Universo</span>
                    </button>
                  </div>
                )}

                {selectedDoorId === 'agenda' && !isVelado && (
                  <div className="view-mode-selector radio-group">
                    <button 
                      className={`radio-label ${agendaViewMode === 'grid' ? 'active' : ''}`}
                      onClick={() => setAgendaViewMode('grid')}
                    >
                      <Icons.Grid size={14} />
                      <span>Lista</span>
                    </button>
                    <button 
                      className={`radio-label ${agendaViewMode === 'calendar' ? 'active' : ''}`}
                      onClick={() => setAgendaViewMode('calendar')}
                    >
                      <Icons.Calendar size={14} />
                      <span>Calendario</span>
                    </button>
                  </div>
                )}

                {selectedDoorId === 'estela' && !isVelado && (
                  <div className="view-mode-selector radio-group">
                    <button 
                      className={`radio-label ${estelaViewMode === 'grid' ? 'active' : ''}`}
                      onClick={() => setEstelaViewMode('grid')}
                    >
                      <Icons.Grid size={14} />
                      <span>Lista</span>
                    </button>
                    <button 
                      className={`radio-label ${estelaViewMode === 'timeline' ? 'active' : ''}`}
                      onClick={() => setEstelaViewMode('timeline')}
                    >
                      <Icons.GitCommit size={14} />
                      <span>Línea</span>
                    </button>
                  </div>
                )}

                {selectedDoorId === 'estela' && !isVelado && (
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setEstelaSortAsc(!estelaSortAsc)}
                    title={estelaSortAsc ? "Ordenar: Más antiguos primero" : "Ordenar: Más recientes primero"}
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
                          type="number" 
                          className="input-field" 
                          value={userProfile.edad} 
                          onChange={e => handleUpdateUserProfile({ edad: e.target.value })}
                          placeholder="ej: 34"
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

                  <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid rgba(239, 68, 68, 0.25)', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
                      <Icons.UserX size={20} style={{ color: '#ef4444' }} />
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>Cuenta y Sesión</h3>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255, 255, 255, 0.02)', padding: '12px 16px', borderRadius: '12px' }}>
                      {user?.user_metadata?.avatar_url ? (
                        <img src={user.user_metadata.avatar_url} alt="Avatar" style={{ width: '42px', height: '42px', borderRadius: '50%' }} />
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
                  people={filteredItems}
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
                  onItemClick={(item) => handleSelectItem(item)}
                />
              ) : selectedDoorId === 'estela' && estelaViewMode === 'timeline' ? (
                <EstelaHorizontalTimelineView
                  items={filteredItems}
                  sortAsc={estelaSortAsc}
                  onItemClick={(item) => handleSelectItem(item)}
                />
              ) : selectedDoorId === 'estela' ? (
                <EstelaTimelineView
                  items={filteredItems}
                  isCompact={isCompactView}
                  sortAsc={estelaSortAsc}
                  onItemClick={(item) => handleSelectItem(item)}
                  onAskKyma={(item, e) => handleAskKyma(item, e)}
                  onTagSelect={(tag) => setSelectedTag(tag)}
                />
              ) : (
                <div className={`grid-layout ${isCompactView ? 'compact-layout' : ''} animate-fade-in`}>
                  {filteredItems.map(item => (
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
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* DIVIDER HANDLE */}
      <div className={`chat-divider-bar state-${chatState}`}>
        <div className="divider-line" />
        <div className="handle-container">
          {(chatState === 'normal' || chatState === 'hidden') && (
            <div className="handle-btn-wrapper">
              <button 
                type="button"
                className="handle-btn btn-left" 
                onClick={() => setChatState(chatState === 'hidden' ? 'normal' : 'expanded')}
                title={chatState === 'hidden' ? "Mostrar chat" : "Expandir chat a pantalla completa"}
              >
                <Icons.ChevronLeft size={14} />
              </button>
              {chatState === 'hidden' && (
                <LogoIcon size={18} className="docked-logo-icon" />
              )}
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
        </div>
      </div>

      {/* 3. COLUMNA CHAT DE KYMA */}
      <section className={`chat-pane state-${chatState} ${mobileTab === 'chat' ? 'mobile-visible' : 'mobile-hidden'}`}>
        <KymaChat
          contextItem={chatContextItem}
          onClearContext={() => setChatContextItem(null)}
          onItemAddedOrModified={handleItemAddedOrModified}
          onUserProfileUpdated={(updatedProf) => setUserProfile(updatedProf)}
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
            refreshItems();
            setSelectedItem(null);
          }}
          onAskKyma={(item) => handleAskKyma(item)}
        />
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
          overflow-y: hidden;
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

        .door-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }
        .door-title-box {
          display: flex;
          flex-direction: column;
          gap: 8px;
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
            z-index: 100;
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
            z-index: 90;
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

          /* Active tab handling: Full-height underlay for translucent glass header scroll */
          .content-pane {
            padding: calc(84px + env(safe-area-inset-top, 0px)) 16px 36px 16px !important;
            margin-top: 0 !important;
            height: 100dvh !important;
            height: 100vh !important;
            flex: 1;
            overflow-y: auto;
            box-sizing: border-box;
          }
          .door-view {
            padding-top: 0 !important;
          }
          .content-pane.mobile-hidden {
            display: none;
          }
          .content-pane.mobile-visible {
            display: flex;
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
            display: none;
          }
          .chat-pane.mobile-visible {
            display: flex;
          }
        }

          /* Adjust headings */
          .serif-title {
            font-size: 2rem;
          }
          .door-title {
            font-size: 1.7rem;
          }
        }
      `}</style>
    </div>
  );
}
