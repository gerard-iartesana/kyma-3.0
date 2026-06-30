import React, { useState, useRef } from 'react';
import { KymaItem } from '../lib/db/client';
import { Star, Sparkles, MapPin, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface EstelaHorizontalTimelineViewProps {
  items: KymaItem[];
  sortAsc?: boolean;
  onItemClick: (item: KymaItem) => void;
  pxPerYear?: number;
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

const getMonthIndex = (monthStr?: string): number => {
  if (!monthStr) return 5;
  const m = monthStr.toLowerCase();
  if (m.includes('ene')) return 0;
  if (m.includes('feb')) return 1;
  if (m.includes('mar')) return 2;
  if (m.includes('abr')) return 3;
  if (m.includes('may')) return 4;
  if (m.includes('jun')) return 5;
  if (m.includes('jul')) return 6;
  if (m.includes('ago')) return 7;
  if (m.includes('sep')) return 8;
  if (m.includes('oct')) return 9;
  if (m.includes('nov')) return 10;
  if (m.includes('dic')) return 11;
  return 5;
};

export function EstelaHorizontalTimelineView({ 
  items, 
  sortAsc = false, 
  onItemClick,
  pxPerYear
}: EstelaHorizontalTimelineViewProps) {
  const estelaItems = items.filter(i => i.doorId === 'estela');
  const currentYear = new Date().getFullYear();

  // Helper to extract year and a precise fractional month
  const itemsWithTime = React.useMemo(() => {
    const processed = estelaItems.map(item => {
      let year = item.year;
      if (!year && item.eventDate) {
        const y = parseInt(item.eventDate.split('-')[0]);
        if (!isNaN(y)) year = y;
      }
      if (!year) year = new Date().getFullYear();

      let month = 5; // default June (middle of the year)
      if (item.eventDate) {
        const m = parseInt(item.eventDate.split('-')[1]);
        if (!isNaN(m)) month = m - 1;
      } else if (item.dateStr) {
        month = getMonthIndex(item.dateStr);
      }
      
      const timeVal = year + (month / 12);
      return { item, year, month, timeVal };
    });

    // Sort chronologically by fractional year
    processed.sort((a, b) => a.timeVal - b.timeVal);

    // Add index offset for duplicate/close times to prevent visual stack overlapping
    const timeValCounts: Record<number, number> = {};
    return processed.map(it => {
      const currentCount = timeValCounts[it.timeVal] || 0;
      timeValCounts[it.timeVal] = currentCount + 1;
      return { ...it, offsetIndex: currentCount };
    });
  }, [estelaItems]);

  const minTimeVal = React.useMemo(() => {
    if (itemsWithTime.length === 0) return new Date().getFullYear() - 5;
    return Math.floor(itemsWithTime[0].timeVal);
  }, [itemsWithTime]);

  const PX_PER_YEAR = pxPerYear || 120; // Use the toggleable scale from props (default 120px)

  const itemPositions = React.useMemo(() => {
    return itemsWithTime.map(it => {
      // 50px padding to start, items proportional to timeVal, duplicate items offset by 0.05 year (18 days)
      const rawX = (it.timeVal + (it.offsetIndex * 0.05) - minTimeVal) * PX_PER_YEAR;
      const x = 50 + rawX;
      return { item: it.item, year: it.year, x, timeVal: it.timeVal };
    });
  }, [itemsWithTime, minTimeVal, PX_PER_YEAR]);

  const currentYearX = React.useMemo(() => {
    return 50 + (currentYear - minTimeVal) * PX_PER_YEAR;
  }, [minTimeVal, currentYear, PX_PER_YEAR]);

  const totalWidth = React.useMemo(() => {
    const maxX = itemPositions.reduce((max, p) => Math.max(max, p.x), currentYearX);
    return maxX + 150; // Extra 150px padding at the end of the timeline
  }, [itemPositions, currentYearX]);

  const calendarYears = React.useMemo(() => {
    const range: number[] = [];
    const minYear = minTimeVal;
    for (let y = minYear; y <= currentYear; y++) {
      range.push(y);
    }
    return range;
  }, [minTimeVal, currentYear]);

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
          const minScale = 0.1;
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
    setScale(prev => Math.min(Math.max(prev * zoomFactor, 0.1), 3.0));
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
          <div className="timeline-graph-wrapper" style={{ width: `${totalWidth}px`, minWidth: `${totalWidth}px`, height: '360px' }}>
            {/* Center Axis Line (Faint at origin, intense at current year) */}
            <div 
              className="horizontal-axis-line" 
              style={{
                left: '0px',
                width: `${currentYearX + 80}px`,
                right: 'auto'
              }}
            />

            {/* Proportional Year Reference Ticks and Labels along the Axis */}
            <div className="timeline-axis-ticks-container" style={{ position: 'absolute', top: '50%', left: '0px', width: '100%', height: '0px', pointerEvents: 'none' }}>
              {calendarYears.map(year => {
                const yearX = 50 + (year - minTimeVal) * PX_PER_YEAR;
                const isCurrentYear = year === currentYear;
                return (
                  <div 
                    key={year}
                    className="axis-year-reference"
                    style={{
                      position: 'absolute',
                      left: `${yearX}px`,
                      top: '12px',
                      transform: 'translateX(-50%)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                  >
                    <div 
                      className="axis-tick" 
                      style={{ 
                        height: isCurrentYear ? '8px' : '6px',
                        background: isCurrentYear ? '#ec4899' : 'rgba(255, 255, 255, 0.25)',
                        width: isCurrentYear ? '2px' : '1px'
                      }} 
                    />
                    <span 
                      className="axis-year-text"
                      style={{
                        color: isCurrentYear ? '#ec4899' : '#71717a',
                        fontWeight: isCurrentYear ? 700 : 500
                      }}
                    >
                      {year}
                    </span>
                  </div>
                );
              })}
            </div>

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
                  </div>
                );
              })}

              {/* Current Year Cutoff Node */}
              <div 
                className="timeline-node-column current-year-cutoff-col"
                style={{
                  position: 'absolute',
                  left: `${currentYearX}px`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 6
                }}
              >
                <div 
                  className="current-year-cutoff-dot"
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: '#ec4899',
                    boxShadow: '0 0 16px #ec4899, 0 0 6px #ffffff',
                    border: '2px solid #ffffff'
                  }}
                  title={`Año actual (${currentYear})`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`

        .interactive-timeline-viewport {
          position: relative;
          width: 100%;
          flex: 1;
          height: 100%;
          min-height: 0;
          background: transparent;
          overflow: visible;
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
          padding: 60px 180px;
        }

        .timeline-graph-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          margin: 0 200px;
        }

        .horizontal-axis-line {
          position: absolute;
          top: 50%;
          height: 4px;
          background: linear-gradient(90deg, rgba(139, 92, 246, 0.04) 0%, rgba(168, 85, 247, 0.45) 60%, rgba(236, 72, 153, 1) 100%);
          transform: translateY(-50%);
          z-index: 1;
          box-shadow: 0 0 16px rgba(236, 72, 153, 0.6);
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
