import React, { useRef, useEffect } from 'react';
import { KymaItem } from '../lib/db/client';

interface OrbitsViewProps {
  people: KymaItem[];
  onPersonClick: (person: KymaItem) => void;
}

interface SimulationNode {
  id: string;
  item: KymaItem;
  cx: number;
  cy: number;
  vx: number;
  vy: number;
  radius: number;
  angle: number;
  angularSpeed: number;
  initials: string;
  closeness: string;
}

export function OrbitsView({ people, onPersonClick }: OrbitsViewProps) {
  const domElementsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const nodesRef = useRef<SimulationNode[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = React.useState(0.85);

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const panXRef = useRef(0);
  const panYRef = useRef(0);
  const draggedRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(0.85);

  // Touch event refs
  const isTouchDraggingRef = useRef(false);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const initialPinchDistRef = useRef(0);
  const initialZoomRef = useRef(0.85);
  const isPinchingRef = useRef(false);

  // Sync zoom ref
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Helper to get initials
  const getInitials = (title: string) => {
    return title.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getFrequencyLabel = (freq?: number) => {
    if (freq === undefined) return '';
    if (freq >= 100) return 'diario';
    if (freq >= 75) return 'semanal';
    if (freq >= 50) return 'mensual';
    if (freq >= 25) return 'anual';
    return 'nada';
  };

  const getFrequencyOpacity = (freq?: number) => {
    if (freq === undefined) return 1;
    if (freq >= 100) return 1.0;
    if (freq >= 75) return 0.8;
    if (freq >= 50) return 0.6;
    if (freq >= 25) return 0.4;
    return 0.2;
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomStep = 0.001;
      const minZoom = 0.35;
      const maxZoom = 2.5;
      setZoom(prev => {
        const next = prev - e.deltaY * zoomStep;
        const clamped = Math.max(minZoom, Math.min(maxZoom, next));
        if (viewportRef.current) {
          viewportRef.current.style.transform = `translate(${panXRef.current}px, ${panYRef.current}px) scale(${clamped})`;
        }
        return clamped;
      });
    };

    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      draggedRef.current = false;
      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
      startXRef.current = e.clientX - panXRef.current;
      startYRef.current = e.clientY - panYRef.current;
      container.style.cursor = 'grabbing';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      
      const dx = e.clientX - dragStartPosRef.current.x;
      const dy = e.clientY - dragStartPosRef.current.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 5) {
        draggedRef.current = true;
      }

      panXRef.current = e.clientX - startXRef.current;
      panYRef.current = e.clientY - startYRef.current;

      if (viewportRef.current) {
        viewportRef.current.style.transform = `translate(${panXRef.current}px, ${panYRef.current}px) scale(${zoomRef.current})`;
      }
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      container.style.cursor = 'grab';
    };

    // Touch handlers for mobile / tablet (pinch to zoom & drag pan outside buttons)
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
        initialZoomRef.current = zoomRef.current;
      } else if (e.touches.length === 1) {
        const target = e.target as HTMLElement;
        const isInteractive = target && (target.closest('button') || target.closest('.person-node'));
        if (!isInteractive) {
          isTouchDraggingRef.current = true;
          draggedRef.current = false;
          dragStartPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          touchStartXRef.current = e.touches[0].clientX - panXRef.current;
          touchStartYRef.current = e.touches[0].clientY - panYRef.current;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinchingRef.current) {
        e.preventDefault();
        const currentDist = getTouchDist(e.touches);
        if (initialPinchDistRef.current > 0) {
          const scaleFactor = currentDist / initialPinchDistRef.current;
          const minZoom = 0.35;
          const maxZoom = 2.5;
          const next = initialZoomRef.current * scaleFactor;
          const clamped = Math.max(minZoom, Math.min(maxZoom, next));
          setZoom(clamped);
          if (viewportRef.current) {
            viewportRef.current.style.transform = `translate(${panXRef.current}px, ${panYRef.current}px) scale(${clamped})`;
          }
        }
      } else if (e.touches.length === 1 && isTouchDraggingRef.current) {
        e.preventDefault();
        const dx = e.touches[0].clientX - dragStartPosRef.current.x;
        const dy = e.touches[0].clientY - dragStartPosRef.current.y;
        if (Math.hypot(dx, dy) > 5) {
          draggedRef.current = true;
        }

        panXRef.current = e.touches[0].clientX - touchStartXRef.current;
        panYRef.current = e.touches[0].clientY - touchStartYRef.current;

        if (viewportRef.current) {
          viewportRef.current.style.transform = `translate(${panXRef.current}px, ${panYRef.current}px) scale(${zoomRef.current})`;
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        isPinchingRef.current = false;
      }
      if (e.touches.length === 0) {
        isTouchDraggingRef.current = false;
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);

    container.style.cursor = 'grab';

    return () => {
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  useEffect(() => {
    // Separate by group to calculate their starting angular distribution
    const nucleoGroup = people.filter(p => p.cercania === 'nucleo');
    const cercanaGroup = people.filter(p => p.cercania === 'cercana');
    const orbitaGroup = people.filter(p => p.cercania === 'orbita' || !p.cercania);

    const simNodes: SimulationNode[] = [];

    const setupGroup = (group: KymaItem[], radius: number, speed: number) => {
      group.forEach((p, idx) => {
        const baseAngle = (idx / group.length) * 2 * Math.PI + 0.5;
        // Start near the center with a slight random displacement
        const startAngle = Math.random() * 2 * Math.PI;
        const startDist = Math.random() * 10;
        
        // Blast outwards with velocity in the direction of the target angle
        const blastForce = 5 + Math.random() * 4;
        const vx = Math.cos(baseAngle) * blastForce;
        const vy = Math.sin(baseAngle) * blastForce;

        simNodes.push({
          id: p.id,
          item: p,
          cx: Math.cos(startAngle) * startDist,
          cy: Math.sin(startAngle) * startDist,
          vx,
          vy,
          radius,
          angle: baseAngle,
          angularSpeed: speed,
          initials: getInitials(p.title),
          closeness: p.cercania || 'orbita'
        });
      });
    };

    setupGroup(nucleoGroup, 75, 0.0006);
    setupGroup(cercanaGroup, 150, 0.0003);
    setupGroup(orbitaGroup, 225, 0.00015);

    nodesRef.current = simNodes;

    let animFrameId: number;
    const springK = 0.015; // Soft spring pull for organic movement
    const friction = 0.90; // Smooth deceleration

    const tick = () => {
      nodesRef.current.forEach(node => {
        // Increment target angle (orbital rotation)
        node.angle += node.angularSpeed;

        // Target coordinates on the orbit track
        const tx = Math.cos(node.angle) * node.radius;
        const ty = Math.sin(node.angle) * node.radius;

        // Gravity pull to target
        const ax = (tx - node.cx) * springK;
        const ay = (ty - node.cy) * springK;

        // Update velocity
        node.vx = (node.vx + ax) * friction;
        node.vy = (node.vy + ay) * friction;

        // Update position
        node.cx += node.vx;
        node.cy += node.vy;

        // Apply style to the DOM node directly
        const el = domElementsRef.current.get(node.id);
        if (el) {
          el.style.transform = `translate(${node.cx}px, ${node.cy}px)`;
        }
      });

      animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [people]);

  return (
    <div ref={containerRef} className="orbits-container">
      <div 
        ref={viewportRef} 
        className="orbits-viewport" 
        style={{ transform: `translate(${panXRef.current}px, ${panYRef.current}px) scale(${zoom})` }}
      >
        {/* Core Center (The User) */}
        <div className="orbit-center">
          <div className="core-glow" />
          <div className="core-dot">
            <span className="core-label">Tú</span>
          </div>
        </div>

        {/* Concentric Rings */}
        <div className="orbit-ring ring-nucleo" />
        <div className="orbit-ring ring-cercana" />
        <div className="orbit-ring ring-orbita" />

        {/* Person Nodes */}
        {people.map((p) => (
          <button
            key={p.id}
            ref={(el) => {
              if (el) domElementsRef.current.set(p.id, el);
              else domElementsRef.current.delete(p.id);
            }}
            className="person-node"
            style={{ transform: `translate(0px, 0px)` }}
            onClick={(e) => {
              if (draggedRef.current) {
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              onPersonClick(p);
            }}
            title={`${p.title} (${p.cercania === 'nucleo' ? 'Núcleo' : p.cercania === 'cercana' ? 'Cercana' : 'Órbita'}) - Frecuencia: ${getFrequencyLabel(p.frecuencia)}`}
          >
            <div 
              className={`node-circle node-${p.cercania || 'orbita'} ${p.cercania === 'nucleo' ? 'pulse-glow-node' : ''}`}
              style={{ opacity: getFrequencyOpacity(p.frecuencia) }}
            />
            <span className="node-name">{p.title}</span>
          </button>
        ))}
      </div>

      <style jsx>{`
        .orbits-container {
          width: 100%;
          flex: 1;
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0;
          background: transparent;
          border: none;
          touch-action: none;
        }

        .orbits-viewport {
          position: relative;
          width: 500px;
          height: 500px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
          transition: transform 0.1s ease-out;
        }
        
        @media (max-width: 600px) {
          .orbits-viewport {
            margin: -60px 0;
          }
        }

        /* Concentric Rings */
        .orbit-ring {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          border: 1px dashed var(--border-subtle);
          border-radius: 50%;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          pointer-events: none;
        }
        .ring-nucleo {
          width: 150px;
          height: 150px;
          border-style: solid;
          border-color: rgba(139, 92, 246, 0.15);
        }
        .ring-cercana {
          width: 300px;
          height: 300px;
          border-color: rgba(252, 252, 253, 0.1);
        }
        .ring-orbita {
          width: 450px;
          height: 450px;
          border-color: rgba(252, 252, 253, 0.05);
        }

        .ring-label {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          background: var(--bg-primary);
          padding: 2px 6px;
          margin-top: -8px;
          border-radius: 4px;
        }

        /* Core dot */
        .orbit-center {
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: 5;
        }
        .core-glow {
          position: absolute;
          width: 60px;
          height: 60px;
          background: var(--accent-gradient);
          border-radius: 50%;
          filter: blur(12px);
          opacity: 0.3;
          transform: translate(-50%, -50%);
          animation: pulseCenter 4s infinite ease-in-out;
        }
        .core-dot {
          position: relative;
          width: 44px;
          height: 44px;
          background: var(--accent-gradient);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: translate(-50%, -50%);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }
        .core-label {
          font-size: 0.85rem;
          color: #fff;
          font-weight: 600;
          letter-spacing: 0.02em;
        }

        @keyframes pulseCenter {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
          50% { transform: translate(-50%, -50%) scale(1.3); opacity: 0.6; }
        }

        /* Person Nodes */
        .person-node {
          position: absolute;
          width: 44px;
          height: 44px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          left: 50%;
          top: 50%;
          margin-left: -22px;
          margin-top: -22px;
          outline: none;
          background: transparent;
          border: none;
          padding: 0;
          animation: scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        
        @keyframes scaleIn {
          from {
            scale: 0;
            opacity: 0;
          }
          to {
            scale: 1;
            opacity: 1;
          }
        }
        
        .node-circle {
          border-radius: 50%;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          flex-shrink: 0;
          position: relative;
        }

        .person-node:hover .node-circle {
          scale: 1.25;
          z-index: 20;
        }

        .node-name {
          position: absolute;
          top: 100%;
          margin-top: 4px;
          font-size: 0.75rem;
          color: var(--text-primary);
          white-space: nowrap;
          pointer-events: none;
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
          opacity: 0.85;
          transition: opacity 0.2s ease;
        }
        
        .person-node:hover .node-name {
          opacity: 1;
        }

        /* Closeness styling overrides: Solid filled colors & sizes */
        .node-nucleo {
          width: 30px;
          height: 30px;
          background: linear-gradient(135deg, #c084fc, #ec4899);
          border: none;
          box-shadow: 0 0 16px rgba(192, 132, 252, 0.6);
        }
        
        .pulse-glow-node::after {
          content: '';
          position: absolute;
          inset: -4px;
          border: 1px solid #ec4899;
          border-radius: 50%;
          opacity: 0.4;
          animation: pulseNode 3s infinite ease-in-out;
        }

        @keyframes pulseNode {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(1.25); opacity: 0.5; }
        }

        .node-cercana {
          width: 20px;
          height: 20px;
          background: linear-gradient(135deg, #38bdf8, #818cf8);
          border: none;
          box-shadow: 0 0 12px rgba(56, 189, 248, 0.4);
        }
        .node-orbita {
          width: 14px;
          height: 14px;
          background: linear-gradient(135deg, #94a3b8, #64748b);
          border: none;
          box-shadow: 0 0 8px rgba(148, 163, 184, 0.3);
        }

      `}</style>
    </div>
  );
}
