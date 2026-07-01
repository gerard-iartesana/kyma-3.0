import { supabase } from '../supabase';

export interface KymaItem {
  id: string;
  userId: string;
  doorId: 'agenda' | 'tareas' | 'notas' | 'intereses' | 'personas' | 'reflexiones' | 'estela';
  title: string;
  content: string;
  createdAt: string;
  tags: string[];
  peso: 1 | 2 | 3; // 1: Normal/Orbita/Curiosidad, 2: Destacado/Cercana, 3: Urgente/Nucleo/Pasion/Hito Vital
  origen?: 'manual' | 'kyma_sugerido' | 'kyma_confirmado' | 'google_calendar';
  completed?: boolean; // Specific to tareas
  estado?: 'activo' | 'archivado';
  fechaEjecucion?: string; // Date when task was completed
  eventDate?: string; // Specific to agenda
  eventTime?: string; // Specific to agenda (HH:MM)
  cercania?: 'nucleo' | 'cercana' | 'orbita'; // Specific to personas
  frecuencia?: number; // Specific to personas (0-100)
  year?: number; // Specific to estela (e.g. 2018)
  dateStr?: string; // Specific to estela (e.g. "14 de Mayo" or "Verano")
  lugar?: string; // Specific to estela (e.g. "París, Francia")
  emocion?: 1 | 2 | 3 | 4 | 5; // Specific to estela (1: muy triste, 2: triste, 3: calma, 4: alegre, 5: muy alegre)
  recurrencia?: 'none' | 'semanal' | 'mensual' | 'anual' | 'primer_lunes_mes' | 'ultimo_viernes_mes' | string; // Specific to agenda
  fileUrl?: string;
  fileName?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'kyma';
  text: string;
  timestamp: string;
  isNew?: boolean;
  clientKey?: string;
  contextItem?: {
    id: string;
    title: string;
    doorId: string;
  };
}

