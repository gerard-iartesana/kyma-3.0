import React, { useState, useEffect } from 'react';
import { KymaItem } from '../lib/db/client';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { ItemCard } from './ItemCard';
import { supabase } from '../lib/supabase';

interface CalendarViewProps {
  items: KymaItem[];
  googleEvents?: any[];
  googleCalendarConnected?: boolean;
  onItemClick: (item: KymaItem) => void;
  onAskKyma: (item: KymaItem, e?: React.MouseEvent) => void;
  onConfirmItem?: (item: KymaItem, e: React.MouseEvent) => void;
  onDiscardItem?: (item: KymaItem, e: React.MouseEvent) => void;
  onTagSelect?: (tag: string) => void;
}

export function CalendarView({ 
  items, 
  googleEvents = [],
  googleCalendarConnected = false,
  onItemClick,
  onAskKyma,
  onConfirmItem,
  onDiscardItem,
  onTagSelect
}: CalendarViewProps) {
  // We initialize the calendar with the current date (Junio 2026 for demo consistency, or fallback to system date)
  const [currentDate, setCurrentDate] = useState(() => {
    return new Date();
  });

  const [selectedDayModal, setSelectedDayModal] = useState<{ dateString: string; events: KymaItem[] } | null>(null);
  const [googleEventsState, setGoogleEventsState] = useState<any[]>([]);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Helper to format the Month Year string in Spanish (e.g. "Junio 2026")
  const getMonthYearString = () => {
    const formatted = currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  // Navigators
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Days of the week header
  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  // Calculate day cells
  const getDayCells = () => {
    const firstDayOfMonth = new Date(year, month, 1);
    const dayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday, 1 is Monday...
    
    // Shift index so Monday is 0, Sunday is 6
    const startDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];
    
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // 1. Add days from previous month
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      cells.push({
        dayNumber: day,
        dateString: dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayString,
      });
    }

    // 2. Add days of the current month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      
      cells.push({
        dayNumber: i,
        dateString: dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayString,
      });
    }

    // 3. Add days from next month to complete the grid (multiples of 7)
    const totalCells = cells.length <= 35 ? 35 : 42;
    const remaining = totalCells - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      
      cells.push({
        dayNumber: i,
        dateString: dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayString,
      });
    }

    return cells;
  };

  const cells = getDayCells();

  // Dynamic Google Calendar Loading
  useEffect(() => {
    if (!googleCalendarConnected) {
      setGoogleEventsState([]);
      return;
    }

    if (cells.length === 0) return;

    (async () => {
      setLoadingGoogle(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const timeMinStr = cells[0].dateString;
        const timeMaxStr = cells[cells.length - 1].dateString;

        const res = await fetch(`/api/calendar/events?timeMin=${timeMinStr}T00:00:00Z&timeMax=${timeMaxStr}T23:59:59Z`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          if (data.connected) {
            setGoogleEventsState(data.events || []);
          }
        }
      } catch (e) {
        console.error('Error fetching Google events in CalendarView:', e);
      } finally {
        setLoadingGoogle(false);
      }
    })();
  }, [currentDate, googleCalendarConnected]);

  // Helper to filter events on a specific date string
  const getEventsForDate = (dateStr: string) => {
    const kymaEvents = items
      .filter((item) => {
        if (!item.eventDate) return false;
        const itemDateStr = item.eventDate.includes('T')
          ? item.eventDate.split('T')[0]
          : item.eventDate;
        return itemDateStr === dateStr;
      })
      .map(item => ({ ...item, isGoogle: false }));

    const googleEvts = (googleEventsState || [])
      .filter((evt) => {
        const evtDate = evt.start?.dateTime || evt.start?.date;
        if (!evtDate) return false;
        const evtDateStr = evtDate.split('T')[0];
        return evtDateStr === dateStr;
      })
      .map((evt) => {
        const start = evt.start?.dateTime || evt.start?.date || '';
        const datePart = start.split('T')[0];
        
        let time: string | undefined = undefined;
        if (evt.start?.dateTime) {
          const d = new Date(evt.start.dateTime);
          time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        }

        return {
          id: `google-${evt.id}`,
          userId: '',
          doorId: 'agenda' as const,
          title: evt.summary || '(Sin título)',
          content: evt.description || '',
          eventDate: datePart,
          eventTime: time,
          origen: 'google_calendar' as const,
          tags: ['Google Calendar'],
          completed: false,
          peso: 1 as const,
          createdAt: evt.created || new Date().toISOString(),
          isGoogle: true
        };
      });

    return [...kymaEvents, ...googleEvts].sort((a, b) => {
      const timeA = a.eventTime || '00:00';
      const timeB = b.eventTime || '00:00';
      return timeA.localeCompare(timeB);
    });
  };

  const handleCellClick = (dateStr: string) => {
    const dayEvents = getEventsForDate(dateStr);
    if (dayEvents.length > 0) {
      setSelectedDayModal({ dateString: dateStr, events: dayEvents as any });
    }
  };

  const formatModalDateStr = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    return dateStr;
  };

  return (
    <div className="calendar-view-container animate-fade-in">
      <div className="calendar-header">
        <div className="calendar-nav-buttons">
          <button 
            className="calendar-nav-btn" 
            onClick={handlePrevMonth} 
            title="Mes anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            className="calendar-nav-btn" 
            onClick={handleNextMonth} 
            title="Mes siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <h2 className="calendar-month-title">{getMonthYearString()}</h2>
      </div>

      <div className="calendar-grid">
        {weekDays.map((day) => (
          <div key={day} className="calendar-weekday-header">
            {day}
          </div>
        ))}

        {cells.map((cell, idx) => {
          const dayEvents = getEventsForDate(cell.dateString);
          
          return (
            <div 
              key={`${cell.dateString}-${idx}`}
              className={`calendar-day-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${cell.isToday ? 'today' : ''} ${dayEvents.length > 0 ? 'has-events-cell' : ''}`}
              onClick={() => handleCellClick(cell.dateString)}
              style={{ cursor: dayEvents.length > 0 ? 'pointer' : 'default' }}
            >
              <span className="calendar-day-number">
                {cell.dayNumber}
              </span>
              <div className="calendar-events-list">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`calendar-event-pill ${cell.isToday ? 'event-today' : ''} ${event.origen === 'google_calendar' ? 'event-google' : ''}`}
                    title={`${event.eventTime ? `${event.eventTime} - ` : ''}${event.title}`}
                  >
                    {event.eventTime && (
                      <span className="event-time-prefix">{event.eventTime}</span>
                    )}
                    <span className="event-title-text">{event.title}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedDayModal && (
        <div className="modal-backdrop" onClick={() => setSelectedDayModal(null)}>
          <div className="modal-content calendar-day-events-modal animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px', width: '95%' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarIcon size={18} color="var(--accent-purple)" />
                <h3 className="modal-title" style={{ textTransform: 'capitalize', fontSize: '1.05rem' }}>
                  {formatModalDateStr(selectedDayModal.dateString)}
                </h3>
              </div>
              <button className="icon-btn-ghost" onClick={() => setSelectedDayModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh', overflowY: 'auto' }}>
              {selectedDayModal.events.map((evt) => {
                if (evt.origen === 'google_calendar') {
                  return (
                    <div 
                      key={evt.id} 
                      style={{ 
                        padding: '12px 16px', 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        border: '1px solid rgba(255, 255, 255, 0.06)', 
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--accent-purple)', fontWeight: 600 }}>
                        <Clock size={12} />
                        <span>GOOGLE CALENDAR • {evt.eventTime || 'Todo el día'}</span>
                      </div>
                      <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: 'var(--text-primary)' }}>{evt.title}</h4>
                      {evt.content && (
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{evt.content}</p>
                      )}
                    </div>
                  );
                }
                return (
                  <ItemCard
                    key={evt.id}
                    item={evt}
                    onClick={(clickedItem) => {
                      onItemClick(clickedItem);
                      setSelectedDayModal(null);
                    }}
                    onAskKyma={onAskKyma}
                    onConfirmItem={onConfirmItem}
                    onDiscardItem={onDiscardItem}
                    onTagSelect={onTagSelect}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
