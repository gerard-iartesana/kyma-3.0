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
import * as Icons from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
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

  // Toast Notification state
  const [toastNotification, setToastNotification] = useState<{
    show: boolean;
    message: string;
    doorId: string;
    item?: KymaItem;
  } | null>(null);

  // Load database state and session on mount
  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        refreshItems();
      }
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

    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 800);

    return () => {
      subscription.unsubscribe();
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

  const renderIcon = (iconName: string, size = 18, className = '') => {
    const IconComponent = (Icons as any)[iconName] || Icons.HelpCircle;
    return <IconComponent size={size} className={className} />;
  };

  const filteredItems = selectedDoorId 
    ? items
        .filter(item => item.doorId === selectedDoorId)
        .filter(item => !selectedTag || item.tags.includes(selectedTag))
        .sort((a, b) => {
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
  const currentDoor = DOOR_MODULES.find(d => d.id === selectedDoorId);
  const isVelado = currentDoor?.category === 'map' && filteredItems.length === 0;

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
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="app-layout">
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
          <div className="user-profile-btn" onClick={() => setShowSettingsModal(true)} title="Preferencias y cuenta">
            {user.user_metadata?.avatar_url ? (
              <img 
                src={user.user_metadata.avatar_url} 
                alt="Avatar" 
                className="user-avatar" 
              />
            ) : (
              <div className="user-avatar-placeholder">
                <Icons.User size={16} />
              </div>
            )}
            <div className="user-info-text">
              <span className="user-name">{user.user_metadata?.full_name || 'Usuario Kyma'}</span>
              <span className="user-email">{user.email}</span>
            </div>
            <Icons.Settings size={16} className="settings-gear" />
          </div>
        </div>
      </aside>

      {/* 2. PANEL CENTRAL */}
      <main className={`content-pane ${chatState === 'expanded' ? 'pane-hidden' : ''} ${mobileTab === 'panel' ? 'mobile-visible' : 'mobile-hidden'} ${((selectedDoorId === 'personas' && personasViewMode === 'orbits') || (selectedDoorId === 'intereses' && interesesViewMode === 'orbits')) ? 'no-scroll' : ''}`}>
        <header className="mobile-header">
          <button className="menu-toggle-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <Icons.X size={20} /> : <Icons.Menu size={20} />}
          </button>
          <div className="mobile-header-brand" onClick={() => handleSelectDoor(null)}>
            <LogoIcon size={32} />
          </div>
          <div style={{ width: 24 }} />
        </header>

        {selectedDoorId === null ? (
          <div className="home-view animate-fade-in">
            <div className="home-hero">
              <h1 className="serif-title font-serif">Hola. Soy Kyma.</h1>
              <p className="hero-subtitle">
                Tu diario interior, tu agenda y tus pensamientos en un solo panel de autoconocimiento.
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
              <div className="door-controls" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
                {!isVelado && 
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
                      marginRight: '-8px',
                      background: isCompactView ? 'rgba(139, 92, 246, 0.2)' : 'var(--bg-tertiary)',
                      borderColor: isCompactView ? 'var(--accent-purple)' : 'var(--border-subtle)',
                      color: isCompactView ? '#ffffff' : 'var(--text-secondary)'
                    }}
                  >
                    {isCompactView ? <Icons.Maximize2 size={16} /> : <Icons.Minimize2 size={16} />}
                  </button>
                )}

                {currentDoor?.category === 'utility' && !showAddForm && (
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
                  onPersonClick={(person) => setSelectedItem(person)}
                />
              ) : selectedDoorId === 'intereses' && interesesViewMode === 'orbits' ? (
                <InterestsMapView 
                  interests={filteredItems}
                  onInterestClick={(interest) => setSelectedItem(interest)}
                  onTagSelect={setSelectedTag}
                />
              ) : selectedDoorId === 'agenda' && agendaViewMode === 'calendar' ? (
                <CalendarView 
                  items={filteredItems}
                  onItemClick={(item) => setSelectedItem(item)}
                />
              ) : selectedDoorId === 'estela' && estelaViewMode === 'timeline' ? (
                <EstelaHorizontalTimelineView
                  items={filteredItems}
                  sortAsc={estelaSortAsc}
                  onItemClick={(item) => setSelectedItem(item)}
                />
              ) : selectedDoorId === 'estela' ? (
                <EstelaTimelineView
                  items={filteredItems}
                  isCompact={isCompactView}
                  sortAsc={estelaSortAsc}
                  onItemClick={(item) => setSelectedItem(item)}
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
                      onClick={(clickedItem) => setSelectedItem(clickedItem)}
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
        />
      </section>

      {/* 4. BARRA DE NAVEGACIÓN MÓVIL */}
      <nav className="mobile-tab-bar">
        <button 
          className={`tab-item ${mobileTab === 'chat' ? 'active' : ''}`}
          onClick={() => setMobileTab('chat')}
        >
          <Icons.MessageSquare size={20} />
          <span>Kyma</span>
        </button>
        
        <button 
          className={`tab-item ${mobileTab === 'panel' ? 'active' : ''}`}
          onClick={() => {
            setMobileTab('panel');
            if (selectedDoorId === null) {
              setMobileMenuOpen(true);
            }
          }}
        >
          <Icons.LayoutDashboard size={20} />
          <span>Mi Panel</span>
        </button>
      </nav>

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

      {/* 6. SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content glass-panel" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="serif-title font-serif text-white" style={{ fontSize: '1.4rem', margin: 0 }}>Preferencias e Identidad</h2>
              <button className="close-btn" onClick={() => setShowSettingsModal(false)}>
                <Icons.X size={20} />
              </button>
            </div>
            
            <div className="settings-user-card" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--border-radius-md)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '8px',
              width: '100%'
            }}>
              {user.user_metadata?.avatar_url ? (
                <img 
                  src={user.user_metadata.avatar_url} 
                  alt="Avatar" 
                  style={{ width: '48px', height: '48px', borderRadius: '50%' }}
                />
              ) : (
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)'
                }}>
                  <Icons.User size={24} />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, overflow: 'hidden' }}>
                <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', width: '100%' }}>
                  {user.user_metadata?.full_name || 'Usuario Kyma'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', width: '100%' }}>
                  {user.email}
                </span>
              </div>
            </div>

            <div className="settings-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
              <h3 style={{ fontSize: '0.88rem', color: 'var(--accent-purple)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '8px 0 4px 0', textAlign: 'left' }}>Soberanía y Privacidad</h3>
              
              <button className="btn btn-secondary" onClick={handleExportAllData} style={{ width: '100%', justifyContent: 'flex-start', gap: '10px' }}>
                <Icons.Download size={16} />
                <span>Exportar todo el Panel (.md)</span>
              </button>
              
              <button className="btn btn-secondary" onClick={handleResetDb} style={{ width: '100%', justifyContent: 'flex-start', gap: '10px' }}>
                <Icons.RefreshCw size={16} />
                <span>Restablecer y Sembrar Datos</span>
              </button>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 'var(--border-radius-md)',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.88rem',
                width: '100%'
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>Filtro de puertas de mapas:</span>
                <button 
                  className={`btn ${dbState === 'populated' ? 'btn-secondary' : 'btn-primary'}`} 
                  onClick={handleToggleDbState}
                  style={{ padding: '4px 10px', fontSize: '0.75rem', height: 'auto' }}
                >
                  {dbState === 'populated' ? 'Velar mapas' : 'Desvelar mapas'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', width: '100%' }}>
                <button 
                  className="btn btn-secondary flex-1" 
                  onClick={() => {
                    supabase.auth.signOut();
                    setShowSettingsModal(false);
                  }}
                  style={{ gap: '8px', justifyContent: 'center' }}
                >
                  <Icons.LogOut size={16} />
                  <span>Cerrar Sesión</span>
                </button>

                <button 
                  className="btn btn-danger flex-1" 
                  onClick={async () => {
                    if (confirm('¿BORRAR CUENTA COMPLETAMENTE?\n\nEsta acción es definitiva. Eliminará tu cuenta de usuario de Supabase Auth, borrando instantáneamente en cascada todas tus notas, tareas, agenda, intereses, personas y historial de chat. No podrás recuperar esta información.\n\n¿Quieres proceder con la eliminación?')) {
                      try {
                        await dbClient.deleteAccount();
                        setShowSettingsModal(false);
                      } catch (err) {
                        console.error(err);
                        alert('Error al borrar la cuenta.');
                      }
                    }
                  }}
                  style={{ gap: '8px', justifyContent: 'center' }}
                >
                  <Icons.UserX size={16} />
                  <span>Borrar Cuenta</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. TOAST NOTIFICATION WINDOW */}
      {toastNotification && toastNotification.show && (
        <div className="toast-notification">
          <div className="toast-content">
            <div className="toast-icon-wrapper">
              <Icons.Sparkles size={18} />
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
          background: rgba(22, 24, 35, 0.94);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(139, 92, 246, 0.4);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), 0 0 16px rgba(139, 92, 246, 0.2);
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
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(236, 72, 153, 0.25));
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a855f7;
          flex-shrink: 0;
        }

        .toast-message {
          font-size: 0.9rem;
          font-weight: 600;
          color: #f8fafc;
          white-space: nowrap;
        }

        .toast-action-btn {
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
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
          border-top: 1px solid var(--border-subtle);
          padding-top: 16px;
          margin-top: auto;
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
          padding: 24px 16px;
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

        /* RESPONSIVE MEDIA QUERIES (Mobile and Tablet) */
        @media (max-width: 1024px) {
          .chat-pane {
            width: 320px;
          }
        }

        @media (max-width: 768px) {
          .app-layout {
            flex-direction: column;
          }

          /* Reset sidebar width overrides on mobile */
          .sidebar, .sidebar.collapsed {
            width: 100% !important;
            padding: 24px 16px !important;
            position: fixed;
            top: 56px;
            left: 0;
            height: calc(100% - 116px);
            background: var(--bg-primary);
            border-right: none;
            border-bottom: 1px solid var(--border-subtle);
            transform: translateX(-100%);
            transition: transform 0.3s ease;
            z-index: 40;
          }
          
          .sidebar.mobile-open {
            transform: translateX(0);
          }
          
          /* Show text and counts on mobile menu even if collapsed on desktop */
          .sidebar.collapsed .nav-item span {
            display: block !important;
            opacity: 1 !important;
            pointer-events: auto !important;
          }
          .sidebar.collapsed .logo-letters {
            opacity: 1 !important;
            pointer-events: auto !important;
          }
          .sidebar.collapsed .sidebar-brand {
            padding: 8px 12px !important;
          }
          .sidebar.collapsed .item-count,
          .sidebar.collapsed .lock-icon {
            opacity: 1 !important;
            pointer-events: auto !important;
          }

          
          .logo-text {
            display: none;
          }
          .logo-icon-mobile {
            display: block;
            color: var(--text-primary);
          }

          /* Header on Mobile */
          .mobile-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 56px;
            border-bottom: 1px solid var(--border-subtle);
            padding: 0 16px;
            background: var(--bg-secondary);
            flex-shrink: 0;
          }
          .menu-toggle-btn {
            background: none;
            border: none;
            color: var(--text-primary);
            cursor: pointer;
            padding: 4px;
          }

          /* Active tab handling */
          .content-pane {
            padding: 16px;
            height: calc(100% - 116px);
          }
          .content-pane.mobile-hidden {
            display: none;
          }
          .content-pane.mobile-visible {
            display: flex;
          }

          .chat-pane {
            width: 100%;
            height: calc(100% - 116px);
            border-left: none;
            padding: 16px;
          }
          .chat-pane.mobile-hidden {
            display: none;
          }
          .chat-pane.mobile-visible {
            display: flex;
          }

          /* Mobile Bottom Tab Bar */
          .mobile-tab-bar {
            display: flex;
            height: 60px;
            border-top: 1px solid var(--border-subtle);
            background: var(--bg-secondary);
            z-index: 50;
            width: 100%;
            flex-shrink: 0;
          }
          
          .tab-item {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 0.75rem;
          }
          .tab-item.active {
            color: var(--accent-purple);
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