const SEED_ITEMS: Omit<KymaItem, 'id' | 'createdAt' | 'userId'>[] = [
  // Agenda
  {
    doorId: 'agenda',
    title: 'Cena con Marta',
    content: 'Cena en nuestro restaurante italiano favorito para celebrar su nuevo proyecto.',
    eventDate: new Date(Date.now() + 3600000 * 24).toISOString().split('T')[0],
    eventTime: '21:00',
    tags: ['#cena', '#marta', '#agenda'],
    peso: 2,
    origen: 'manual'
  },
  {
    doorId: 'agenda',
    title: 'Presentación Kyma MVP',
    content: 'Demostración de la interfaz del observatorio y del cuaderno móvil.',
    eventDate: new Date(Date.now() + 3600000 * 72).toISOString().split('T')[0],
    eventTime: '11:30',
    tags: ['#trabajo', '#demo', '#agenda'],
    peso: 3,
    origen: 'manual'
  },
  // Tareas
  {
    doorId: 'tareas',
    title: 'Comprar café de especialidad',
    content: 'Buscar el origen Etiopía que recomendó Javier.',
    tags: ['#cafe', '#compra', '#tareas'],
    peso: 1,
    completed: false,
    origen: 'manual'
  },
  {
    doorId: 'tareas',
    title: 'Preparar presentación de producto',
    content: 'Estructurar diapositivas y guion de la demo.',
    tags: ['#trabajo', '#tareas'],
    peso: 3,
    completed: false,
    origen: 'manual'
  },
  {
    doorId: 'tareas',
    title: 'Responder correo a Lucía',
    content: 'Confirmar fechas de entrega del roadmap v2.',
    tags: ['#lucia', '#correo', '#tareas'],
    peso: 2,
    completed: true,
    origen: 'manual'
  },
  // Notas
  {
    doorId: 'notas',
    title: 'Notas sobre La Llegada',
    content: 'Anoche volví a ver La Llegada. Increíble cómo trata la lingüística y el tiempo no lineal. Me quedé pensando en cómo percibimos el destino: si conocieras tu futuro, ¿cambiarías algo?',
    tags: ['#cine', '#la-llegada', '#filosofia', '#notas'],
    peso: 2,
    origen: 'manual'
  },
  {
    doorId: 'notas',
    title: 'Color como recompensa',
    content: 'Idea de diseño: una interfaz que empiece casi monocromática y florezca en color a medida que Kyma aprende del usuario. Menos estímulos, más calma.',
    tags: ['#kyma', '#diseño', '#notas'],
    peso: 3,
    origen: 'manual'
  },
  // Intereses
  {
    doorId: 'intereses',
    title: 'Cine de Ciencia Ficción',
    content: 'Atracción por historias de corte existencial, lingüística y realidades no lineales. Obras clave discutidas: La Llegada, Interestelar.',
    tags: ['#cine', '#ciencia-ficcion', '#intereses'],
    peso: 3,
    origen: 'manual'
  },
  {
    doorId: 'intereses',
    title: 'Filosofía del Lenguaje',
    content: 'Curiosidad por comprender cómo la estructura gramatical y los símbolos que usamos limitan o expanden los pensamientos cotidianos.',
    tags: ['#filosofia', '#intereses'],
    peso: 2,
    origen: 'manual'
  },
  {
    doorId: 'intereses',
    title: 'Diseño de Interfaces',
    content: 'Estudio de micro-interacciones, tipografía y contrastes en interfaces oscuras. Principios de calma visual y balance.',
    tags: ['#diseño', '#intereses'],
    peso: 2,
    origen: 'manual'
  },
  {
    doorId: 'intereses',
    title: 'Desarrollo de Software',
    content: 'Programación funcional, arquitectura limpia, tipado estático y algoritmos en TypeScript y React.',
    tags: ['#desarrollo', '#intereses'],
    peso: 3,
    origen: 'manual'
  },
  {
    doorId: 'intereses',
    title: 'Modelos de Lenguaje',
    content: 'Interés en redes neuronales, prompting socrático y comportamiento emergente en sistemas de IA.',
    tags: ['#ia', '#intereses'],
    peso: 2,
    origen: 'manual'
  },
  {
    doorId: 'intereses',
    title: 'Ética y Existencialismo',
    content: 'Debates sobre el libre albedrío, la responsabilidad individual y la construcción de sentido en la modernidad líquida.',
    tags: ['#filosofia', '#intereses'],
    peso: 3,
    origen: 'manual'
  },
  {
    doorId: 'intereses',
    title: 'Cine de Acción',
    content: 'Análisis del ritmo visual, montaje cinético y coreografías en el cine de acción contemporáneo.',
    tags: ['#cine', '#accion', '#intereses'],
    peso: 1,
    origen: 'manual'
  },
  {
    doorId: 'intereses',
    title: 'Cine de Fantasía',
    content: 'Exploración de la mitopoiesis, construcción de mundos fantásticos y el viaje del héroe clásico en el cine.',
    tags: ['#cine', '#fantasia', '#intereses'],
    peso: 2,
    origen: 'manual'
  },
  {
    doorId: 'intereses',
    title: 'Filosofía de la Inteligencia Artificial',
    content: 'Reflexión ética y epistemológica sobre la conciencia artificial, la mente extendida y el futuro humano.',
    tags: ['#filosofia', '#ia', '#intereses'],
    peso: 3,
    origen: 'manual'
  },
  // Vínculos
  {
    doorId: 'personas',
    title: 'Marta',
    content: 'Pareja. Compartimos el amor por el cine, la cocina y los paseos matutinos. Kyma ha registrado múltiples eventos conjuntos.',
    tags: ['#marta', '#vinculos'],
    peso: 3,
    cercania: 'nucleo',
    frecuencia: 100,
    origen: 'manual'
  },
  {
    doorId: 'personas',
    title: 'Javier',
    content: 'Amigo cercano y mentor tecnológico. Conversaciones frecuentes sobre desarrollo, café y existencialismo.',
    tags: ['#javier', '#vinculos'],
    peso: 2,
    cercania: 'cercana',
    frecuencia: 75,
    origen: 'manual'
  },
  {
    doorId: 'personas',
    title: 'Lucía',
    content: 'Compañera del equipo de diseño. Contacto laboral regular pero con poca carga subjetiva registrada.',
    tags: ['#lucia', '#vinculos'],
    peso: 1,
    cercania: 'orbita',
    frecuencia: 50,
    origen: 'manual'
  },
  // Reflexiones
  {
    doorId: 'reflexiones',
    title: 'Sobre la rutina y el control',
    content: 'A veces me aferro a hábitos obsoletos solo porque la predictibilidad me da calma. Kyma me hizo reflexionar: ¿busco orden o evito enfrentarme al vacío de tomar decisiones nuevas?',
    tags: ['#reflexiones', '#filosofia'],
    peso: 2,
    origen: 'manual'
  },
  // Estela de vida
  {
    doorId: 'estela',
    title: 'Viaje a Japón e hito vital',
    content: 'Un viaje que cambió mi perspectiva sobre la calma, el respeto y la artesanía. Recorrí Tokio, Kioto y los templos de Nara.',
    year: 2018,
    dateStr: 'Verano',
    lugar: 'Japón',
    tags: ['#estela', '#viaje', '#japon', '#hito'],
    peso: 3,
    origen: 'manual'
  },
  {
    doorId: 'estela',
    title: 'Graduación Universitaria',
    content: 'Finalización de mis estudios tras años de esfuerzo y entrega. Celebración con mi familia y amigos cercanos.',
    year: 2021,
    dateStr: '15 de Junio',
    lugar: 'Madrid, España',
    tags: ['#estela', '#graduacion', '#madrid'],
    peso: 2,
    origen: 'manual'
  }
];

