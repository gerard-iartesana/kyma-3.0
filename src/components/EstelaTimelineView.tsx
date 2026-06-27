import React from 'react';
import { KymaItem } from '../lib/db/client';
import { ItemCard } from './ItemCard';
import { Sparkles } from 'lucide-react';

interface EstelaTimelineViewProps {
  items: KymaItem[];
  isCompact?: boolean;
  sortAsc?: boolean;
  onItemClick: (item: KymaItem) => void;
  onAskKyma?: (item: KymaItem, e: React.MouseEvent) => void;
  onTagSelect?: (tag: string) => void;
}

export function EstelaTimelineView({ 
  items, 
  isCompact, 
  sortAsc = false, 
  onItemClick, 
  onAskKyma,
  onTagSelect 
}: EstelaTimelineViewProps) {
  const estelaItems = items.filter(i => i.doorId === 'estela');

  // Sort items by year / date
  const sortedItems = [...estelaItems].sort((a, b) => {
    const yearA = a.year || (a.eventDate ? parseInt(a.eventDate.split('-')[0]) : 0);
    const yearB = b.year || (b.eventDate ? parseInt(b.eventDate.split('-')[0]) : 0);
    if (yearA !== yearB) {
      return sortAsc ? yearA - yearB : yearB - yearA;
    }
    return sortAsc ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt);
  });

  if (estelaItems.length === 0) {
    return (
      <div className="estela-empty-state animate-fade-in glass-panel" style={{
        padding: '60px 20px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        borderRadius: '16px',
        margin: '20px 0'
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'rgba(139, 92, 246, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#c084fc',
          border: '1px solid rgba(139, 92, 246, 0.3)'
        }}>
          <Sparkles size={32} />
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>Tu Estela de Vida está por comenzar</h3>
        <p style={{ maxWidth: '460px', color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>
          Cuéntale a Kyma tus recuerdos más preciados, viajes significativos o hitos personales que hayan marcado tu trayectoria para construir aquí tu línea de tiempo vital.
        </p>
      </div>
    );
  }

  return (
    <div className={`grid-layout ${isCompact ? 'compact-layout' : ''} animate-fade-in`}>
      {sortedItems.map(item => (
        <ItemCard
          key={item.id}
          item={item}
          isCompact={isCompact}
          onClick={(clickedItem) => onItemClick(clickedItem)}
          onAskKyma={(item, e) => onAskKyma && onAskKyma(item, e)}
          onTagSelect={onTagSelect}
        />
      ))}
    </div>
  );
}
