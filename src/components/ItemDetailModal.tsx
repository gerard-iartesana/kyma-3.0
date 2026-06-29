import React, { useState, useEffect } from 'react';
import { KymaItem, dbClient } from '../lib/db/client';
import { X, Trash2, Save, Calendar, CheckSquare, Download, Heart } from 'lucide-react';
import { LogoIcon } from './Logo';

interface ItemDetailModalProps {
  item: KymaItem;
  onClose: () => void;
  onSave: (updatedItem: KymaItem) => void;
  onDelete: (id: string) => void;
  onAskKyma: (item: KymaItem) => void;
}

const snapFrequency = (freq?: number): number => {
  if (freq === undefined) return 50;
  if (freq >= 88) return 100;
  if (freq >= 63) return 75;
  if (freq >= 38) return 50;
  if (freq >= 13) return 25;
  return 0;
};

export function ItemDetailModal({ item, onClose, onSave, onDelete, onAskKyma }: ItemDetailModalProps) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  const [peso, setPeso] = useState<1 | 2 | 3>(item.peso);
  const [tagsInput, setTagsInput] = useState(item.tags.map(t => t.replace(/^#/, '')).join(', '));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Door-specific fields
  const [completed, setCompleted] = useState(item.completed || false);
  const [eventDate, setEventDate] = useState(item.eventDate || '');
  const [cercania, setCercania] = useState<'nucleo' | 'cercana' | 'orbita'>(item.cercania || 'orbita');
  const [frecuencia, setFrecuencia] = useState(() => snapFrequency(item.frecuencia));
  const [eventTime, setEventTime] = useState(item.eventTime || '');
  const [recurrencia, setRecurrencia] = useState<string>(item.recurrencia || 'none');
  const [year, setYear] = useState<number>(item.year || (item.eventDate ? parseInt(item.eventDate.split('-')[0]) : 2026));
  const [dateStr, setDateStr] = useState(item.dateStr || '');
  const [lugar, setLugar] = useState(item.lugar || '');
  const [emocion, setEmocion] = useState<1 | 2 | 3 | 4 | 5>(item.emocion || 4);

  // Sync state if item changes
  useEffect(() => {
    setTitle(item.title);
    setContent(item.content);
    setPeso(item.peso);
    setTagsInput(item.tags.map(t => t.replace(/^#/, '')).join(', '));
    setCompleted(item.completed || false);
    setEventDate(item.eventDate || '');
    setCercania(item.cercania || 'orbita');
    setFrecuencia(snapFrequency(item.frecuencia));
    setEventTime(item.eventTime || '');
    setRecurrencia(item.recurrencia || 'none');
    setYear(item.year || (item.eventDate ? parseInt(item.eventDate.split('-')[0]) : 2026));
    setDateStr(item.dateStr || '');
    setLugar(item.lugar || '');
    setEmocion(item.emocion || 4);
  }, [item]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    
    try {
      // Parse tags: split by comma, trim, remove #
      const tags = tagsInput
        .split(',')
        .map(t => t.trim().replace(/^#/, ''))
        .filter(t => t.length > 0);

      const updates: Partial<KymaItem> = {
        title,
        content,
        peso,
        tags,
        completed: item.doorId === 'tareas' ? completed : undefined,
        eventDate: item.doorId === 'agenda' ? eventDate : undefined,
        eventTime: item.doorId === 'agenda' ? eventTime : undefined,
        recurrencia: item.doorId === 'agenda' ? recurrencia : undefined,
        cercania: item.doorId === 'personas' ? cercania : undefined,
        frecuencia: item.doorId === 'personas' ? frecuencia : undefined,
        year: item.doorId === 'estela' ? year : undefined,
        dateStr: item.doorId === 'estela' ? dateStr : undefined,
        lugar: item.doorId === 'estela' ? lugar : undefined,
        emocion: item.doorId === 'estela' ? emocion : undefined
      };

      // If person is edited, adjust weight based on closeness
      if (item.doorId === 'personas') {
        updates.peso = cercania === 'nucleo' ? 3 : cercania === 'cercana' ? 2 : 1;
      }

      const updated = await dbClient.updateItem(item.id, updates);
      onSave(updated);
    } catch (err) {
      console.error(err);
      alert('Error al guardar los cambios en la base de datos.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    if (confirm('¿Estás seguro de que quieres borrar este elemento? Esta acción no se puede deshacer y Kyma olvidará esta información.')) {
      setIsDeleting(true);
      try {
        await dbClient.deleteItem(item.id);
        onDelete(item.id);
      } catch (err) {
        console.error(err);
        alert('Error al borrar el elemento.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleExportMarkdown = () => {
    const cleanTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const filename = `kyma-${item.doorId}-${cleanTitle || 'tarjeta'}.md`;

    const metadata = [
      `id: ${item.id}`,
      `tipo: ${item.doorId === 'personas' ? 'vinculo' : item.doorId === 'agenda' ? 'evento' : item.doorId.slice(0, -1)}`,
      `relevancia_peso: ${peso}`,
      `etiquetas: ${tagsInput}`,
      `fecha_creacion: ${item.createdAt}`
    ];

    if (item.doorId === 'tareas') {
      metadata.push(`hecha: ${completed}`);
    } else if (item.doorId === 'agenda') {
      metadata.push(`fecha_evento: ${eventDate}`);
      if (eventTime) metadata.push(`hora_evento: ${eventTime}`);
    } else if (item.doorId === 'personas') {
      metadata.push(`cercania: ${cercania}`);
      metadata.push(`frecuencia_score: ${frecuencia}`);
    }

    const markdownContent = `---
${metadata.join('\n')}
---

# ${title}

${content}
`;

    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Get Peso labels depending on door
  const getPesoLabel = () => {
    switch (item.doorId) {
      case 'tareas':
        return { label: 'Prioridad', options: [{ val: 1, text: 'Normal' }, { val: 3, text: 'Urgente' }] };
      case 'intereses':
        return { label: 'Afinidad', options: [{ val: 1, text: 'Curiosidad' }, { val: 3, text: 'Pasión' }] };
      case 'personas':
        return { label: 'Cercanía afectiva', options: [{ val: 1, text: 'Órbita' }, { val: 2, text: 'Cercana' }, { val: 3, text: 'Núcleo' }] };
      default:
        return { label: 'Relevancia', options: [{ val: 1, text: 'Normal' }, { val: 3, text: 'Destacado' }] };
    }
  };

  const pesoConfig = getPesoLabel();

  return (
    <div 
      className="modal-backdrop" 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '16px'
      }}
    >
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '86vh',
          overflowY: 'auto',
          borderRadius: '20px',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          background: 'rgba(18, 18, 28, 0.72)',
          backdropFilter: 'blur(28px) saturate(190%)',
          WebkitBackdropFilter: 'blur(28px) saturate(190%)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
        }}
      >
        <div className="modal-header">
          <div className="header-meta">
            <span className="door-pill uppercase">{item.doorId === 'personas' ? 'vínculos' : item.doorId}</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="modal-form">
          <div className="form-group">
            <label className="form-label">Título</label>
            <input 
              type="text" 
              className="input-field form-title-input" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="Título de la ficha..."
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contenido / Descripción</label>
            <textarea 
              className="input-field textarea-field" 
              rows={4} 
              value={content} 
              onChange={(e) => setContent(e.target.value)} 
              placeholder="Escribe aquí los detalles..."
            />
          </div>

          {/* DYNAMIC DOOR-SPECIFIC FORM FIELDS */}
          {item.doorId === 'agenda' && (
            <div className="form-row">
              <div className="form-group flex-1">
                <label className="form-label">Fecha del Evento</label>
                <input 
                  type="date" 
                  className="input-field" 
                  value={eventDate} 
                  onChange={(e) => setEventDate(e.target.value)} 
                />
              </div>
              <div className="form-group flex-1">
                <label className="form-label">Hora (Opcional)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={eventTime} 
                  onChange={(e) => setEventTime(e.target.value)} 
                  placeholder="ej: 18:30"
                />
              </div>
              <div className="form-group flex-1">
                <label className="form-label">Recurrencia</label>
                <select 
                  className="input-field"
                  value={recurrencia}
                  onChange={(e) => setRecurrencia(e.target.value)}
                >
                  <option value="none">Puntual (Sin repetición)</option>
                  <option value="semanal">Semanal (Cada semana)</option>
                  <option value="mensual">Mensual (Mismo día del mes)</option>
                  <option value="anual">Anual (Cumpleaños / Aniversarios)</option>
                  <option value="primer_lunes_mes">Primer Lunes de cada mes</option>
                  <option value="ultimo_viernes_mes">Último Viernes de cada mes</option>
                </select>
              </div>
            </div>
          )}

          {item.doorId === 'tareas' && (
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={completed} 
                  onChange={(e) => setCompleted(e.target.checked)}
                  className="custom-checkbox"
                />
                <span>Marcar tarea como completada</span>
              </label>
            </div>
          )}

          {item.doorId === 'personas' && (
            <div className="form-row">
              <div className="form-group flex-1">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Heart size={15} color="#ec4899" fill="#ec4899" /> Cercanía afectiva
                </label>
                <div className="radio-group">
                  {(['orbita', 'cercana', 'nucleo'] as const).map((level) => (
                    <label 
                      key={level} 
                      className={`radio-label ${cercania === level ? 'active' : ''}`}
                    >
                      <input 
                        type="radio" 
                        name="cercania" 
                        value={level} 
                        checked={cercania === level} 
                        onChange={() => {
                          setCercania(level);
                          setPeso(level === 'nucleo' ? 3 : level === 'cercana' ? 2 : 1);
                        }}
                      />
                      <span className="capitalize">{level === 'nucleo' ? 'Núcleo' : level === 'cercana' ? 'Cercana' : 'Órbita'}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="form-group flex-1">
                <label className="form-label">Ritmo de Contacto (Frecuencia deseada)</label>
                <div className="radio-group" style={{ gap: '6px' }}>
                  {[
                    { val: 100, label: 'Diario' },
                    { val: 75, label: 'Semanal' },
                    { val: 50, label: 'Mensual' },
                    { val: 25, label: 'Trimestral' },
                    { val: 0, label: 'Anual' }
                  ].map((fOption) => (
                    <label 
                      key={fOption.val} 
                      className={`radio-label ${frecuencia === fOption.val ? 'active' : ''}`}
                      style={{ padding: '6px 8px', fontSize: '0.78rem' }}
                    >
                      <input 
                        type="radio" 
                        name="frecuencia" 
                        value={fOption.val} 
                        checked={frecuencia === fOption.val} 
                        onChange={() => setFrecuencia(fOption.val)}
                      />
                      <span>{fOption.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {item.doorId === 'estela' && (
            <>
              <div className="form-row">
                <div className="form-group flex-1">
                  <label className="form-label">Año del Hito</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={year} 
                    onChange={(e) => setYear(parseInt(e.target.value) || 2026)} 
                  />
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">Fecha / Época</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={dateStr} 
                    onChange={(e) => setDateStr(e.target.value)} 
                    placeholder="ej: 14 de Mayo, Verano"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Lugar</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={lugar} 
                  onChange={(e) => setLugar(e.target.value)} 
                  placeholder="ej: París, Francia"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tono Emocional del Recuerdo</label>
                <div className="radio-group">
                  {[
                    { val: 1, label: 'Muy triste' },
                    { val: 2, label: 'Triste' },
                    { val: 3, label: 'Calma' },
                    { val: 4, label: 'Alegre' },
                    { val: 5, label: 'Muy alegre' }
                  ].map((eOption) => (
                    <label 
                      key={eOption.val} 
                      className={`radio-label ${emocion === eOption.val ? 'active' : ''}`}
                    >
                      <input 
                        type="radio" 
                        name="emocion" 
                        value={eOption.val} 
                        checked={emocion === eOption.val} 
                        onChange={() => setEmocion(eOption.val as any)}
                      />
                      <span>{eOption.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* COMMON FIELDS: RELEVANCE / WEIGHT & TAGS (Skip for personas) */}
          {item.doorId !== 'personas' && (
            <div className="form-group">
              <label className="form-label">{pesoConfig.label}</label>
              <div className="radio-group">
                {pesoConfig.options.map((opt) => (
                  <label 
                    key={opt.val} 
                    className={`radio-label ${peso === opt.val ? 'active' : ''}`}
                  >
                    <input 
                      type="radio" 
                      name="peso" 
                      value={opt.val} 
                      checked={peso === opt.val} 
                      onChange={() => setPeso(opt.val as 1 | 2 | 3)}
                    />
                    <span>{opt.text}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Etiquetas (separadas por comas)</label>
            <input 
              type="text" 
              className="input-field" 
              value={tagsInput} 
              onChange={(e) => setTagsInput(e.target.value)} 
              placeholder="ej: cine, trabajo, proyecto"
            />
          </div>

          <div className="modal-actions-container">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handleDelete}
              disabled={isDeleting}
              title="Borrar dato permanentemente"
              style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', gap: '6px' }}
            >
              <Trash2 size={16} />
              <span>{isDeleting ? 'Borrando...' : 'Borrar'}</span>
            </button>
            
            <div className="right-actions">
              <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ gap: '6px' }}>
                <Save size={16} />
                <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      <style jsx global>{`
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
        }
        .modal-content {
          width: 100%;
          max-width: 620px;
          max-height: 86vh;
          overflow-y: auto;
          border-radius: 20px;
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          background: rgba(18, 18, 26, 0.78) !important;
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.14) !important;
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1);
          animation: modalSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .modal-content::-webkit-scrollbar {
          width: 6px;
        }
        .modal-content::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 4px;
        }
        .modal-content::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.3);
          border-radius: 4px;
        }

        @keyframes modalSlide {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .header-meta {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .door-pill {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
          color: var(--accent-purple);
          font-weight: 600;
          font-size: 0.72rem;
          padding: 4px 10px;
          border-radius: 9999px;
          letter-spacing: 0.05em;
        }
        .uppercase { text-transform: uppercase; }
        
        .close-btn {
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 4px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        .close-btn:hover {
          color: var(--text-primary);
          background: var(--bg-tertiary);
        }

        .modal-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .form-row {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }
        .flex-1 { flex: 1; min-width: 200px; }
        
        .form-label {
          font-size: 0.82rem;
          color: var(--text-secondary);
          font-weight: 500;
        }
        .form-title-input {
          font-family: var(--font-serif);
          font-size: 1.3rem;
          font-weight: 600;
        }
        .textarea-field {
          resize: vertical;
          line-height: 1.5;
        }

        /* Radio selectors */
        .radio-group {
          display: flex;
          gap: 8px;
        }
        .radio-label {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 8px 12px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-secondary);
          color: var(--text-secondary);
          border-radius: var(--border-radius-md);
          font-size: 0.85rem;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        .radio-label input {
          display: none;
        }
        .radio-label:hover {
          border-color: var(--border-focus);
          color: var(--text-primary);
        }
        .radio-label.active {
          background: var(--bg-tertiary);
          border-color: var(--accent-purple);
          color: var(--text-primary);
        }

        /* Checkbox & Slider */
        .checkbox-group {
          justify-content: center;
        }
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 0.95rem;
        }
        .custom-checkbox {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }
        
        .slider-input {
          width: 100%;
          accent-color: var(--accent-purple);
          background: var(--bg-tertiary);
          height: 6px;
          border-radius: 3px;
          outline: none;
          margin-top: 8px;
        }

        /* Actions layout */
        .modal-actions-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 12px;
          padding-top: 18px;
          border-top: 1px solid var(--border-subtle);
        }
        .right-actions {
          display: flex;
          gap: 12px;
        }
        
        .text-muted { color: var(--text-muted); }
      `}</style>
    </div>
  );
}