const SEED_MESSAGES_EMPTY: ChatMessage[] = [
  {
    id: 'me1',
    sender: 'kyma',
    text: 'Hola. Soy Kyma. Estoy aquí para escucharte y ayudarte con tu día a día. A medida que compartas tus notas, ideas o vínculos importantes, dibujaremos juntos tu mapa interior. ¿De qué te apetece conversar hoy?',
    timestamp: new Date().toISOString()
  }
];

// Helper to get active user ID
async function getCurrentUserId(overrideUserId?: string): Promise<string> {
  if (overrideUserId) return overrideUserId;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Usuario no autenticado');
  }
  return user.id;
}

// Map database row to KymaItem
function mapDbToKymaItem(dbItem: any, tagNames: string[]): KymaItem {
  const doorIdMap: Record<string, KymaItem['doorId']> = {
    evento: 'agenda',
    tarea: 'tareas',
    nota: 'notas',
    interes: 'intereses',
    vinculo: 'personas',
    reflexion: 'reflexiones',
    estela: 'estela'
  };

  const datos = dbItem.datos || {};
  let doorId = doorIdMap[dbItem.tipo] || 'notas';
  const currentYear = new Date().getFullYear();

  if (dbItem.tipo === 'vinculo') {
    doorId = 'personas';
  } else if (dbItem.tipo === 'nota') {
    doorId = 'notas';
  } else if (dbItem.tipo === 'tarea') {
    doorId = 'tareas';
  } else if (dbItem.tipo === 'interes') {
    doorId = 'intereses';
  } else if (dbItem.tipo === 'reflexion') {
    doorId = 'reflexiones';
  } else if (dbItem.tipo === 'evento') {
    const isPastEstela = datos.is_estela || (typeof datos.year === 'number' && datos.year < currentYear);
    if (isPastEstela) {
      doorId = 'estela';
    } else {
      doorId = 'agenda';
    }
  }

  const item: KymaItem = {
    id: dbItem.id,
    userId: dbItem.user_id,
    doorId,
    title: dbItem.titulo,
    content: dbItem.cuerpo || '',
    createdAt: dbItem.created_at,
    tags: tagNames || [],
    peso: (dbItem.peso || 1) as 1 | 2 | 3,
    origen: dbItem.origen || 'manual',
    estado: dbItem.estado || 'activo',
  };

  if (doorId === 'tareas') {
    item.completed = !!datos.hecha;
    if (datos.fecha_ejecucion) {
      item.fechaEjecucion = datos.fecha_ejecucion;
    }
  } else if (doorId === 'agenda') {
    item.eventDate = datos.fecha || '';
    item.eventTime = datos.hora || '';
    item.recurrencia = datos.recurrencia || 'none';
  } else if (doorId === 'personas') {
    item.cercania = datos.cercania || 'orbita';
    item.frecuencia = typeof datos.frecuencia_score === 'number' ? datos.frecuencia_score : 50;
  } else if (doorId === 'estela') {
    item.year = typeof datos.year === 'number' ? datos.year : (datos.fecha ? parseInt(datos.fecha.split('-')[0]) : undefined);
    item.dateStr = datos.dateStr || datos.fecha_redactada || '';
    item.lugar = datos.lugar || '';
    item.emocion = (typeof datos.emocion === 'number' ? datos.emocion : 4) as 1 | 2 | 3 | 4 | 5;
  }

  if (datos.file_url) item.fileUrl = datos.file_url;
  if (datos.file_name) item.fileName = datos.file_name;

  return item;
}

