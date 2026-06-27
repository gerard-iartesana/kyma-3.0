import React, { useState } from 'react';
import { KymaItem } from '../lib/db/client';
import { Star, MapPin, Sparkles, Calendar, Plus } from 'lucide-react';

interface EstelaTimelineViewProps {
  items: KymaItem[];
  isCompact?: boolean;
  onItemClick: (item: KymaItem) => void;
  onAskKyma?: (item: KymaItem, e: React.MouseEvent) => void;
}

export function EstelaTimelineView({ items, isCompact, onItemClick, onAskKyma }: EstelaTimelineViewProps) {
  const [sortAsc, setSortAsc] = useState(false); // Default newest year first, or oldest first

  const estelaItems = items.filter(i => i.doorId === 'estela');

  // Sort items by year, then dateStr
  const sortedItems = [...estelaItems].sort((a, b) => {
    const yearA = a.year || (a.eventDate ? parseInt(a.eventDate.split('-')[0]) : 0);
    const yearB = b.year || (b.eventDate ? parseInt(b.eventDate.split('-')[0]) : 0);
    if (yearA !== yearB) {
      return sortAsc ? yearA - yearB : yearB - yearA;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });

  // Group items by year
  const groupedByYear: Record<number, KymaItem[]> = {};
  sortedItems.forEach(item => {
    const yr = item.year || (item.eventDate ? parseInt(item.eventDate.split('-')[0]) : 2026);
    if (!groupedByYear[yr]) {
      groupedByYear[yr] = [];
    }
    groupedByYear[yr].push(item);
  });

  const years = Object.keys(groupedByYear)
    .map(Number)
    .sort((a, b) => (sortAsc ? a - b : b - a));

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
    <div className="estela-timeline-container animate-fade-in">
      {/* Timeline Controls */}
      <div className="timeline-controls" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '28px',
        padding: '0 8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <Calendar size={16} className="text-purple" />
          <span>Línea de tiempo cronológica ({estelaItems.length} {estelaItems.length === 1 ? 'hito' : 'hitos'})</span>
        </div>
        <button 
          onClick={() => setSortAsc(!sortAsc)}
          className="btn btn-secondary"
          style={{ fontSize: '0.78rem', padding: '6px 12px', borderRadius: '20px' }}
        >
          {sortAsc ? 'Más antiguos primero ↑' : 'Más recientes primero ↓'}
        </button>
      </div>

      {/* Main Stream Line */}
      <div className="timeline-stream">
        {years.map(year => (
          <div key={year} className="timeline-year-group">
            <div className="timeline-year-header">
              <span className="year-badge">{year}</span>
              <div className="year-line" />
            </div>

            <div className="timeline-cards-list">
              {groupedByYear[year].map(item => {
                const isMilestone = item.peso === 3;
                return (
                  <div 
                    key={item.id} 
                    className={`timeline-card-wrapper ${isMilestone ? 'milestone-card' : ''}`}
                    onClick={() => onItemClick(item)}
                  >
                    <div className="timeline-node-dot">
                      {isMilestone && <Star size={12} fill="#c084fc" color="#c084fc" />}
                    </div>

                    <div className="timeline-card-bubble glass-panel" style={{ padding: isCompact ? '12px 16px' : '18px 20px' }}>
                      <div className="timeline-card-header" style={{ marginBottom: isCompact && !item.lugar ? '0' : '8px' }}>
                        <div className="title-area">
                          <h4 className="timeline-card-title">{item.title}</h4>
                          {item.dateStr && <span className="timeline-datestr">{item.dateStr}</span>}
                        </div>
                        {isMilestone && (
                          <div className="milestone-badge" title="Hito vital impactante">
                            <Star size={14} fill="#c084fc" color="#c084fc" />
                            <span>Hito Vital</span>
                          </div>
                        )}
                      </div>

                      {!isCompact && (
                        <p className="timeline-card-content">{item.content}</p>
                      )}

                      {item.lugar && (
                        <div className="timeline-lugar" style={{ marginBottom: isCompact ? '0' : '10px' }}>
                          <MapPin size={12} />
                          <span>{item.lugar}</span>
                        </div>
                      )}

                      {!isCompact && item.tags && item.tags.length > 0 && (
                        <div className="timeline-tags">
                          {item.tags.filter(t => !['#estela'].includes(t.toLowerCase())).map(t => (
                            <span key={t} className="tag-chip">{t}</span>
                          ))}
                        </div>
                      )}

                      {!isCompact && onAskKyma && (
                        <button 
                          className="ask-kyma-timeline-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAskKyma(item, e);
                          }}
                        >
                          <Sparkles size={12} />
                          <span>Recordar con Kyma</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .estela-timeline-container {
          padding: 10px 4px 40px 4px;
          max-width: 860px;
          margin: 0 auto;
        }

        .timeline-stream {
          position: relative;
          padding-left: 28px;
          border-left: 2px solid rgba(139, 92, 246, 0.25);
        }

        .timeline-year-group {
          margin-bottom: 36px;
        }

        .timeline-year-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-left: -44px;
          margin-bottom: 20px;
        }

        .year-badge {
          background: var(--gradient-accent, linear-gradient(135deg, #8b5cf6, #d946ef));
          color: #ffffff;
          font-weight: 700;
          font-size: 1.05rem;
          padding: 6px 16px;
          border-radius: 20px;
          box-shadow: 0 0 14px rgba(139, 92, 246, 0.4);
          letter-spacing: 0.04em;
        }

        .year-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, rgba(139, 92, 246, 0.3), transparent);
        }

        .timeline-cards-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .timeline-card-wrapper {
          position: relative;
          cursor: pointer;
          transition: transform 0.22s ease;
        }
        .timeline-card-wrapper:hover {
          transform: translateX(4px);
        }

        .timeline-node-dot {
          position: absolute;
          left: -35px;
          top: 18px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--bg-surface, #1e1b2e);
          border: 2px solid var(--accent-purple, #a855f7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
          box-shadow: 0 0 8px rgba(168, 85, 247, 0.5);
        }

        .milestone-card .timeline-node-dot {
          width: 20px;
          height: 20px;
          left: -39px;
          top: 14px;
          background: rgba(139, 92, 246, 0.25);
          border-color: #c084fc;
        }

        .timeline-card-bubble {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 14px;
          padding: 18px 20px;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        .timeline-card-wrapper:hover .timeline-card-bubble {
          border-color: rgba(139, 92, 246, 0.45);
          box-shadow: var(--shadow-md);
        }

        .milestone-card .timeline-card-bubble {
          border: 1px solid rgba(192, 132, 252, 0.4);
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(217, 70, 239, 0.04));
        }

        .timeline-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 8px;
        }

        .title-area {
          display: flex;
          align-items: baseline;
          gap: 10px;
          flex-wrap: wrap;
        }

        .timeline-card-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .timeline-datestr {
          font-size: 0.8rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .milestone-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(192, 132, 252, 0.15);
          border: 1px solid rgba(192, 132, 252, 0.35);
          color: #c084fc;
          font-size: 0.72rem;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 12px;
          white-space: nowrap;
        }

        .timeline-card-content {
          font-size: 0.92rem;
          line-height: 1.55;
          color: var(--text-secondary);
          margin: 0 0 10px 0;
          white-space: pre-wrap;
        }

        .timeline-lugar {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.78rem;
          color: #a855f7;
          background: rgba(168, 85, 247, 0.08);
          padding: 3px 10px;
          border-radius: 12px;
          border: 1px solid rgba(168, 85, 247, 0.2);
          margin-bottom: 10px;
        }

        .timeline-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 6px;
        }

        .tag-chip {
          font-size: 0.72rem;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.04);
          padding: 2px 8px;
          border-radius: 10px;
          border: 1px solid var(--border-subtle);
        }

        .ask-kyma-timeline-btn {
          margin-top: 12px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: var(--accent-purple);
          font-size: 0.78rem;
          font-weight: 500;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: background 0.2s;
        }
        .ask-kyma-timeline-btn:hover {
          background: rgba(139, 92, 246, 0.1);
        }
      `}</style>
    </div>
  );
}
