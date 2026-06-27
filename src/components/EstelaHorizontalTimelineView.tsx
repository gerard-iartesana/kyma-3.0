import React, { useState, useRef, useEffect } from 'react';
import { KymaItem } from '../lib/db/client';
import { Star, Sparkles, MapPin, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface EstelaHorizontalTimelineViewProps {
  items: KymaItem[];
  sortAsc?: boolean;
  onItemClick: (item: KymaItem) => void;
}

const getEmotionColor = (emocion?: number): string => {
  switch (emocion) {
    case 1: return '#3b82f6'; // Muy triste (Azul frío)
    case 2: return '#06b6d4'; // Triste (Cian)
    case 3: return '#10b981'; // Calma (Verde)
    case 4: return '#f59e0b'; // Alegre (Ámbar)
    case 5: return '#ec4899'; // Muy alegre (Rosa/Magenta)
    default: return '#f59e0b';
  }
};

const getEmotionLabel = (emocion?: number): string => {
  switch (emocion) {
    case 1: return 'Muy triste';
    case 2: return 'Triste';
    case 3: return 'Calma';
    case 4: return 'Alegre';
    case 5: return 'Muy alegre';
    default: return 'Alegre';
  }
};

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

  // Pan & Zoom State
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredItem, setHoveredItem] = useState<KymaItem | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setScale(prev => Math.min(Math.max(prev * zoomFactor, 0.4), 3.0));
  };

  // Mouse drag handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag if clicking on background or line (not interactive circles)
    if ((e.target as HTMLElement).closest('.timeline-circle-node')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetTransform = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

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
    <div className="interactive-timeline-viewport animate-fade-in">
      {/* Zoom Controls Overlay */}
      <div className="timeline-zoom-controls glass-panel">
        <button 
          className="zoom-btn" 
          onClick={() => setScale(prev => Math.min(prev * 1.2, 3.0))} 
          title="Acercar zoom"
        >
          <ZoomIn size={16} />
        </button>
        <button 
          className="zoom-btn" 
          onClick={() => setScale(prev => Math.max(prev * 0.8, 0.4))} 
          title="Alejar zoom"
        >
          <ZoomOut size={16} />
        </button>
        <button 
          className="zoom-btn" 
          onClick={resetTransform} 
          title="Restablecer vista"
        >
          <RotateCcw size={16} />
        </button>
        <span className="zoom-level-text">{Math.round(scale * 100)}%</span>
      </div>

      {/* Main Pan/Zoom Canvas Area */}
      <div 
        ref={containerRef}
        className={`timeline-canvas ${isDragging ? 'dragging' : ''}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div 
          className="timeline-transform-layer"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0, 0, 1)'
          }}
        >
          <div className="timeline-graph-wrapper">
            {/* Center Axis Line */}
            <div className="horizontal-axis-line" />

            {/* Nodes */}
            <div className="timeline-nodes-sequence">
              {sortedItems.map((item, index) => {
                const isEven = index % 2 === 0; // Alternates UP (even) and DOWN (odd)
                const displayYear = item.year || (item.eventDate ? item.eventDate.split('-')[0] : '');
                const isMilestone = item.peso === 3;
                const emotionColor = getEmotionColor(item.emocion);

                return (
                  <div 
                    key={item.id} 
                    className={`timeline-node-column ${isEven ? 'column-up' : 'column-down'}`}
                  >
                    {/* Filled Circle with Stem Line */}
                    <div className="stem-and-circle-group">
                      <div 
                        className="timeline-circle-node"
                        style={{
                          background: emotionColor,
                          boxShadow: `0 0 16px ${emotionColor}aa, inset 0 0 4px rgba(255,255,255,0.6)`
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemClick(item);
                        }}
                        onMouseEnter={() => setHoveredItem(item)}
                        onMouseLeave={() => setHoveredItem(null)}
                      >
                        {isMilestone && (
                          <Star size={14} color="#ffffff" fill="#ffffff" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
                        )}
                        
                        {/* Tooltip on Hover */}
                        {hoveredItem?.id === item.id && (
                          <div className={`node-tooltip glass-panel ${isEven ? 'tooltip-above' : 'tooltip-below'}`}>
                            <div className="tooltip-header">
                              <span className="tooltip-title">{item.title}</span>
                              {isMilestone && <Star size={12} color="#c084fc" fill="#c084fc" />}
                            </div>
                            <div className="tooltip-details">
                              {displayYear && <span className="tooltip-year">{displayYear}</span>}
                              {item.lugar && (
                                <span className="tooltip-lugar">
                                  <MapPin size={10} />
                                  {item.lugar}
                                </span>
                              )}
                              <span className="tooltip-emotion" style={{ color: emotionColor }}>
                                {getEmotionLabel(item.emocion)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Vertical Stem Line connecting filled circle to horizontal axis */}
                      <div 
                        className="stem-line"
                        style={{ background: `linear-gradient(${isEven ? '180deg' : '0deg'}, ${emotionColor}bb, rgba(139, 92, 246, 0.3))` }}
                      />
                    </div>

                    {/* Small Dot on Horizontal Axis */}
                    <div className="axis-anchor-dot" />

                    {/* Quick Year/Title Label near Axis */}
                    <div className={`axis-label-box ${isEven ? 'label-below' : 'label-above'}`}>
                      <span className="axis-year">{displayYear}</span>
                      <span className="axis-title-preview">{item.title}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .interactive-timeline-viewport {
          position: relative;
          width: 100%;
          height: 520px;
          background: rgba(10, 10, 14, 0.6);
          border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
          border-radius: 16px;
          overflow: hidden;
          user-select: none;
        }

        .timeline-zoom-controls {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 20;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 20px;
          background: rgba(20, 20, 28, 0.85);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .zoom-btn {
          background: transparent;
          border: none;
          color: var(--text-muted, #a1a1aa);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: 6px;
          transition: all 0.2s ease;
        }
        .zoom-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.1);
        }

        .zoom-level-text {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted, #94a3b8);
          margin-left: 6px;
          min-width: 36px;
        }

        .timeline-canvas {
          width: 100%;
          height: 100%;
          cursor: grab;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .timeline-canvas.dragging {
          cursor: grabbing;
        }

        .timeline-transform-layer {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 100px 200px;
        }

        .timeline-graph-wrapper {
          position: relative;
          min-width: max-content;
          display: flex;
          align-items: center;
        }

        .horizontal-axis-line {
          position: absolute;
          left: -100px;
          right: -100px;
          top: 50%;
          height: 4px;
          background: linear-gradient(90deg, rgba(139,92,246,0.1), rgba(192,132,252,0.85), rgba(139,92,246,0.1));
          transform: translateY(-50%);
          z-index: 1;
          box-shadow: 0 0 14px rgba(139, 92, 246, 0.5);
          border-radius: 2px;
        }

        .timeline-nodes-sequence {
          display: flex;
          gap: 140px;
          position: relative;
          z-index: 2;
          padding: 0 60px;
        }

        .timeline-node-column {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          width: 40px;
        }

        .column-up {
          flex-direction: column-reverse;
          padding-bottom: 2px;
        }

        .column-down {
          flex-direction: column;
          padding-top: 2px;
        }

        .stem-and-circle-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
        }

        .column-up .stem-and-circle-group {
          flex-direction: column;
        }

        .column-down .stem-and-circle-group {
          flex-direction: column-reverse;
        }

        .stem-line {
          width: 3px;
          height: 90px;
          border-radius: 2px;
        }

        .timeline-circle-node {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
          position: relative;
          z-index: 10;
        }

        .timeline-circle-node:hover {
          transform: scale(1.35);
          z-index: 30;
        }

        .axis-anchor-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #ffffff;
          border: 2px solid var(--accent-purple, #8b5cf6);
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 5;
          box-shadow: 0 0 8px rgba(255,255,255,0.8);
        }

        .axis-label-box {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          white-space: nowrap;
          pointer-events: none;
        }

        .column-up .axis-label-box {
          top: 18px;
        }

        .column-down .axis-label-box {
          bottom: 18px;
        }

        .axis-year {
          font-size: 0.72rem;
          font-weight: 700;
          color: #c084fc;
          letterSpacing: 0.04em;
        }

        .axis-title-preview {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-secondary, #a1a1aa);
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Tooltip Styling */
        .node-tooltip {
          position: absolute;
          min-width: 180px;
          max-width: 240px;
          padding: 10px 14px;
          border-radius: 12px;
          background: rgba(18, 18, 26, 0.95);
          border: 1px solid rgba(192, 132, 252, 0.4);
          box-shadow: 0 10px 30px rgba(0,0,0,0.6);
          pointer-events: none;
          z-index: 40;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .tooltip-above {
          bottom: 42px;
          left: 50%;
          transform: translateX(-50%);
        }

        .tooltip-below {
          top: 42px;
          left: 50%;
          transform: translateX(-50%);
        }

        .tooltip-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .tooltip-title {
          font-size: 0.84rem;
          font-weight: 600;
          color: #ffffff;
          line-height: 1.3;
        }

        .tooltip-details {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          font-size: 0.72rem;
        }

        .tooltip-year {
          background: rgba(139, 92, 246, 0.2);
          color: #c084fc;
          padding: 1px 6px;
          border-radius: 6px;
          font-weight: 600;
        }

        .tooltip-lugar {
          display: flex;
          align-items: center;
          gap: 3px;
          color: var(--text-muted, #a1a1aa);
        }

        .tooltip-emotion {
          font-weight: 600;
          margin-left: auto;
        }
      `}</style>
    </div>
  );
}