// Map KymaItem properties to public.elementos fields
function mapKymaToDbFields(item: Partial<Omit<KymaItem, 'id' | 'userId'>>) {
  const dbItem: any = {};
  
  if (item.title !== undefined) dbItem.titulo = item.title;
  if (item.content !== undefined) dbItem.cuerpo = item.content;
  if (item.peso !== undefined) dbItem.peso = item.peso;
  if (item.origen !== undefined) dbItem.origen = item.origen;
  if (item.estado !== undefined) dbItem.estado = item.estado;
  
  if (item.doorId !== undefined) {
    const tipoMap: Record<KymaItem['doorId'], string> = {
      agenda: 'evento',
      tareas: 'tarea',
      notas: 'nota',
      intereses: 'interes',
      personas: 'vinculo',
      reflexiones: 'reflexion',
      estela: 'evento'
    };
    dbItem.tipo = tipoMap[item.doorId];
  }

  const datos: any = {};
  if (item.doorId === 'estela') {
    datos.is_estela = true;
  }
  if (item.completed !== undefined) datos.hecha = item.completed;
  if (item.fechaEjecucion !== undefined) datos.fecha_ejecucion = item.fechaEjecucion;
  if (item.eventDate !== undefined) datos.fecha = item.eventDate;
  if (item.eventTime !== undefined) datos.hora = item.eventTime;
  if (item.recurrencia !== undefined) datos.recurrencia = item.recurrencia;
  if (item.cercania !== undefined) datos.cercania = item.cercania;
  if (item.frecuencia !== undefined) datos.frecuencia_score = item.frecuencia;
  if (item.year !== undefined) datos.year = item.year;
  if (item.dateStr !== undefined) datos.dateStr = item.dateStr;
  if (item.lugar !== undefined) datos.lugar = item.lugar;
  if (item.emocion !== undefined) datos.emocion = item.emocion;
  if (item.fileUrl !== undefined) datos.file_url = item.fileUrl;
  if (item.fileName !== undefined) datos.file_name = item.fileName;
  
  if (Object.keys(datos).length > 0) {
    dbItem.datos = datos;
  }
  
  return dbItem;
}

// Check database state (for local display purposes)
export function getDbState(): 'populated' | 'empty' {
  if (typeof window === 'undefined') return 'populated';
  const state = localStorage.getItem('KYMA_DB_STATE');
  return (state as 'populated' | 'empty') || 'populated';
}

export function setDbState(state: 'populated' | 'empty') {
  if (typeof window === 'undefined') return;
  localStorage.setItem('KYMA_DB_STATE', state);
}

