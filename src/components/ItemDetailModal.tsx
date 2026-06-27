import React, { useState, useEffect } from 'react';
import { KymaItem, dbClient } from '../lib/db/client';
import { X, Trash2, Save, Calendar, CheckSquare, Download } from 'lucide-react';
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
  const [tagsInput, setTagsInput] = useState(item.tags.join(', '));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Door-specific fields
  const [completed, setCompleted] = useState(item.completed || false);
  const [eventDate, setEventDate] = useState(item.eventDate || '');
  const [cercania, setCercania] = useState<'nucleo' | 'cercana' | 'orbita'>(item.cercania || 'orbita');
  const [frecuencia, setFrecuencia] = useState(() => snapFrequency(item.frecuencia));
  const [eventTime, setEventTime] = useState(item.eventTime || '');
  const [recurrencia, setRecurrencia] = useState<'none' | 'semanal' | 'mensual' | 'anual'>(item.recurrencia || 'none');
  const [year, setYear] = useState<number>(item.year || (item.eventDate ? parseInt(item.eventDate.split('-')[0]) : 2026));
  const [dateStr, setDateStr] = useState(item.dateStr || '');
  const [lugar, setLugar] = useState(item.lugar || '');
  const [emocion, setEmocion] = useState<1 | 2 | 3 | 4 | 5>(item.emocion || 4);

  // Sync state if item changes
  useEffect(() => {
    setTitle(item.title);
    setContent(item.content);
    setPeso(item.peso);
    setTagsInput(item.tags.join(', '));
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
      // Parse tags: split by comma, trim, ensure starts with #
      const tags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)
        .map(t => t.startsWith('#') ? t : `#${t}`);

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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-meta">
            <span className="door-pill uppercase">{item.doorId === 'personas' ? 'vínculos' : item.doorId}</span>
            <span className="text-muted font-mono text-xs">ID: {item.id}</span>
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
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contenido / Descripción</label>
            <textarea 
              className="input-field textarea-field" 
              value={content} 
              onChange={e => setContent(e.target.value)}
              rows={4}
              required
            />
          </div>

          <div className="form-row">
            {/* Conditional fields based on Door type */}
            {item.doorId === 'agenda' && (
              <>
                <div className="form-group flex-1">
                  <label className="form-label">Fecha del evento</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={eventDate} 
                    onChange={e => setEventDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">Hora del evento</label>
                  <input 
                    type="time" 
                    className="input-field" 
                    value={eventTime} 
                    onChange={e => setEventTime(e.target.value)}
                  />
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">Repetición</label>
                  <select 
                    className="input-field" 
                    value={recurrencia} 
                    onChange={e => setRecurrencia(e.target.value as any)}
                  >
                    <option value="none">No se repite</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensual">Mensual</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
              </>
            )}

            {item.doorId === 'tareas' && (
              <div className="form-group flex-1 checkbox-group">
                <label className="form-label checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={completed} 
                    onChange={e => setCompleted(e.target.checked)}
                    className="custom-checkbox"
                  />
                  <span>Completada</span>
                </label>
              </div>
            )}

            {item.doorId === 'personas' && (
              <>
                <div className="form-group flex-1">
                  <label className="form-label">Cercanía Afectiva</label>
                  <select 
                    className="input-field" 
                    value={cercania} 
                    onChange={e => {
                      const val = e.target.value as 'nucleo' | 'cercana' | 'orbita';
                      setCercania(val);
                    }}
                  >
                    <option value="nucleo">Núcleo</option>
                    <option value="cercana">Cercana</option>
                    <option value="orbita">Órbita</option>
                  </select>
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">Frecuencia de Contacto</label>
                  <select 
                    className="input-field" 
                    value={frecuencia} 
                    onChange={e => setFrecuencia(Number(e.target.value))}
                  >
                    <option value="100">Diario (100%)</option>
                    <option value="75">Semanal (75%)</option>
                    <option value="50">Mensual (50%)</option>
                    <option value="25">Anual (25%)</option>
                    <option value="0">Nada (0%)</option>
                  </select>
                </div>
              </>
            )}

            {item.doorId === 'estela' && (
              <>
                <div className="form-group flex-1">
                  <label className="form-label">Año del Hito</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={year} 
                    onChange={e => setYear(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">Fecha / Época</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="ej: 14 de Mayo, Verano"
                    value={dateStr} 
                    onChange={e => setDateStr(e.target.value)}
                  />
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">Lugar</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="ej: París, Francia"
                    value={lugar} 
                    onChange={e => setLugar(e.target.value)}
                  />
                </div>
              </>
            )}

            {item.doorId === 'estela' && (
              <div className="form-group" style={{ width: '100%', marginTop: '14px' }}>
                <label className="form-label">Tono Emocional del Recuerdo</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  {[
                    { level: 1, label: 'Muy triste', color: '#3b82f6' },
                    { level: 2, label: 'Triste', color: '#06b6d4' },
                    { level: 3, label: 'Calma', color: '#10b981' },
                    { level: 4, label: 'Alegre', color: '#f59e0b' },
                    { level: 5, label: 'Muy alegre', color: '#ec4899' }
                  ].map(opt => (
                    <button
                      key={opt.level}
                      type="button"
                      onClick={() => setEmocion(opt.level as any)}
                      style={{
                        flex: 1,
                        padding: '8px 4px',
                        borderRadius: '8px',
                        border: `1px solid ${emocion === opt.level ? opt.color : 'rgba(255, 255, 255, 0.1)'}`,
                        background: emocion === opt.level ? `${opt.color}25` : 'rgba(255, 255, 255, 0.03)',
                        color: emocion === opt.level ? '#ffffff' : 'var(--text-muted)',
                        fontSize: '0.75rem',
                        fontWeight: emocion === opt.level ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: opt.color, boxShadow: emocion === opt.level ? `0 0 8px ${opt.color}` : 'none' }} />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {item.doorId !== 'personas' && (
              <div className="form-group flex-1">
                <label className="form-label">{pesoConfig.label}</label>
                <div className="radio-group">
                  {pesoConfig.options.map(opt => (
                    <label key={opt.val} className={`radio-label ${peso === opt.val ? 'active' : ''}`}>
                      <input 
                        type="radio" 
                        name="peso" 
                        value={opt.val} 
                        checked={peso === opt.val}
                        onChange={() => setPeso(opt.val as 1 | 2 | 3)}
                      />
                      {opt.text}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Etiquetas (separadas por comas)</label>
            <input 
              type="text" 
              className="input-field" 
              value={tagsInput} 
              onChange={e => setTagsInput(e.target.value)}
              placeholder="cine, filosofia, urgente"
            />
          </div>

          <div className="modal-actions-container">
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type="button" 
                className="btn btn-danger" 
                onClick={handleDelete}
                disabled={isDeleting}
                title="Borrar dato permanentemente"
              >
                <Trash2 size={16} />
                <span>{isDeleting ? 'Borrando...' : 'Borrar'}</span>
              </button>

              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleExportMarkdown}
                title="Exportar esta tarjeta a archivo Markdown (.md)"
                style={{ padding: '8px 12px', background: 'var(--bg-tertiary)' }}
              >
                <Download size={16} />
                <span>Exportar .md</span>
              </button>
            </div>
            
            <div className="right-actions">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => onAskKyma(item)}
                title={item.doorId === 'estela' ? "Recordar con Kyma" : ['agenda', 'tareas', 'notas'].includes(item.doorId) ? "Consultar con Kyma" : "Explorar con Kyma"}
              >
                <LogoIcon size={16} style={{ marginRight: 4 }} />
                <span>{item.doorId === 'estela' ? 'Recordar con Kyma' : ['agenda', 'tareas', 'notas'].includes(item.doorId) ? 'Consultar con Kyma' : 'Explorar con Kyma'}</span>
              </button>
              
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                <Save size={16} />
                <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 16px;
        }
        .modal-content {
          width: 100%;
          max-width: 620px;
          max-height: 86vh;
          overflow-y: auto;
          border-radius: var(--border-radius-lg);
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          border: 1px solid var(--border-focus);
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
