import React from 'react';
import { KymaItem } from '../lib/db/client';
import { Calendar, CheckSquare, Square, Star, ShieldAlert, Heart, AlertCircle, Smile, Check, X, Sparkles, MapPin } from 'lucide-react';
import { LogoIcon } from './Logo';

interface ItemCardProps {
  item: KymaItem;
  onClick: (item: KymaItem) => void;
  onAskKyma: (item: KymaItem, e: React.MouseEvent) => void;
  onToggleComplete?: (item: KymaItem, e: React.MouseEvent) => void;
  onConfirmItem?: (item: KymaItem, e: React.MouseEvent) => void;
  onDiscardItem?: (item: KymaItem, e: React.MouseEvent) => void;
  isCompact?: boolean;
  onTagSelect?: (tag: string) => void;
}

export function ItemCard({ 
  item, 
  onClick, 
  onAskKyma, 
  onToggleComplete, 
  onConfirmItem,
  onDiscardItem,
  isCompact, 
  onTagSelect 
}: ItemCardProps) {
  // Helper to format dates
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  // Helper to check if item is scheduled for today
  const isTodayEvent = () => {
    if (item.doorId !== 'agenda' || !item.eventDate) return false;
    
    const itemDateStr = item.eventDate.includes('T')
      ? item.eventDate.split('T')[0]
      : item.eventDate;
      
    const today = new Date();
    const isDemoYear = today.getFullYear() === 2026;
    const todayString = isDemoYear
      ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      : '2026-06-26';
      
    return itemDateStr === todayString;
  };

  const isHighlighted = item.doorId === 'agenda' ? isTodayEvent() : item.peso === 3;

  const getFrequencyLabel = (freq: number) => {
    if (freq >= 100) return 'diario';
    if (freq >= 75) return 'semanal';
    if (freq >= 50) return 'mensual';
    if (freq >= 25) return 'anual';
    return 'nada';
  };

  const getFrequencyOpacity = (freq: number) => {
    if (freq >= 100) return 1.0;
    if (freq >= 75) return 0.8;
    if (freq >= 50) return 0.6;
    if (freq >= 25) return 0.4;
    return 0.15;
  };

  // Helper for rendering door-specific badges or decorations
  const renderBadge = () => {
    switch (item.doorId) {
      case 'tareas':
        return item.peso === 3 ? (
          <AlertCircle 
            size={16} 
            color="var(--accent-purple)" 
            fill="none"
            style={{ filter: 'drop-shadow(0 0 3px rgba(139, 92, 246, 0.45))', flexShrink: 0 }} 
          />
        ) : null;
      case 'intereses':
        return item.peso === 3 ? (
          <Heart 
            size={16} 
            color="var(--accent-purple)" 
            fill="none"
            style={{ filter: 'drop-shadow(0 0 3px rgba(139, 92, 246, 0.45))', flexShrink: 0 }} 
          />
        ) : null;
      case 'personas':
        if (item.cercania === 'nucleo') {
          return (
            <Heart 
              size={16} 
              color="var(--accent-purple)" 
              fill="none"
              style={{ filter: 'drop-shadow(0 0 3px rgba(139, 92, 246, 0.45))', flexShrink: 0 }} 
            />
          );
        } else if (item.cercania === 'cercana') {
          return (
            <Smile 
              size={16} 
              color="var(--accent-purple)" 
              fill="none"
              style={{ filter: 'drop-shadow(0 0 3px rgba(139, 92, 246, 0.45))', flexShrink: 0 }} 
            />
          );
        }
        return null;
      case 'agenda':
        return (
          <div className="agenda-badge-box" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '6px 11px',
            gap: '2px',
            minWidth: '68px',
            flexShrink: 0
          }}>
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              color: '#ffffff',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap'
            }}>
              {formatDate(item.eventDate)}
            </span>
            {item.eventTime && (
              <span style={{
                fontSize: '0.68rem',
                color: '#8a8a93',
                fontWeight: 500,
                whiteSpace: 'nowrap'
              }}>
                {item.eventTime} h
              </span>
            )}
          </div>
        );
      case 'estela':
        return (
          <div className="estela-badge-box" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(139, 92, 246, 0.12)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '8px',
            padding: '6px 12px',
            gap: '2px',
            minWidth: '72px',
            flexShrink: 0
          }}>
            <span style={{
              fontSize: '0.92rem',
              fontWeight: 700,
              color: '#c084fc',
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap'
            }}>
              {item.year || (item.eventDate ? item.eventDate.split('-')[0] : 'Hito')}
            </span>
            {item.dateStr && (
              <span style={{
                fontSize: '0.68rem',
                color: 'var(--text-secondary, #94a3b8)',
                fontWeight: 500,
                whiteSpace: 'nowrap'
              }}>
                {item.dateStr}
              </span>
            )}
          </div>
        );
      default:
        return item.peso === 3 ? (
          <Star 
            size={16} 
            color="var(--accent-purple)" 
            fill="none"
            style={{ filter: 'drop-shadow(0 0 3px rgba(139, 92, 246, 0.45))', flexShrink: 0 }} 
          />
        ) : null;
    }
  };

  return (
    <div 
      className={`card ${isHighlighted ? 'card-high-weight' : ''} ${isCompact ? 'card-compact' : ''} ${item.origen === 'kyma_sugerido' ? 'card-tentative' : ''}`}
      onClick={() => onClick(item)}
    >
      {item.origen === 'kyma_sugerido' && (
        <div 
          className="tentative-banner" 
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(139, 92, 246, 0.12)',
            border: '1px solid rgba(139, 92, 246, 0.28)',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '0.75rem',
            color: '#c084fc',
            width: '100%'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 500 }}>
            <Sparkles size={13} color="#c084fc" /> Sugerido por Kyma
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {onConfirmItem && (
              <button 
                onClick={(e) => { e.stopPropagation(); onConfirmItem(item, e); }}
                style={{ background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', fontWeight: 600 }}
              >
                <Check size={12} /> Confirmar
              </button>
            )}
            {onDiscardItem && (
              <button 
                onClick={(e) => { e.stopPropagation(); onDiscardItem(item, e); }}
                style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#a1a1aa', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem' }}
              >
                <X size={12} /> Descartar
              </button>
            )}
          </div>
        </div>
      )}
      <div className="card-header">
        <div className="card-title-group">
          {item.doorId === 'tareas' && onToggleComplete && (
            <button 
              className="checkbox-btn" 
              onClick={(e) => onToggleComplete(item, e)}
              aria-label="Toggle Complete"
            >
              {item.completed ? (
                <CheckSquare size={18} className="text-success" />
              ) : (
                <Square size={18} className="text-muted" />
              )}
            </button>
          )}
          {item.doorId === 'estela' && item.peso === 3 && (
            <Star 
              size={16} 
              color="var(--accent-purple)" 
              fill="none"
              style={{ filter: 'drop-shadow(0 0 3px rgba(139, 92, 246, 0.45))', flexShrink: 0, marginTop: '3px' }} 
            />
          )}
          <h3 className={`card-title ${item.completed ? 'title-completed' : ''}`}>
            {item.title}
          </h3>
        </div>
        {isCompact ? (
          <div className="card-compact-right">
            {item.doorId === 'agenda' && item.eventDate && (
              <span className="agenda-compact-date">
                {formatDate(item.eventDate)}
                {item.eventTime ? ` ${item.eventTime} h` : ''}
              </span>
            )}
            {item.doorId !== 'agenda' && renderBadge()}
          </div>
        ) : (
          renderBadge()
        )}
      </div>

      {!isCompact && (
        <p className={`card-content ${item.completed ? 'content-completed' : ''}`}>
          {item.content}
        </p>
      )}

      {!isCompact && item.doorId === 'estela' && item.lugar && (
        <div className="estela-lugar-badge" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '0.76rem',
          color: '#c084fc',
          marginBottom: '10px',
          background: 'rgba(139, 92, 246, 0.08)',
          padding: '3px 9px',
          borderRadius: '12px',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          width: 'fit-content'
        }}>
          <MapPin size={12} />
          <span>{item.lugar}</span>
        </div>
      )}

      {!isCompact && item.doorId === 'personas' && item.frecuencia !== undefined && (
        <div className="frequency-decay-bar">
          <div className="frequency-label">
            <span>Frecuencia de contacto</span>
            <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{getFrequencyLabel(item.frecuencia)}</span>
          </div>
          <div className="frequency-progress-bg">
            <div 
              className="frequency-progress-fill" 
              style={{ 
                width: `${item.frecuencia}%`
              }}
            />
          </div>
        </div>
      )}

      {!isCompact && (
        <div className="card-footer">
          <div className="card-tags">
            {item.tags
              .filter((tag) => {
                const cleanTag = tag.replace('#', '').toLowerCase();
                const doorId = item.doorId.toLowerCase();
                if (cleanTag === doorId) return false;
                if (doorId === 'personas' && (cleanTag === 'personas' || cleanTag === 'vinculos')) return false;
                return true;
              })
              .map((tag) => (
                <span 
                  key={tag} 
                  className="tag-pill clickable-tag"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onTagSelect) onTagSelect(tag);
                  }}
                >
                  {tag.startsWith('#') ? tag.slice(1) : tag}
                </span>
              ))}
          </div>
          
          <button 
            className="ask-kyma-btn btn"
            onClick={(e) => onAskKyma(item, e)}
            title={item.doorId === 'estela' ? "Recordar con Kyma sobre esto" : "Explorar con Kyma sobre esto"}
          >
            <LogoIcon size={13} className="kyma-btn-icon" />
            <span>{item.doorId === 'estela' ? 'Recordar' : 'Explorar'}</span>
          </button>
        </div>
      )}

      <style jsx>{`
        .card {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: var(--border-radius-md);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }
        .card:hover {
          background: var(--bg-card-hover);
          border-color: var(--border-focus);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        .card-high-weight {
          border-color: rgba(139, 92, 246, 0.2);
        }
        .card-high-weight::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 3px;
          background: var(--accent-gradient);
          border-top-left-radius: var(--border-radius-md);
          border-bottom-left-radius: var(--border-radius-md);
        }
        
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }
        .card-title-group {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }
        .checkbox-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px;
          color: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 2px;
          align-self: flex-start;
          flex-shrink: 0;
        }
        .card-title {
          font-family: var(--font-noto), var(--font-sans), sans-serif;
          font-size: 1.2rem;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.3;
        }
        .title-completed {
          text-decoration: line-through;
          color: var(--text-muted);
        }

        .card-content {
          font-size: 0.92rem;
          color: var(--text-secondary);
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .content-completed {
          color: var(--text-muted);
        }

        /* Badges */
        .btn-badge {
          font-size: 0.72rem;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 9999px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: inline-flex;
          align-items: center;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .agenda-badge-vertical {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          flex-shrink: 0;
        }
        .agenda-time-text {
          font-size: 0.7rem;
          font-weight: 500;
          color: var(--text-muted);
          margin-right: 4px;
        }
        .badge-urgent {
          background: rgba(239, 68, 68, 0.1);
          color: var(--danger);
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .badge-normal {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          border: 1px solid var(--border-subtle);
        }
        .badge-pasion {
          background: rgba(139, 92, 246, 0.12);
          color: #a78bfa;
          border: 1px solid rgba(139, 92, 246, 0.25);
        }
        .badge-curiosidad {
          background: rgba(59, 130, 246, 0.1);
          color: #93c5fd;
          border: 1px solid rgba(59, 130, 246, 0.2);
        }
        .badge-cercania-nucleo {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%);
          color: #e9d5ff;
          border: 1px solid rgba(139, 92, 246, 0.3);
        }
        .badge-cercania-cercana {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: 1px solid var(--border-focus);
        }
        .badge-cercania-orbita {
          background: transparent;
          color: var(--text-secondary);
          border: 1px solid var(--border-subtle);
        }
        .badge-agenda {
          background: rgba(252, 252, 253, 0.05);
          color: var(--text-secondary);
          border: 1px solid var(--border-subtle);
        }
        .badge-star {
          background: rgba(245, 158, 11, 0.1);
          color: #fcd34d;
          border: 1px solid rgba(245, 158, 11, 0.2);
        }

        /* Frequency bar for Vínculos */
        .frequency-decay-bar {
          margin-top: 4px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .frequency-label {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .frequency-progress-bg {
          height: 4px;
          width: 100%;
          background: var(--bg-tertiary);
          border-radius: 2px;
          overflow: hidden;
        }
        .frequency-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent-blue) 0%, var(--accent-purple) 100%);
          border-radius: 2px;
        }

        /* Footer */
        .card-footer {
          margin-top: auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border-subtle);
        }
        .card-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .tag-pill {
          font-size: 0.7rem;
          color: var(--text-secondary);
          background: rgba(252, 252, 253, 0.05);
          border: 1px solid rgba(252, 252, 253, 0.08);
          padding: 2px 8px;
          border-radius: 9999px;
          font-weight: 500;
          letter-spacing: 0.02em;
          transition: all 0.2s ease;
        }
        .tag-pill:hover {
          background: rgba(252, 252, 253, 0.1);
          border-color: rgba(252, 252, 253, 0.15);
          color: var(--text-primary);
        }
        .clickable-tag {
          cursor: pointer;
        }
        .clickable-tag:hover {
          background: rgba(139, 92, 246, 0.15) !important;
          border-color: rgba(139, 92, 246, 0.35) !important;
          color: #ffffff !important;
        }
        
        .ask-kyma-btn {
          font-size: 0.72rem;
          padding: 4px 8px;
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-muted);
          border-radius: var(--border-radius-sm);
          transition: all 0.25s ease;
          display: inline-flex;
          align-items: center;
        }
        .ask-kyma-btn :global(.kyma-btn-icon) {
          color: var(--text-muted) !important;
          filter: none !important;
          opacity: 0.55;
          transition: all 0.25s ease;
          margin-right: 4px;
        }
        .ask-kyma-btn:hover {
          background: rgba(252, 252, 253, 0.04);
          border-color: rgba(252, 252, 253, 0.08);
          color: var(--text-primary);
        }
        .ask-kyma-btn:hover :global(.kyma-btn-icon) {
          color: var(--accent-purple) !important;
          filter: drop-shadow(0 0 3px rgba(139, 92, 246, 0.45)) !important;
          opacity: 1;
        }
        .text-success { color: var(--success); }
        .text-muted { color: var(--text-muted); }

        .card.card-compact {
          padding: 10px 16px;
          gap: 0;
        }
        .card-compact .card-header {
          align-items: center;
          width: 100%;
        }
        .card-compact .card-title {
          font-size: 0.95rem;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
        }
        .card-compact .card-title-group {
          align-items: center;
        }
        .card-compact-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .agenda-compact-date {
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-secondary);
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid var(--border-subtle);
          border-radius: 4px;
          padding: 2px 6px;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
