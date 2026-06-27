import React from 'react';
import { KymaItem } from '../lib/db/client';
import { Star, Sparkles } from 'lucide-react';

interface EstelaHorizontalTimelineViewProps {
  items: KymaItem[];
  sortAsc?: boolean;
  onItemClick: (item: KymaItem) => void;
}

export function EstelaHorizontalTimelineView({ 
  items, 
  sortAsc = false, 
  onItemClick 
}: EstelaHorizontalTimelineViewProps) {
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
          Cuéntale a Kyma tus recuerdos más preciados para desplegarlos en tu línea del tiempo.
        </p>
      </div>
    );
  }

  return (
    <div className="horizontal-timeline-container animate-fade-in">
      <div className="horizontal-timeline-scroll">
        <div className="horizontal-timeline-track">
          {/* Center horizontal line */}
          <div className="timeline-center-line" />

          <div className="timeline-nodes-wrapper">
            {sortedItems.map((item, index) => {
              const isEven = index % 2 === 0; // Alternates UP (even) and DOWN (odd)
              const displayYear = item.year || (item.eventDate ? item.eventDate.split('-')[0] : '');
              const isMilestone = item.peso === 3;

              return (
                <div 
                  key={item.id} 
                  className={`timeline-node-item ${isEven ? 'node-up' : 'node-down'}`}
                >
                  {/* Card Bubble */}
                  <div 
                    className="timeline-bubble glass-panel"
                    onClick={() => onItemClick(item)}
                    title="Ver detalle del hito"
                  >
                    <div className="bubble-content">
                      {isMilestone && (
                        <Star 
                          size={15} 
                          color="var(--accent-purple)" 
                          fill="none" 
                          style={{ filter: 'drop-shadow(0 0 3px rgba(139, 92, 246, 0.45))', flexShrink: 0 }}
                        />
                      )}
                      <span className="bubble-title">{item.title}</span>
                    </div>
                    {displayYear && (
                      <span className="bubble-year">{displayYear}</span>
                    )}
                  </div>

                  {/* Vertical Connector Line */}
                  <div className="connector-line" />

                  {/* Dot on Center Axis */}
                  <div className={`center-dot ${isMilestone ? 'milestone-dot' : ''}`}>
                    <div className="dot-inner" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx>{`
        .horizontal-timeline-container {
          width: 100%;
          padding: 40px 0;
          position: relative;
        }

        .horizontal-timeline-scroll {
          width: 100%;
          overflow-x: auto;
          padding: 80px 20px;
          scroll-behavior: smooth;
        }

        .horizontal-timeline-scroll::-webkit-scrollbar {
          height: 6px;
        }
        .horizontal-timeline-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 4px;
        }
        .horizontal-timeline-scroll::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.3);
          border-radius: 4px;
        }
        .horizontal-timeline-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.6);
        }

        .horizontal-timeline-track {
          position: relative;
          min-width: max-content;
          display: flex;
          align-items: center;
          padding: 0 40px;
        }

        .timeline-center-line {
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          height: 3px;
          background: linear-gradient(90deg, rgba(139, 92, 246, 0.2), rgba(192, 132, 252, 0.8), rgba(139, 92, 246, 0.2));
          transform: translateY(-50%);
          z-index: 1;
          box-shadow: 0 0 10px rgba(139, 92, 246, 0.4);
        }

        .timeline-nodes-wrapper {
          display: flex;
          gap: 60px;
          position: relative;
          z-index: 2;
        }

        .timeline-node-item {
          display: flex;
          flex-direction: column;
          alignItems: center;
          position: relative;
          width: 220px;
        }

        .node-up {
          margin-bottom: 70px; /* Positions bubble above center line */
        }

        .node-down {
          margin-top: 70px; /* Positions bubble below center line */
          flex-direction: column-reverse;
        }

        .center-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--bg-primary, #0f0f12);
          border: 2px solid var(--accent-purple, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 3;
          box-shadow: 0 0 8px rgba(139, 92, 246, 0.6);
        }

        .node-up .center-dot {
          bottom: -78px;
          top: auto;
        }

        .node-down .center-dot {
          top: -78px;
        }

        .milestone-dot {
          border-color: #c084fc;
          box-shadow: 0 0 12px rgba(192, 132, 252, 0.9);
          width: 20px;
          height: 20px;
        }
        .node-up .milestone-dot { bottom: -80px; }
        .node-down .milestone-dot { top: -80px; }

        .dot-inner {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #c084fc;
        }

        .connector-line {
          width: 2px;
          height: 40px;
          background: rgba(139, 92, 246, 0.4);
        }

        .timeline-bubble {
          background: var(--bg-card, rgba(20, 20, 26, 0.75));
          border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
          border-radius: 12px;
          padding: 14px 18px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          backdrop-filter: blur(12px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .timeline-bubble:hover {
          transform: translateY(-3px);
          border-color: rgba(192, 132, 252, 0.5);
          box-shadow: 0 8px 25px rgba(139, 92, 246, 0.25);
          background: rgba(25, 25, 34, 0.85);
        }

        .bubble-content {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow: hidden;
        }

        .bubble-title {
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text-primary, #ffffff);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bubble-year {
          font-size: 0.72rem;
          font-weight: 700;
          color: #c084fc;
          background: rgba(139, 92, 246, 0.15);
          border: 1px solid rgba(139, 92, 246, 0.3);
          padding: 2px 8px;
          border-radius: 8px;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