// Client Database API
export const dbClient = {
  // Sync tag names to public.tags and create relations in elemento_tags
  async syncElementTags(elementoId: string, userId: string, tagNames: string[], customClient?: any): Promise<void> {
    const sb = customClient || supabase;
    // 1. Delete existing associations
    const { error: deleteError } = await sb
      .from('elemento_tags')
      .delete()
      .eq('elemento_id', elementoId);
      
    if (deleteError) {
      console.error('Error clearing old tags:', deleteError);
      throw new Error(`Error clearing tags: ${deleteError.message}`);
    }

    if (tagNames.length === 0) return;

    // 2. Normalize and filter tag names (ensure '#', proper casing, and spaces for multi-words)
    const map = new Map<string, string>();
    for (const t of tagNames) {
      let clean = t.trim();
      if (!clean) continue;
      if (!clean.startsWith('#')) clean = `#${clean}`;
      const key = clean.toLowerCase();
      if (!map.has(key)) {
        const words = clean.split(' ').map(w => {
          if (w.startsWith('#')) {
            const body = w.slice(1);
            return '#' + (body.charAt(0).toUpperCase() + body.slice(1));
          }
          return w.charAt(0).toUpperCase() + w.slice(1);
        });
        map.set(key, words.join(' '));
      }
    }
    const normalizedTags = Array.from(map.values());
    
    if (normalizedTags.length === 0) return;

    // 3. Bulk upsert tags into public.tags
    const tagsData = normalizedTags.map((nombre: string) => {
      const systemicTags = ['#agenda', '#tareas', '#notas', '#intereses', '#personas', '#vinculos', '#reflexiones', '#estela'];
      const tipo = systemicTags.includes(nombre.toLowerCase()) ? 'sistemico' : 'tematico';
      return {
        user_id: userId,
        nombre,
        tipo
      };
    });

    const { data: upsertedTags, error: tagsError } = await sb
      .from('tags')
      .upsert(tagsData, { onConflict: 'user_id,nombre' })
      .select('id, nombre');

    if (tagsError) {
      console.error('Error upserting tags:', tagsError);
      throw new Error(`Error syncing tags: ${tagsError.message}`);
    }

    // 4. Link elements to tags in public.elemento_tags
    const linksData = (upsertedTags || []).map((t: any) => ({
      elemento_id: elementoId,
      tag_id: t.id
    }));

    const { error: linkError } = await sb
      .from('elemento_tags')
      .insert(linksData);

    if (linkError) {
      console.error('Error linking element to tags:', linkError);
      throw new Error(`Error linking tags: ${linkError.message}`);
    }
  },

  // Items CRUD
  async getItems(doorId?: string, overrideUserId?: string, customClient?: any): Promise<KymaItem[]> {
    const sb = customClient || supabase;
    try {
      const userId = await getCurrentUserId(overrideUserId);
      
      let query = sb
        .from('elementos')
        .select(`
          *,
          elemento_tags (
            tags (
              nombre
            )
          )
        `)
        .eq('user_id', userId);
        
      if (doorId) {
        const tipoMap: Record<string, string> = {
          agenda: 'evento',
          tareas: 'tarea',
          notas: 'nota',
          intereses: 'interes',
          personas: 'vinculo',
          reflexiones: 'reflexion',
          estela: 'evento'
        };
        const tipo = tipoMap[doorId];
        if (tipo) {
          query = query.eq('tipo', tipo);
        }
      }
      
      const { data, error } = await query;
      if (error) {
        console.error('Error fetching items from network, checking offline cache:', error);
        return this.getCachedItems(doorId);
      }
      
      const filteredData = (data || []).filter((dbItem: any) => {
        const datos = dbItem.datos || {};
        return dbItem.titulo !== 'kyma_system_user_configuration' && !datos.is_system_config;
      });

      const mapped = filteredData.map((dbItem: any) => {
        const tagNames = (dbItem.elemento_tags || [])
          .map((et: any) => et.tags?.nombre)
          .filter(Boolean);
        return mapDbToKymaItem(dbItem, tagNames);
      });

      // Cache fresh network items locally
      if (typeof window !== 'undefined' && !doorId) {
        try {
          localStorage.setItem('kyma_cached_items', JSON.stringify(mapped));
        } catch (e) {}
      }

      if (doorId === 'agenda') {
        return mapped.filter((i: KymaItem) => i.doorId === 'agenda');
      }
      if (doorId === 'estela') {
        const currentYear = new Date().getFullYear();
        return mapped.filter((i: KymaItem) => i.doorId === 'estela' && (!i.year || i.year < currentYear) && !/\b(?:dni|documento|adjunto|nota|partido)\b/i.test(i.title));
      }
      if (doorId) {
        return mapped.filter((i: KymaItem) => i.doorId === doorId);
      }

      return mapped;
    } catch (e) {
      console.warn('getCurrentUserId failed or offline mode active, fallback to cached items:', e);
      return this.getCachedItems(doorId);
    }
  },

  getCachedItems(doorId?: string): KymaItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem('kyma_cached_items');
      if (!cached) return [];
      const items: KymaItem[] = JSON.parse(cached);
      if (doorId) {
        return items.filter(i => i.doorId === doorId);
      }
      return items;
    } catch (e) {
      return [];
    }
  },

  async syncOfflineQueue(overrideUserId?: string, customClient?: any): Promise<void> {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    try {
      const rawQueue = localStorage.getItem('kyma_offline_queue');
      if (!rawQueue) return;
      const queue: Array<Omit<KymaItem, 'id' | 'createdAt' | 'userId'>> = JSON.parse(rawQueue);
      if (queue.length === 0) return;

      localStorage.removeItem('kyma_offline_queue');
      for (const item of queue) {
        await this.createItem(item, overrideUserId, customClient);
      }
      await this.getItems(undefined, overrideUserId, customClient);
    } catch (e) {
      console.error('Error syncing offline queue:', e);
    }
  },

  clearLocalCache(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('kyma_cached_items');
    localStorage.removeItem('kyma_offline_queue');
  },

  async getItemById(id: string, overrideUserId?: string, customClient?: any): Promise<KymaItem | undefined> {
    const sb = customClient || supabase;
    const userId = await getCurrentUserId(overrideUserId);
    const { data, error } = await sb
      .from('elementos')
      .select(`
        *,
        elemento_tags (
          tags (
            nombre
          )
        )
      `)
      .eq('user_id', userId)
      .eq('id', id)
      .single();
      
    if (error || !data) {
      return undefined;
    }
    
    const tagNames = (data.elemento_tags || [])
      .map((et: any) => et.tags?.nombre)
      .filter(Boolean);
      
    return mapDbToKymaItem(data, tagNames);
  },

  async createItem(item: Omit<KymaItem, 'id' | 'createdAt' | 'userId'>, overrideUserId?: string, customClient?: any): Promise<KymaItem> {
    const sb = customClient || supabase;
    const userId = await getCurrentUserId(overrideUserId);

    // Offline capture fallback
    if (typeof window !== 'undefined' && !navigator.onLine) {
      const tempId = `offline-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const localItem: KymaItem = {
        ...item,
        id: tempId,
        userId,
        createdAt: new Date().toISOString(),
        origen: 'manual'
      };
      // Add to cached items
      const cached = this.getCachedItems();
      const updatedCache = [localItem, ...cached];
      localStorage.setItem('kyma_cached_items', JSON.stringify(updatedCache));

      // Add to offline queue
      const rawQueue = localStorage.getItem('kyma_offline_queue');
      const queue = rawQueue ? JSON.parse(rawQueue) : [];
      queue.push(item);
      localStorage.setItem('kyma_offline_queue', JSON.stringify(queue));

      return localItem;
    }
    
    // 1. Map to DB fields
    const dbItemFields = mapKymaToDbFields(item);
    dbItemFields.user_id = userId;
    
    // 2. Insert into elementos
    const { data: createdDbItem, error: insertError } = await sb
      .from('elementos')
      .insert(dbItemFields)
      .select()
      .single();
      
    if (insertError || !createdDbItem) {
      throw new Error(`Error creating element: ${insertError?.message}`);
    }
    
    // 3. Process tags
    let tagsToLink = item.tags || [];
    if (tagsToLink.length === 0) {
      const doorTagMap: Record<string, string> = {
        agenda: '#agenda',
        tareas: '#tareas',
        notas: '#notas',
        intereses: '#intereses',
        personas: '#vinculos',
        reflexiones: '#reflexiones',
        estela: '#estela'
      };
      if (doorTagMap[item.doorId]) {
        tagsToLink = [doorTagMap[item.doorId]];
      }
    }

    if (item.content && (!item.tags || item.tags.length === 0)) {
      const mentioned = item.content.match(/#[a-zA-Z0-9-]+/g);
      if (mentioned) {
        tagsToLink = Array.from(new Set([...tagsToLink, ...mentioned.map((t: string) => t.toLowerCase())]));
      }
    }
    
    if (tagsToLink.length > 0) {
      await this.syncElementTags(createdDbItem.id, userId, tagsToLink, sb);
    }
    
    const newItem = mapDbToKymaItem(createdDbItem, tagsToLink);
    if (typeof window !== 'undefined') {
      try {
        const cached = this.getCachedItems();
        localStorage.setItem('kyma_cached_items', JSON.stringify([newItem, ...cached]));
      } catch (e) {}
    }

    if (newItem.doorId === 'agenda') {
      (async () => {
        try {
          const sessionRes = await sb.auth.getSession();
          const token = sessionRes.data.session?.access_token;
          if (token) {
            await fetch('/api/calendar/events', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                summary: newItem.title,
                description: newItem.content,
                date: newItem.eventDate,
                time: newItem.eventTime
              })
            });
          }
        } catch (e) {
          console.warn('Google Calendar sync failed:', e);
        }
      })();
    }

    return newItem;
  },

  async updateItem(id: string, updates: Partial<Omit<KymaItem, 'id' | 'userId'>>, overrideUserId?: string, customClient?: any): Promise<KymaItem> {
    const sb = customClient || supabase;
    const userId = await getCurrentUserId(overrideUserId);
    
    // 1. Fetch current element
    const { data: existing, error: fetchError } = await sb
      .from('elementos')
      .select(`
        *,
        elemento_tags (
          tags (
            nombre
          )
        )
      `)
      .eq('user_id', userId)
      .eq('id', id)
      .single();
      
    if (fetchError || !existing) {
      throw new Error(`Element with id ${id} not found`);
    }
    
    const currentTags: string[] = (existing.elemento_tags || [])
      .map((et: any) => et.tags?.nombre)
      .filter(Boolean) as string[];
      
    // 2. Determine final tags
    let finalTags = updates.tags;
    
    if (updates.content !== undefined && updates.tags === undefined) {
      const mentioned = updates.content.match(/#[a-zA-Z0-9-]+/g);
      if (mentioned) {
        const systemicTags = currentTags.filter((t: string) => 
          ['#agenda', '#tareas', '#notas', '#intereses', '#personas', '#vinculos', '#reflexiones', '#estela'].includes(t)
        );
        finalTags = Array.from(new Set([...systemicTags, ...mentioned.map((t: string) => t.toLowerCase())]));
      }
    }
    
    // 3. Map updates
    const dbItemFields = mapKymaToDbFields(updates);
    
    if (dbItemFields.datos || existing.datos) {
      dbItemFields.datos = {
        ...existing.datos,
        ...dbItemFields.datos
      };
    }
    
    dbItemFields.updated_at = new Date().toISOString();
    
    // 4. Update element
    const { data: updatedDbItem, error: updateError } = await sb
      .from('elementos')
      .update(dbItemFields)
      .eq('id', id)
      .select()
      .single();
      
    if (updateError || !updatedDbItem) {
      throw new Error(`Error updating element: ${updateError?.message}`);
    }
    
    // 5. Sync tags
    if (finalTags !== undefined) {
      await this.syncElementTags(id, userId, finalTags, sb);
    } else {
      finalTags = currentTags;
    }
    
    const updatedItem = mapDbToKymaItem(updatedDbItem, finalTags);
    if (typeof window !== 'undefined') {
      try {
        const cached = this.getCachedItems();
        const updatedCache = cached.map((i: KymaItem) => i.id === id ? updatedItem : i);
        localStorage.setItem('kyma_cached_items', JSON.stringify(updatedCache));
      } catch (e) {}
    }
    return updatedItem;
  },

  async deleteItem(id: string, cachedItem?: KymaItem, overrideUserId?: string, customClient?: any): Promise<void> {
    const sb = customClient || supabase;
    const userId = await getCurrentUserId(overrideUserId);
    
    // Save item in trash recovery stack
    try {
      let itemToTrash = cachedItem;
      if (!itemToTrash) {
        const { data: dbRow } = await sb
          .from('elementos')
          .select('*, elementos_etiquetas(etiquetas(nombre))')
          .eq('user_id', userId)
          .eq('id', id)
          .maybeSingle();
          
        if (dbRow) {
          const tagNames = (dbRow.elementos_etiquetas || []).map((ee: any) => ee.etiquetas?.nombre).filter(Boolean);
          itemToTrash = mapDbToKymaItem(dbRow, tagNames);
        }
      }

      if (itemToTrash) {
        let currentTrash: KymaItem[] = [];
        if (typeof window !== 'undefined') {
          try {
            const saved = localStorage.getItem('kyma_deleted_trash');
            if (saved) currentTrash = JSON.parse(saved);
          } catch (e) {}
        }
        currentTrash = currentTrash.filter(i => i.id !== itemToTrash!.id);
        currentTrash.unshift(itemToTrash);
        currentTrash = currentTrash.slice(0, 10);
        if (typeof window !== 'undefined') {
          localStorage.setItem('kyma_deleted_trash', JSON.stringify(currentTrash));
        }
      }
    } catch (e) {
      console.warn('Could not cache deleted item in trash stack:', e);
    }

    const { error } = await sb
      .from('elementos')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);
      
    if (error) {
      throw new Error(`Error deleting element: ${error.message}`);
    }

    if (typeof window !== 'undefined') {
      try {
        const cached = this.getCachedItems();
        const updatedCache = cached.filter((i: KymaItem) => i.id !== id);
        localStorage.setItem('kyma_cached_items', JSON.stringify(updatedCache));
      } catch (e) {}
    }
  },

  async restoreLastDeletedItem(overrideUserId?: string, customClient?: any): Promise<KymaItem | null> {
    let currentTrash: KymaItem[] = [];
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('kyma_deleted_trash');
        if (saved) currentTrash = JSON.parse(saved);
      } catch (e) {}
    }
    if (currentTrash.length === 0) return null;

    const itemToRestore = currentTrash.shift()!;
    if (typeof window !== 'undefined') {
      localStorage.setItem('kyma_deleted_trash', JSON.stringify(currentTrash));
    }

    // Re-create item in database
    const restored = await this.createItem({
      doorId: itemToRestore.doorId,
      title: itemToRestore.title,
      content: itemToRestore.content,
      tags: itemToRestore.tags,
      peso: itemToRestore.peso,
      origen: itemToRestore.origen || 'manual',
      eventDate: itemToRestore.eventDate,
      eventTime: itemToRestore.eventTime,
      recurrencia: itemToRestore.recurrencia,
      completed: itemToRestore.completed,
      cercania: itemToRestore.cercania,
      frecuencia: itemToRestore.frecuencia,
      year: itemToRestore.year,
      dateStr: itemToRestore.dateStr,
      lugar: itemToRestore.lugar,
      emocion: itemToRestore.emocion,
      fileUrl: itemToRestore.fileUrl,
      fileName: itemToRestore.fileName
    }, overrideUserId, customClient);

    return restored;
  },

  async confirmItem(id: string, overrideUserId?: string, customClient?: any): Promise<KymaItem> {
    return this.updateItem(id, { origen: 'kyma_confirmado' }, overrideUserId, customClient);
  },

  async discardItem(id: string, overrideUserId?: string, customClient?: any): Promise<void> {
    return this.deleteItem(id, undefined, overrideUserId, customClient);
  },

  // Messages API
  async getMessages(): Promise<ChatMessage[]> {
    try {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from('conversacion_buffer')
        .select('mensajes')
        .eq('user_id', userId)
        .single();
        
      if (error && error.code === 'PGRST116') {
        const initial = getDbState() === 'populated' ? [] : SEED_MESSAGES_EMPTY;
        const { error: insertError } = await supabase
          .from('conversacion_buffer')
          .insert({ user_id: userId, mensajes: initial });
        if (insertError) console.error('Error inserting initial buffer:', insertError);
        return initial;
      }
      
      const msgs = (data?.mensajes as ChatMessage[]) || [];
      // If empty and DB state is empty, initialize with default message
      if (msgs.length === 0 && getDbState() === 'empty') {
        return SEED_MESSAGES_EMPTY;
      }
      return msgs;
    } catch (e) {
      console.warn('getCurrentUserId failed or error fetching messages:', e);
      return getDbState() === 'empty' ? SEED_MESSAGES_EMPTY : [];
    }
  },

  async sendMessage(text: string, contextItem?: ChatMessage['contextItem']): Promise<ChatMessage> {
    const userId = await getCurrentUserId();
    const msgs = await this.getMessages();
    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'user',
      text,
      timestamp: new Date().toISOString(),
      contextItem
    };
    const newMsgs = [...msgs, userMsg];
    await supabase
      .from('conversacion_buffer')
      .upsert({ user_id: userId, mensajes: newMsgs, updated_at: new Date().toISOString() });
    return userMsg;
  },

  async receiveKymaMessage(text: string): Promise<ChatMessage> {
    const userId = await getCurrentUserId();
    const msgs = await this.getMessages();
    const kymaMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'kyma',
      text,
      timestamp: new Date().toISOString()
    };
    const newMsgs = [...msgs, kymaMsg];
    await supabase
      .from('conversacion_buffer')
      .upsert({ user_id: userId, mensajes: newMsgs, updated_at: new Date().toISOString() });
    return kymaMsg;
  },

  async clearMessages(): Promise<ChatMessage[]> {
    const userId = await getCurrentUserId();
    const cleanMsg: ChatMessage[] = [
      {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'kyma',
        text: 'He limpiado nuestra conversación. ¿De qué te apetece conversar ahora?',
        timestamp: new Date().toISOString()
      }
    ];
    await supabase
      .from('conversacion_buffer')
      .upsert({ user_id: userId, mensajes: cleanMsg, updated_at: new Date().toISOString() });
    return cleanMsg;
  },

  async resetDatabase(): Promise<void> {
    const userId = await getCurrentUserId();
    
    // 1. Delete elements (cascades to elemento_tags)
    const { error: deleteElementsError } = await supabase
      .from('elementos')
      .delete()
      .eq('user_id', userId);
    if (deleteElementsError) throw deleteElementsError;
      
    // 2. Delete tags
    const { error: deleteTagsError } = await supabase
      .from('tags')
      .delete()
      .eq('user_id', userId);
    if (deleteTagsError) throw deleteTagsError;
      
    // 3. Reset conversation buffer
    const cleanMsg: ChatMessage[] = [];
    await supabase
      .from('conversacion_buffer')
      .upsert({ user_id: userId, mensajes: cleanMsg, updated_at: new Date().toISOString() });
      
    // 4. Seed database with SEED_ITEMS for the user
    for (const item of SEED_ITEMS) {
      const { tags, ...rest } = item;
      
      const dbItemFields = mapKymaToDbFields(rest);
      dbItemFields.user_id = userId;
      
      const { data: created, error: insertError } = await supabase
        .from('elementos')
        .insert(dbItemFields)
        .select()
        .single();
        
      if (insertError) {
        console.error('Error inserting seed element:', insertError);
        continue;
      }
      
      if (created && tags) {
        await this.syncElementTags(created.id, userId, tags);
      }
    }
  },

  async getUserConfig(): Promise<{ perfil?: any; logs?: any; googleCalendar?: any } | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('elementos')
        .select('*')
        .eq('user_id', user.id)
        .eq('tipo', 'nota')
        .eq('titulo', 'kyma_system_user_configuration');
      
      if (error) {
        console.error('Error fetching user config:', error);
        return null;
      }
      
      if (data && data.length > 0) {
        const datos = data[0].datos || {};
        return {
          perfil: datos.perfil,
          logs: datos.logs,
          googleCalendar: datos.googleCalendar
        };
      }
      return null;
    } catch (e) {
      console.warn('Failed to get user config:', e);
      return null;
    }
  },

  async saveUserConfig(perfil: any, logs: any, googleCalendar?: any): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existing } = await supabase
        .from('elementos')
        .select('id, datos')
        .eq('user_id', user.id)
        .eq('tipo', 'nota')
        .eq('titulo', 'kyma_system_user_configuration');

      const existingDatos = existing && existing.length > 0 ? existing[0].datos || {} : {};

      const datos: any = {
        ...existingDatos,
        is_system_config: true,
        perfil,
        logs
      };

      if (googleCalendar) {
        datos.googleCalendar = googleCalendar;
      }

      if (existing && existing.length > 0) {
        const { error: updateError } = await supabase
          .from('elementos')
          .update({
            datos,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing[0].id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('elementos')
          .insert({
            user_id: user.id,
            tipo: 'nota',
            titulo: 'kyma_system_user_configuration',
            datos,
            peso: 1,
            origen: 'manual'
          });
        if (insertError) throw insertError;
      }
    } catch (e) {
      console.error('Failed to save user config:', e);
    }
  },

  async deleteAccount(): Promise<void> {
    const { error } = await supabase.rpc('delete_user_account');
    if (error) {
      throw new Error(`Error deleting account: ${error.message}`);
    }
    await supabase.auth.signOut();
  }
};
