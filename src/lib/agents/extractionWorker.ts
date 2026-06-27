import { dbClient, KymaItem } from '../db/client';
import { createSupabaseClient } from '../supabase';
import { DOOR_PACKAGES } from './doorPackages';
import { DoorId, ExtractionResult } from './types';

function formatTagList(tags: string[]): string[] {
  const map = new Map<string, string>();
  for (const t of tags) {
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
  return Array.from(map.values());
}

function getFrequencyScore(freqLabel?: string): number | undefined {
  if (!freqLabel) return undefined;
  const l = freqLabel.toLowerCase();
  if (l.includes('diario') || l.includes('día') || l.includes('dia')) return 100;
  if (l.includes('semanal') || l.includes('semana')) return 75;
  if (l.includes('mensual') || l.includes('mes')) return 50;
  if (l.includes('anual') || l.includes('año') || l.includes('ano')) return 25;
  return undefined;
}

export async function executeExtractionWorker(
  doorId: DoorId,
  userMessage: string,
  userId?: string,
  accessToken?: string,
  contextSnippet?: string
): Promise<{ item?: KymaItem; action: 'create' | 'enrich' | 'none' }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('ExtractionWorker: GEMINI_API_KEY no configurada');
    return { action: 'none' };
  }

  const pkg = DOOR_PACKAGES[doorId];
  if (!pkg) return { action: 'none' };

  const sbClient = createSupabaseClient(accessToken);

  // Fetch existing items for context (e.g., checking interests or existing people)
  const existingItems = await dbClient.getItems(doorId, userId, sbClient);
  const existingSummary = existingItems.map(i => ({
    id: i.id,
    title: i.title,
    content: i.content,
    eventDate: i.eventDate,
    eventTime: i.eventTime,
    frecuencia: i.frecuencia,
    tags: i.tags
  }));

  let model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  if (model === 'gemini-3-flash') {
    model = 'gemini-3.5-flash';
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const now = new Date();
  const currentDateStr = now.toISOString().split('T')[0];
  const dayOfWeekStr = now.toLocaleDateString('es-ES', { weekday: 'long' });

  const prompt = `
Tu tarea es actuar como el trabajador de extracción invisible para la puerta "${pkg.doorId}" (Categoría: ${pkg.category}).
NO HABLAS CON EL USUARIO. Tu única salida debe ser un objeto JSON válido con la estructura especificada.

FECHA ACTUAL DEL SISTEMA: ${currentDateStr} (Día de la semana: ${dayOfWeekStr}).
IMPORTANTE PARA AGENDA: Si el usuario usa palabras como "hoy", "esta tarde", "mañana", "este viernes", calcula la fecha exacta en formato YYYY-MM-DD basándote strictly en la FECHA ACTUAL DEL SISTEMA (${currentDateStr}). Para "hoy" o "esta tarde", la fecha ES ${currentDateStr}.

GUARDARRAÍLES DE ESTA PUERTA:
${pkg.guardrails.map(g => `- ${g}`).join('\n')}

ELEMENTOS EXISTENTES EN ESTA PUERTA PARA ESTE USUARIO:
${JSON.stringify(existingSummary, null, 2)}

MENSAJE O CONTEXTO DEL USUARIO:
"${userMessage}"
${contextSnippet ? `Contexto adicional: "${contextSnippet}"` : ''}

REGLAS DE FORMATO Y ENRIQUECIMIENTO (tanto para create como para enrich):
1. "title": DEBE SER DIRECTO Y CORTO (máximo 3-4 palabras, ej: "Torneo de Pádel", "Día de Playa", "Cita Médica", "David"). NUNCA incluyas personas, lugares ni horas en el título salvo si la puerta es personas donde el título es exclusivamente el nombre de la persona.
2. "content": Redacta los detalles prácticos (con quién es, lugar o notas). PARA AGENDA: OMITE totalmente la fecha y la hora en la redacción del texto del contenido, ya que la fecha y la hora se guardan en sus campos dedicados (eventDate, eventTime). NUNCA repitas ni concatenes frases absurdas.
3. "tags": Extrae OBLIGATORIAMENTE todas las etiquetas temáticas relevantes con '#', la primera letra en mayúscula y respetando espacios para nombres propios (ej: "#Playa", "#Rafa", "#Son Bou", "#Pádel", "#PadelOne", "#Deporte").

REGLAS DE SALIDA:
Devuelve UNICAMENTE un objeto JSON con el siguiente esquema:
{
  "action": "create" | "enrich" | "none",
  "targetItemId": "ID del elemento existente a enriquecer si action es 'enrich'",
  "extractedData": {
    "title": "Título corto y directo (ej: 'Día de Playa' o 'David')",
    "content": "Detalles del con quién y dónde sin incluir fechas ni horas",
    "peso": 1 | 2 | 3,
    "eventDate": "YYYY-MM-DD" (OBLIGATORIO si es agenda),
    "eventTime": "HH:MM" (solo si es agenda),
    "completed": false (solo si es tareas),
    "cercania": "nucleo" | "cercana" | "orbita" (solo si es personas, defecto orbita),
    "frecuenciaContacto": "diario" | "semanal" | "mensual" | "anual" (solo si es personas. Ej. si dice "cada día", "lo veo cada día" o "hablo a diario" usa "diario"),
    "tags": ["#Agenda", "#Playa", "#Rafa", "#Son Bou", "#Ocio"]
  },
  "reasoning": "Breve justificación interna"
}
`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      console.error('ExtractionWorker API error:', await response.text());
      return { action: 'none' };
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return { action: 'none' };

    const result: ExtractionResult = JSON.parse(rawText);

    if (result.action === 'none' || !result.extractedData) {
      return { action: 'none' };
    }

    // Determine origen based on category
    const origen = pkg.category === 'utilidad' ? 'kyma_confirmado' : 'kyma_sugerido';
    const calculatedFreq = getFrequencyScore(result.extractedData.frecuenciaContacto) ?? result.extractedData.frecuencia;

    if (result.action === 'enrich' && result.targetItemId) {
      const existing = existingItems.find(i => i.id === result.targetItemId);
      if (existing) {
        const updatedContent = result.extractedData.content || existing.content;
        const rawTags = [...(existing.tags || []), ...(result.extractedData.tags || [])];
        const mergedTags = formatTagList(rawTags);
        
        const updatedItem = await dbClient.updateItem(existing.id, {
          title: (result.extractedData.title && result.extractedData.title !== 'Nueva ficha') ? result.extractedData.title : existing.title,
          content: updatedContent,
          eventDate: result.extractedData.eventDate || existing.eventDate,
          eventTime: result.extractedData.eventTime || existing.eventTime,
          peso: result.extractedData.peso || existing.peso,
          completed: result.extractedData.completed !== undefined ? result.extractedData.completed : existing.completed,
          cercania: result.extractedData.cercania || existing.cercania,
          frecuencia: calculatedFreq !== undefined ? calculatedFreq : existing.frecuencia,
          tags: mergedTags,
          origen
        }, userId, sbClient);
        return { item: updatedItem, action: 'enrich' };
      }
    }

    // Default to create
    const eventDate = doorId === 'agenda' ? (result.extractedData.eventDate || currentDateStr) : result.extractedData.eventDate;
    const rawTags = result.extractedData.tags || [`#${doorId}`];
    const initialTags = formatTagList(rawTags);

    const newItem = await dbClient.createItem({
      doorId,
      title: result.extractedData.title || 'Nueva ficha',
      content: result.extractedData.content || '',
      peso: result.extractedData.peso || 1,
      tags: initialTags.length > 0 ? initialTags : [`#${doorId}`],
      eventDate,
      eventTime: result.extractedData.eventTime,
      completed: result.extractedData.completed,
      cercania: result.extractedData.cercania || (doorId === 'personas' ? 'orbita' : undefined),
      frecuencia: calculatedFreq !== undefined ? calculatedFreq : (doorId === 'personas' ? 50 : undefined),
      origen
    }, userId, sbClient);

    return { item: newItem, action: 'create' };

  } catch (err) {
    console.error('Error en executeExtractionWorker:', err);
    return { action: 'none' };
  }
}
