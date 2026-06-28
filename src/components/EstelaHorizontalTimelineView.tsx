import React, { useState, useRef } from 'react';
import { KymaItem } from '../lib/db/client';
import { Star, Sparkles, MapPin } from 'lucide-react';

interface EstelaHorizontalTimelineViewProps {
  items: KymaItem[];
  sortAsc?: boolean;
  onItemClick: (item: KymaItem) => void;
}

const getEmotionColor = (emocion: number = 4): string => {
  switch (emocion) {
    case 1: return '#3b82f6'; // Muy triste (Azul frío)
    case 2: return '#06b6d4'; // Triste (Cian)
    case 3: return '#10b981'; // Calma (Verde)
    case 4: return '#f59e0b'; // Alegre (Ámbar)
    case 5: return '#ec4899'; // Muy alegre (Rosa/Magenta)
    default: return '#f59e0b';
  }
};

const getEmotionLabel = (emocion: number = 4): string => {
  switch (emocion) {
    case 1: return 'Muy triste';
    case 2: return 'Triste';
    case 3: return 'Calma';
    case 4: return 'Alegre';
    case 5: return 'Muy alegre';
    default: return 'Alegre';
  }
};

// Returns Y displacement relative to center horizontal axis (negative = UP/above line, positive = DOWN/below line)
const getEmotionYOffset = (emocion: number = 4): number => {
  switch (emocion) {
    case 1: return 110;  // Muy triste: Abajo
    case 2: return 65;   // Triste: Abajo moderado
    case 3: return -20;  // Calma: Casi neutro sobre la línea
    case 4: return -65;  // Alegre: Arriba moderado
    case 5: return -110; // Muy alegre: Arriba
    default: return -65;
  }
};

