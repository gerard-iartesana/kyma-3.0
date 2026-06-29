import React, { useRef, useEffect, useState } from 'react';
import { KymaItem } from '../lib/db/client';

interface InterestsMapViewProps {
  interests: KymaItem[];
  onInterestClick: (interest: KymaItem) => void;
  onTagSelect?: (tag: string) => void;
}

interface SimNode {
  id: string;
  type: 'tag' | 'card';
  title: string;
  radius: number;
  colors: string[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  tag?: string;
  count?: number;
  item?: KymaItem;
}

interface SimLink {
  id: string;
  source: SimNode;
  target: SimNode;
  weight: number;
}

const CATEGORY_DEFINITIONS = [
  { name: 'Arte', tags: ['#cine', '#literatura', '#musica', '#música', '#pintura', '#teatro', '#arte', '#fotografia', '#fotografía', '#diseno', '#diseño'], colors: ['#f43f5e', '#ec4899', 'rgba(244, 63, 94, 0.12)'] },
  { name: 'Humanidades', tags: ['#filosofia', '#filosofía', '#historia', '#psicologia', '#psicología', '#sociologia', '#sociología', '#antropologia', '#antropología', '#humanidades', '#la-llegada'], colors: ['#f59e0b', '#d97706', 'rgba(245, 158, 11, 0.12)'] },
  { name: 'Tecnología', tags: ['#desarrollo', '#ia', '#software', '#tecnologia', '#tecnología', '#programacion', '#programación', '#ingenieria', '#ingeniería', '#kyma'], colors: ['#3b82f6', '#1d4ed8', 'rgba(59, 130, 246, 0.12)'] },
  { name: 'Ciencia', tags: ['#fisica', '#física', '#biologia', '#biología', '#matematicas', '#matemáticas', '#ciencia', '#astronomia', '#astronomía', '#quimica', '#química'], colors: ['#10b981', '#047857', 'rgba(16, 185, 129, 0.12)'] },
  { name: 'Estilo de Vida', tags: ['#deporte', '#viajes', '#cocina', '#gastronomia', '#gastronomía', '#bienestar', '#salud', '#naturaleza', '#estilo-de-vida'], colors: ['#a855f7', '#7c3aed', 'rgba(168, 85, 247, 0.12)'] }
];

const getCategoryForTag = (tag: string) => {
  const t = tag.toLowerCase();
  for (const cat of CATEGORY_DEFINITIONS) {
    if (cat.tags.includes(t)) {
      return cat;
    }
  }
  return null;
};

export function InterestsMapView({ interests, onInterestClick, onTagSelect }: InterestsMapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(0.85);

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

  // Persistent simulation nodes and links
  const simNodesRef = useRef<Map<string, SimNode>>(new Map());
  const linksRef = useRef<SimLink[]>([]);
  const domNodesRef = useRef<Map<string, SVGGElement>>(new Map());
  const domLinesRef = useRef<Map<string, SVGLineElement>>(new Map());

  // Sync zoom ref
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Setup pan & zoom listeners
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

    // Touch handlers for mobile / tablet
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
        const isInteractive = target && (target.closest('g.sim-node') || target.closest('.clickable'));
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

  // Process nodes and links
  const nodes: SimNode[] = [];
  const links: SimLink[] = [];

  // 1. Find all unique tags (excluding '#intereses')
  const uniqueTagsMap = new Map<string, KymaItem[]>();
  interests.forEach(item => {
    const cleanTags = item.tags.filter(t => t !== '#intereses');
    cleanTags.forEach(tag => {
      if (!uniqueTagsMap.has(tag)) {
        uniqueTagsMap.set(tag, []);
      }
      uniqueTagsMap.get(tag)!.push(item);
    });
  });

  // 2. Build Tag Nodes (Hubs) - faint background, borderless
  uniqueTagsMap.forEach((itemsWithTag, tag) => {
    const cat = getCategoryForTag(tag);
    const colors = cat ? cat.colors : ['#6b7280', '#4b5563', 'rgba(107, 114, 128, 0.12)'];
    // Tag radius is proportional to the number of cards that mention it
    const tagRadius = 26 + itemsWithTag.length * 8; // 1 card = 34px, 3 cards = 50px

    nodes.push({
      id: `tag-${tag}`,
      type: 'tag',
      title: tag.startsWith('#') ? tag.slice(1) : tag,
      radius: tagRadius,
      colors,
      tag,
      count: itemsWithTag.length,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0
    });
  });

  // 3. Build Card Nodes (Satellites) - solid 100% color
  interests.forEach(item => {
    let firstCatColors = ['#6b7280', '#4b5563', 'rgba(107, 114, 128, 0.12)'];
    const cleanTags = item.tags.filter(t => t !== '#intereses');
    for (const tag of cleanTags) {
      const cat = getCategoryForTag(tag);
      if (cat) {
        firstCatColors = cat.colors;
        break;
      }
    }
    const cardRadius = 24 + item.peso * 6; // peso 1 = 30px, peso 2 = 36px, peso 3 = 42px

    nodes.push({
      id: `card-${item.id}`,
      type: 'card',
      title: item.title,
      radius: cardRadius,
      colors: firstCatColors,
      item,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0
    });
  });

  // 4. Update or sync simulation nodes in useRef
  const updatedSimNodes = new Map<string, SimNode>();
  nodes.forEach(node => {
    const existing = simNodesRef.current.get(node.id);
    if (existing) {
      // Keep position & velocity
      node.x = existing.x;
      node.y = existing.y;
      node.vx = existing.vx;
      node.vy = existing.vy;
    } else {
      // Initialize near center with random blast
      const angle = Math.random() * 2 * Math.PI;
      const dist = 30 + Math.random() * 60;
      node.x = Math.cos(angle) * dist;
      node.y = Math.sin(angle) * dist;
      node.vx = (Math.random() - 0.5) * 4;
      node.vy = (Math.random() - 0.5) * 4;
    }
    updatedSimNodes.set(node.id, node);
  });
  simNodesRef.current = updatedSimNodes;

  // 5. Generate links (only between Card Node and Tag Nodes)
  interests.forEach(item => {
    const cleanTags = item.tags.filter(t => t !== '#intereses');
    const cardNode = simNodesRef.current.get(`card-${item.id}`);
    if (!cardNode) return;

    cleanTags.forEach(tag => {
      const tagNode = simNodesRef.current.get(`tag-${tag}`);
      if (!tagNode) return;

      links.push({
        id: `${item.id}-${tag}`,
        source: cardNode,
        target: tagNode,
        weight: 1
      });
    });
  });
  linksRef.current = links;

  // Setup force-directed simulation loop
  useEffect(() => {
    let animFrameId: number;

    const baseSpringK = 0.010; // Softer springs for more breathing room
    const restLength = 160; // Distance between connected card and tag nodes
    const repulsion = 4500; // Stronger base repulsion charge
    const centerGravity = 0.0014; // MUCH weaker gravity to prevent squashing/clumping
    const friction = 0.88; // Damping factor

    const tick = () => {
      const activeNodes = Array.from(simNodesRef.current.values());
      const activeLinks = linksRef.current;

      // Initialize force accumulators
      const fx = new Map<string, number>();
      const fy = new Map<string, number>();
      activeNodes.forEach(n => {
        fx.set(n.id, 0);
        fy.set(n.id, 0);
      });

      // 1. Link Attraction Force (Springs: Card Node <-> Tag Node)
      activeLinks.forEach(link => {
        const s = link.source;
        const t = link.target;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.hypot(dx, dy) || 1;

        // Dynamic spring coefficient: larger hubs attract connected cards with stronger gravity
        const tagNode = t;
        const dynamicSpringK = baseSpringK * (1 + (tagNode.radius - 26) * 0.05);

        const force = (dist - restLength) * dynamicSpringK;
        const ax = (dx / dist) * force;
        const ay = (dy / dist) * force;

        if (fx.has(s.id)) fx.set(s.id, fx.get(s.id)! + ax);
        if (fy.has(s.id)) fy.set(s.id, fy.get(s.id)! + ay);
        if (fx.has(t.id)) fx.set(t.id, fx.get(t.id)! - ax);
        if (fy.has(t.id)) fy.set(t.id, fy.get(t.id)! - ay);
      });

      // 2. Many-Body Repulsion (between all pairs of nodes)
      for (let i = 0; i < activeNodes.length; i++) {
        const n1 = activeNodes[i];
        for (let j = i + 1; j < activeNodes.length; j++) {
          const n2 = activeNodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.hypot(dx, dy) || 1;

          if (dist < 600) {
            // Scale charge by the sizes of the two nodes (larger hubs repel each other much more)
            const dynamicRepulsion = repulsion * (n1.radius * n2.radius) / 900;
            const force = -dynamicRepulsion / (dist * dist + 100);
            const ax = (dx / dist) * force;
            const ay = (dy / dist) * force;

            if (fx.has(n1.id)) fx.set(n1.id, fx.get(n1.id)! + ax);
            if (fy.has(n1.id)) fy.set(n1.id, fy.get(n1.id)! + ay);
            if (fx.has(n2.id)) fx.set(n2.id, fx.get(n2.id)! - ax);
            if (fy.has(n2.id)) fy.set(n2.id, fy.get(n2.id)! - ay);
          }
        }
      }

      // 3. Center Gravity (prevent drift)
      activeNodes.forEach(node => {
        if (fx.has(node.id)) fx.set(node.id, fx.get(node.id)! - node.x * centerGravity);
        if (fy.has(node.id)) fy.set(node.id, fy.get(node.id)! - node.y * centerGravity);
      });

      // 4. Collision Avoidance (push apart overlapping elements)
      for (let i = 0; i < activeNodes.length; i++) {
        const n1 = activeNodes[i];
        for (let j = i + 1; j < activeNodes.length; j++) {
          const n2 = activeNodes[j];
          const minDist = n1.radius + n2.radius + 24;
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.hypot(dx, dy) || 1;

          if (dist < minDist) {
            const overlap = minDist - dist;
            const pushX = (dx / dist) * overlap * 0.5;
            const pushY = (dy / dist) * overlap * 0.5;

            if (fx.has(n1.id)) fx.set(n1.id, fx.get(n1.id)! - pushX);
            if (fy.has(n1.id)) fy.set(n1.id, fy.get(n1.id)! - pushY);
            if (fx.has(n2.id)) fx.set(n2.id, fx.get(n2.id)! + pushX);
            if (fy.has(n2.id)) fy.set(n2.id, fy.get(n2.id)! + pushY);
          }
        }
      }

      // 5. Apply Forces & Velocities and Update Positions
      activeNodes.forEach(node => {
        const ax = fx.get(node.id) || 0;
        const ay = fy.get(node.id) || 0;

        node.vx = (node.vx + ax) * friction;
        node.vy = (node.vy + ay) * friction;
        node.x += node.vx;
        node.y += node.vy;

        // Apply style directly to DOM elements
        const nodeEl = domNodesRef.current.get(node.id);
        if (nodeEl) {
          nodeEl.style.transform = `translate(${node.x}px, ${node.y}px)`;
        }
      });

      // 6. Direct DOM update of Link lines
      activeLinks.forEach(link => {
        const lineEl = domLinesRef.current.get(link.id);
        if (lineEl) {
          lineEl.setAttribute('x1', link.source.x.toString());
          lineEl.setAttribute('y1', link.source.y.toString());
          lineEl.setAttribute('x2', link.target.x.toString());
          lineEl.setAttribute('y2', link.target.y.toString());
        }
      });

      animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, []);

  const getFaintFill = (node: SimNode) => {
    const primaryColor = node.colors[0];
    if (primaryColor.startsWith('#')) {
      const hex = primaryColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, 0.055)`;
    }
    return 'rgba(255, 255, 255, 0.04)';
  };

  const getGradId = (node: SimNode) => {
    const cat = getCategoryForNode(node);
    return cat ? `grad-${cat.name.replace(/\s+/g, '')}` : 'grad-Otros';
  };

  const getShadowId = (node: SimNode) => {
    const cat = getCategoryForNode(node);
    return cat ? `shadow-${cat.name.replace(/\s+/g, '')}` : 'shadow-Otros';
  };

  const getCategoryForNode = (node: SimNode) => {
    if (node.type === 'tag' && node.tag) {
      return getCategoryForTag(node.tag);
    } else if (node.type === 'card' && node.item) {
      const cleanTags = node.item.tags.filter(t => t !== '#intereses');
      for (const tag of cleanTags) {
        const cat = getCategoryForTag(tag);
        if (cat) return cat;
      }
    }
    return null;
  };

  const getFontSize = (title: string) => {
    const len = title.length;
    if (len <= 10) return '11px';
    if (len <= 18) return '9.5px';
    if (len <= 26) return '8.5px';
    return '7.5px';
  };

  return (
    <div className="orbits-outer-container" ref={containerRef} style={{ width: '100%', flex: 1, height: '100%', minHeight: 0, overflow: 'visible', position: 'relative', touchAction: 'none' }}>
      <div 
        className="orbits-viewport" 
        ref={viewportRef}
        style={{
          width: '100%',
          height: '100%',
          transformOrigin: 'center center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: isDraggingRef.current ? 'none' : 'transform 0.15s ease-out',
        }}
      >
        <svg 
          width="1800" 
          height="1800" 
          style={{ overflow: 'visible', pointerEvents: 'none' }}
          viewBox="-900 -900 1800 1800"
        >
          <defs>
            {CATEGORY_DEFINITIONS.map(cat => (
              <linearGradient key={cat.name} id={`grad-${cat.name.replace(/\s+/g, '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={cat.colors[0]} />
                <stop offset="100%" stopColor={cat.colors[1]} />
              </linearGradient>
            ))}
            <linearGradient id="grad-Otros" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6b7280" />
              <stop offset="100%" stopColor="#4b5563" />
            </linearGradient>
            
            {CATEGORY_DEFINITIONS.map(cat => (
              <filter key={cat.name} id={`shadow-${cat.name.replace(/\s+/g, '')}`} x="-25%" y="-25%" width="150%" height="150%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor={cat.colors[0]} floodOpacity="0.25" />
              </filter>
            ))}
            <filter id="shadow-Otros" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#6b7280" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Grid lines to give a spatial mapping feeling */}
          <g opacity="0.04" stroke="var(--text-secondary)" strokeWidth="1">
            <circle cx="0" cy="0" r="150" fill="none" />
            <circle cx="0" cy="0" r="300" fill="none" />
            <circle cx="0" cy="0" r="450" fill="none" />
            <circle cx="0" cy="0" r="600" fill="none" />
            <line x1="-700" y1="0" x2="700" y2="0" />
            <line x1="0" y1="-700" x2="0" y2="700" />
          </g>

          {/* Connection Lines */}
          <g>
            {links.map(link => (
              <line
                key={link.id}
                ref={el => {
                  if (el) domLinesRef.current.set(link.id, el);
                  else domLinesRef.current.delete(link.id);
                }}
                stroke={link.target.colors[0]}
                strokeWidth="1.2"
                opacity="0.22"
                strokeDasharray="4,2"
              />
            ))}
          </g>

          {/* Nodes */}
          <g>
            {nodes.map(node => {
              const isTag = node.type === 'tag';
              const gradId = getGradId(node);
              const shadowId = getShadowId(node);

              return (
                <g
                  key={node.id}
                  ref={el => {
                    if (el) domNodesRef.current.set(node.id, el);
                    else domNodesRef.current.delete(node.id);
                  }}
                  style={{ pointerEvents: 'auto' }}
                  className={isTag ? "tag-node-group" : "card-node-group"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!draggedRef.current) {
                      if (isTag && node.tag && onTagSelect) {
                        onTagSelect(node.tag);
                      } else if (!isTag && node.item) {
                        onInterestClick(node.item);
                      }
                    }
                  }}
                >
                  {isTag ? (
                    // Tag node: Dashed border, transparent center
                    <>
                      <circle
                        cx="0"
                        cy="0"
                        r={node.radius}
                        stroke="none"
                        fill={getFaintFill(node)}
                        className="interest-circle-bubble tag-bubble"
                        style={{
                          transition: 'all 0.25s ease',
                          cursor: 'pointer'
                        }}
                      />
                      <text
                        x="0"
                        y="0"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={node.colors[0]}
                        fontSize={node.radius > 42 ? "12px" : "10px"}
                        fontWeight="700"
                        fontFamily="Noto Sans"
                        style={{ pointerEvents: 'none', userSelect: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                      >
                        {node.title.toUpperCase()}
                      </text>
                    </>
                  ) : (
                    // Card node: Glowing solid circle with title text
                    <>
                      <circle
                        cx="0"
                        cy="0"
                        r={node.radius}
                        fill={`url(#${gradId})`}
                        filter={`url(#${shadowId})`}
                        className="interest-circle-bubble card-bubble"
                        style={{
                          transition: 'all 0.25s ease',
                          cursor: 'pointer'
                        }}
                      />
                      <foreignObject
                        x={-node.radius * 0.85}
                        y={-node.radius * 0.85}
                        width={node.radius * 1.7}
                        height={node.radius * 1.7}
                        style={{ pointerEvents: 'none' }}
                      >
                        <div 
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            width: '100%',
                            textAlign: 'center',
                            fontSize: getFontSize(node.title),
                            fontWeight: '600',
                            color: '#ffffff',
                            textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                            padding: '2px',
                            overflow: 'hidden',
                            userSelect: 'none',
                            lineHeight: '1.2'
                          }}
                        >
                          {node.title}
                        </div>
                      </foreignObject>
                    </>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <style jsx>{`
        /* Hover enlargement and brightness boost for leaf circles */
        .card-node-group :global(.interest-circle-bubble.card-bubble) {
          transform-box: fill-box;
          transform-origin: center;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), filter 0.25s ease;
          cursor: pointer;
        }
        .card-node-group :global(.interest-circle-bubble.card-bubble:hover) {
          transform: scale(1.06);
          filter: brightness(1.15) saturate(1.1) drop-shadow(0 0 10px rgba(255,255,255,0.15)) !important;
        }

        .tag-node-group :global(.interest-circle-bubble.tag-bubble) {
          transform-box: fill-box;
          transform-origin: center;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.25s ease, border-color 0.25s ease;
          cursor: pointer;
        }
        .tag-node-group :global(.interest-circle-bubble.tag-bubble:hover) {
          transform: scale(1.04);
          filter: brightness(1.12) !important;
        }
      `}</style>
    </div>
  );
}
