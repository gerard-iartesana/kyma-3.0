import React, { useState } from 'react';
import { KymaItem } from '../lib/db/client';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { ItemCard } from './ItemCard';

interface CalendarViewProps {
  items: KymaItem[];
  onItemClick: (item: KymaItem) => void;
  onAskKyma: (item: KymaItem, e?: React.MouseEvent) => void;
  onConfirmItem?: (item: KymaItem, e: React.MouseEvent) => void;
  onDiscardItem?: (item: KymaItem, e: React.MouseEvent) => void;
  onTagSelect?: (tag: string) => void;
}

export function CalendarView({ 
  items, 
  onItemClick,
  onAskKyma,
  onConfirmItem,
  onDiscardItem,
  onTagSelect
}: CalendarViewProps) {
  // We initialize the calendar with the current date (Junio 2026 for demo consistency, or fallback to system date)
  const [currentDate, setCurrentDate] = useState(() => {
    return new Date(2026, 5, 26); // 5 represents June (0-indexed)
  });

  const [selectedDayModal, setSelectedDayModal] = useState<{ dateString: string; events: KymaItem[] } | null>(null);

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
    const isDemoYear = today.getFullYear() === 2026;
    const todayString = isDemoYear
      ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      : '2026-06-26';

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

  // Helper to filter events on a specific date string
  const getEventsForDate = (dateStr: string) => {
    return items
      .filter((item) => {
        if (!item.eventDate) return false;
        const itemDateStr = item.eventDate.includes('T')
          ? item.eventDate.split('T')[0]
          : item.eventDate;
        return itemDateStr === dateStr;
      })
      .sort((a, b) => {
        const timeA = a.eventTime || '00:00';
        const timeB = b.eventTime || '00:00';
        return timeA.localeCompare(timeB);
      });
  };

  const handleCellClick = (dateStr: string) => {
    const dayEvents = getEventsForDate(dateStr);
    if (dayEvents.length > 0) {
      setSelectedDayModal({ dateString: dateStr, events: dayEvents });
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
                    className={`calendar-event-pill ${cell.isToday ? 'event-today' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onItemClick(event);
                    }}
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
          <div className="modal-content calendar-day-events-modal animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
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
              {selectedDayModal.events.map((evt) => (
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
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