export function EstelaHorizontalTimelineView({ 
  items, 
  sortAsc = false, 
  onItemClick 
}: EstelaHorizontalTimelineViewProps) {
  const estelaItems = items.filter(i => i.doorId === 'estela');

  // Sort items chronologically by year / date
  const sortedItems = React.useMemo(() => {
    return [...estelaItems].sort((a, b) => {
      const yearA = a.year || (a.eventDate ? parseInt(a.eventDate.split('-')[0]) : 0);
      const yearB = b.year || (b.eventDate ? parseInt(b.eventDate.split('-')[0]) : 0);
      if (yearA !== yearB) {
        return yearA - yearB;
      }
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [estelaItems]);

  // Calculate proportional X positions based on exact calendar year difference
  const itemPositions = React.useMemo(() => {
    if (sortedItems.length === 0) return [];

    const itemsWithYear = sortedItems.map(item => {
      let parsedYear = item.year;
      if (!parsedYear && item.eventDate) {
        const y = parseInt(item.eventDate.split('-')[0]);
        if (!isNaN(y)) parsedYear = y;
      }
      if (!parsedYear) parsedYear = new Date().getFullYear();
      return { item, year: parsedYear };
    });

    const PX_PER_YEAR = 35; // 35 pixels per calendar year
    const MIN_GAP = 120;    // minimum pixels between adjacent nodes to prevent visual collisions

    const positions: { item: KymaItem; year: number; x: number }[] = [];
    let currentX = 0;

    for (let i = 0; i < itemsWithYear.length; i++) {
      if (i === 0) {
        positions.push({ item: itemsWithYear[0].item, year: itemsWithYear[0].year, x: 0 });
      } else {
        const prev = positions[i - 1];
        const currYear = itemsWithYear[i].year;
        const yearDiff = Math.abs(currYear - prev.year);
        const calculatedDist = Math.max(yearDiff * PX_PER_YEAR, MIN_GAP);
        currentX += calculatedDist;
        positions.push({ item: itemsWithYear[i].item, year: currYear, x: currentX });
      }
    }

    return positions;
  }, [sortedItems]);

  const totalWidth = itemPositions.length > 0 ? itemPositions[itemPositions.length - 1].x : 0;

  // Pan & Zoom State
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredItem, setHoveredItem] = useState<KymaItem | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Touch event refs
  const isTouchDraggingRef = useRef(false);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const initialPinchDistRef = useRef(0);
  const initialScaleRef = useRef(1);
  const isPinchingRef = useRef(false);
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  React.useEffect(() => {
    scaleRef.current = scale;
    panRef.current = pan;
  }, [scale, pan]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const getTouchDist = (touches: TouchList) => {
      return Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
      );
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        isPinchingRef.current = true;
        isTouchDraggingRef.current = false;
        initialPinchDistRef.current = getTouchDist(e.touches);
        initialScaleRef.current = scaleRef.current;
      } else if (e.touches.length === 1) {
        const target = e.target as HTMLElement;
        const isInteractive = target && target.closest('.timeline-circle-node');
        if (!isInteractive) {
          isTouchDraggingRef.current = true;
          setIsDragging(true);
          touchStartXRef.current = e.touches[0].clientX - panRef.current.x;
          touchStartYRef.current = e.touches[0].clientY - panRef.current.y;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinchingRef.current) {
        e.preventDefault();
        const currentDist = getTouchDist(e.touches);
        if (initialPinchDistRef.current > 0) {
          const scaleFactor = currentDist / initialPinchDistRef.current;
          const minScale = 0.35;
          const maxScale = 3.0;
          const next = initialScaleRef.current * scaleFactor;
          const clamped = Math.min(maxScale, Math.max(minScale, next));
          setScale(clamped);
        }
      } else if (e.touches.length === 1 && isTouchDraggingRef.current) {
        e.preventDefault();
        setPan({
          x: e.touches[0].clientX - touchStartXRef.current,
          y: e.touches[0].clientY - touchStartYRef.current
        });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        isPinchingRef.current = false;
      }
      if (e.touches.length === 0) {
        isTouchDraggingRef.current = false;
        setIsDragging(false);
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setScale(prev => Math.min(Math.max(prev * zoomFactor, 0.35), 3.0));
  };

  // Mouse drag handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
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
      {/* Main Pan/Zoom Canvas Area (No borders, no visible zoom controls) */}
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
          <div className="timeline-graph-wrapper" style={{ width: `${totalWidth}px`, minWidth: `${totalWidth}px`, height: '260px' }}>
            {/* Center Axis Line */}
            <div className="horizontal-axis-line" />

            {/* Nodes Sequence along axis */}
            <div className="timeline-nodes-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
              {itemPositions.map(({ item, year, x }) => {
                const displayYear = item.year || (item.eventDate ? item.eventDate.split('-')[0] : String(year));
                const isMilestone = item.peso === 3;
                const emotion = item.emocion || 4;
                const emotionColor = getEmotionColor(emotion);
                const yOffset = getEmotionYOffset(emotion);
                const isAbove = yOffset < 0;
                const absHeight = Math.abs(yOffset);

                return (
                  <div 
                    key={item.id} 
                    className="timeline-node-column"
                    style={{
                      position: 'absolute',
                      left: `${x}px`,
                      top: '50%',
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    {/* Stem & Circle Positioned Relative to Center Axis */}
                    <div 
                      className="node-positioner"
                      style={{
                        transform: `translateY(${yOffset}px)`
                      }}
                    >
                      {/* Filled Circle (No star icon inside, larger glowing aura if milestone) */}
                      <div 
                        className={`timeline-circle-node ${isMilestone ? 'milestone-glowing-circle' : ''}`}
                        style={{
                          width: isMilestone ? '34px' : '22px',
                          height: isMilestone ? '34px' : '22px',
                          background: emotionColor,
                          boxShadow: isMilestone 
                            ? `0 0 28px ${emotionColor}, 0 0 12px ${emotionColor}, inset 0 0 6px #ffffff` 
                            : `0 0 12px ${emotionColor}aa, inset 0 0 3px rgba(255,255,255,0.7)`
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemClick(item);
                        }}
                        onMouseEnter={() => setHoveredItem(item)}
                        onMouseLeave={() => setHoveredItem(null)}
                      >
                        {/* Tooltip on Hover */}
                        {hoveredItem?.id === item.id && (
                          <div className={`node-tooltip glass-panel ${isAbove ? 'tooltip-above' : 'tooltip-below'}`}>
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
                                {getEmotionLabel(emotion)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Connecting Stem Line born from center axis extending to circle */}
                      <div 
                        className="stem-connector-line"
                        style={{
                          height: `${absHeight}px`,
                          top: isAbove ? '100%' : 'auto',
                          bottom: isAbove ? 'auto' : '100%',
                          background: `linear-gradient(${isAbove ? '180deg' : '0deg'}, ${emotionColor}cc, rgba(139, 92, 246, 0.2))`
                        }}
                      />
                    </div>

                    {/* Subtle Year Marker under Center Axis Line */}
                    <div className="axis-year-reference">
                      <div className="axis-tick" />
                      <span className="axis-year-text">{displayYear}</span>
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
          height: 540px;
          background: transparent;
          overflow: hidden;
          user-select: none;
          touch-action: none;
        }

        .timeline-canvas {
          width: 100%;
          height: 100%;
          cursor: grab;
          display: flex;
          align-items: center;
          justify-content: center;
          touch-action: none;
        }
        .timeline-canvas.dragging {
          cursor: grabbing;
        }

        .timeline-transform-layer {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 120px 240px;
        }

        .timeline-graph-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          margin: 0 200px;
        }

        .horizontal-axis-line {
          position: absolute;
          left: -160px;
          right: -160px;
          top: 50%;
          height: 3px;
          background: linear-gradient(90deg, rgba(139,92,246,0.05), rgba(192,132,252,0.7), rgba(139,92,246,0.05));
          transform: translateY(-50%);
          z-index: 1;
          box-shadow: 0 0 12px rgba(139, 92, 246, 0.35);
          border-radius: 2px;
        }

        .timeline-nodes-container {
          position: relative;
          z-index: 2;
        }

        .timeline-node-column {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          width: 40px;
          height: 0;
          justify-content: center;
        }

        .node-positioner {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          z-index: 10;
        }

        .timeline-circle-node {
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
          position: relative;
          z-index: 20;
        }

        .timeline-circle-node:hover {
          transform: scale(1.4);
          z-index: 50;
        }

        .stem-connector-line {
          position: absolute;
          width: 2px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 5;
          pointer-events: none;
        }

        /* Subtle Year Reference along Axis */
        .axis-year-reference {
          position: absolute;
          top: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          pointer-events: none;
          z-index: 4;
        }

        .axis-tick {
          width: 1px;
          height: 6px;
          background: rgba(255, 255, 255, 0.2);
        }

        .axis-year-text {
          font-size: 0.7rem;
          font-weight: 500;
          color: #71717a;
          letter-spacing: 0.03em;
        }

        /* Tooltip Styling */
        .node-tooltip {
          position: absolute;
          min-width: 180px;
          max-width: 260px;
          padding: 10px 14px;
          border-radius: 12px;
          background: rgba(18, 18, 26, 0.95);
          border: 1px solid rgba(192, 132, 252, 0.4);
          box-shadow: 0 10px 30px rgba(0,0,0,0.7);
          pointer-events: none;
          z-index: 100;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .tooltip-above {
          bottom: 44px;
          left: 50%;
          transform: translateX(-50%);
        }

        .tooltip-below {
          top: 44px;
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
