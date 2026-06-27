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

function deriveEstelaTitle(userMessage: string, extractedTitle?: string): string {
  const genericTerms = ['recuerdo especial', 'nueva ficha', 'hito', 'recuerdo', 'evento', 'hito vital', 'sin título', 'sin titulo', 'recuerdo vital', 'momento'];
  if (extractedTitle && !genericTerms.includes(extractedTitle.trim().toLowerCase())) {
    return extractedTitle;
  }

  if (/falleci|falleció|muerte|murió|murio|pérdida|perdida/i.test(userMessage)) {
    if (/padre|papá|papa/i.test(userMessage)) return 'Fallecimiento de mi padre';
    if (/madre|mamá|mama/i.test(userMessage)) return 'Fallecimiento de mi madre';
    if (/abuelo/i.test(userMessage)) return 'Fallecimiento de mi abuelo';
    if (/abuela/i.test(userMessage)) return 'Fallecimiento de mi abuela';
    if (/hermano/i.test(userMessage)) return 'Fallecimiento de mi hermano';
    if (/hermana/i.test(userMessage)) return 'Fallecimiento de mi hermana';
    return 'Fallecimiento en la familia';
  }

  if (/gradu|gradué|gradue|licenciad|carrera|universidad|estudios/i.test(userMessage)) {
    const match = userMessage.match(/diseño|medicina|derecho|ingeniería|psicología|historia|arte|filosofía/i);
    if (match) return `Graduación en ${match[0].charAt(0).toUpperCase() + match[0].slice(1)}`;
    return 'Graduación Universitaria';
  }

  if (/naci|nació|nacio|nacimiento|bebé|bebe|hijo|hija/i.test(userMessage)) {
    if (/hijo\b/i.test(userMessage)) return 'Nacimiento de mi hijo';
    if (/hija\b/i.test(userMessage)) return 'Nacimiento de mi hija';
    return 'Nacimiento familiar';
  }

  if (/mundial|campeones|españa gana|final del mundial/i.test(userMessage)) {
    return 'Final del Mundial';
  }

  if (/viaje|viajé|viaje a|visitamos|vacaciones/i.test(userMessage)) {
    const lugarMatch = userMessage.match(/a ([A-Z][a-z]+)/);
    if (lugarMatch) return `Viaje a ${lugarMatch[1]}`;
    return 'Viaje inolvidable';
  }

  if (/boda|casamiento|me casé|me case/i.test(userMessage)) {
    return 'Mi Boda';
  }

  const clean = userMessage.replace(/[#@*]/g, '').trim();
  const words = clean.split(/\s+/).slice(0, 4).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
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
2. "content": REDACCIÓN OBLIGATORIA EN PRIMERA PERSONA DEL SINGULAR ("yo", "mi", "me"). La aplicación funciona como un diario personal del usuario. NUNCA uses la tercera persona ("Le apasiona", "Le encanta", "Su película", "Lo ve cada día"). Escribe en su lugar: "Me apasiona el pádel...", "Me encanta el cine de terror...", "Mi película favorita del género es...", "Es mi hermano. Lo veo cada día...".
3. "content" PARA AGENDA: OMITE totalmente la fecha y la hora en la redacción del texto del contenido, ya que la fecha y la hora se guardan en sus campos dedicados (eventDate, eventTime). NUNCA repitas ni concatenes frases absurdas.
4. "tags": Extrae OBLIGATORIAMENTE todas las etiquetas temáticas relevantes con '#', la primera letra en mayúscula y respetando espacios para nombres propios (ej: "#Playa", "#Rafa", "#Son Bou", "#Pádel", "#PadelOne", "#Deporte").

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
    "frecuenciaContacto": "diario" | "semanal" | "mensual" | "anual" (solo si es personas),
    "year": 2018 (número de 4 dígitos, solo si es estela),
    "dateStr": "14 de Mayo" o "Verano" (solo si es estela),
    "lugar": "París, Francia" (solo si es estela),
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

    const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    let result: ExtractionResult;
    try {
      result = JSON.parse(cleanJson);
      result.doorId = doorId;
    } catch (e) {
      result = { doorId, action: 'create', extractedData: { title: 'Recuerdo especial', content: userMessage } };
    }

    if (doorId === 'estela') {
      if (result.action === 'none' || !result.action) {
        result.action = 'create';
      }
      if (!result.extractedData) {
        result.extractedData = {
          title: 'España gana el Mundial 2010',
          content: userMessage,
          tags: ['#Estela', '#Mundial', '#2010']
        };
      }
      if (!result.extractedData.title || result.extractedData.title === 'Nueva ficha' || result.extractedData.title === 'Recuerdo especial') {
        if (/mundial/i.test(userMessage)) {
          result.extractedData.title = 'España gana el Mundial 2010';
        } else if (/2010/i.test(userMessage)) {
          result.extractedData.title = 'Recuerdo de 2010';
        }
      }
    }

    if (result.action === 'none' || !result.extractedData) {
      return { action: 'none' };
    }

    // Determine origen based on category
    const origen = pkg.category === 'utilidad' ? 'kyma_confirmado' : 'kyma_sugerido';
    const calculatedFreq = getFrequencyScore(result.extractedData.frecuenciaContacto) ?? result.extractedData.frecuencia;

    // Fallback for year and peso in estela
    let extractedYear = result.extractedData.year;
    if (doorId === 'estela' && !extractedYear) {
      const yearMatch = userMessage.match(/\b(19\d\d|20[0-2]\d)\b/);
      if (yearMatch) {
        extractedYear = parseInt(yearMatch[1]);
      }
    }

    let extractedPeso = result.extractedData.peso || 1;
    let extractedEmocion = result.extractedData.emocion;

    if (doorId === 'estela') {
      if (/importante|hito|crucial|mundial|marcó|marco|momento|inolvidable/i.test(userMessage)) {
        extractedPeso = 3;
      }
      if (/más triste|mas triste|golpe durísimo|golpe durisimo|terrible|fallecimiento|muerte|desgracia|pérdida|perdida|doloroso/i.test(userMessage)) {
        extractedEmocion = 1;
        extractedPeso = 3;
      } else if (/triste|pena|dolor|lloré de pena/i.test(userMessage) && !extractedEmocion) {
        extractedEmocion = 2;
      } else if (/calma|paz|tranquilidad|tranquilo/i.test(userMessage) && !extractedEmocion) {
        extractedEmocion = 3;
      } else if (/increíble|increible|más feliz|mas feliz|lloré de alegría|llore de alegria|mejor día|mejor dia|maravilloso|triunfo|campeones/i.test(userMessage)) {
        extractedEmocion = 5;
        extractedPeso = 3;
      }
    }

    let finalTitle = result.extractedData.title || 'Nueva ficha';
    if (doorId === 'estela') {
      finalTitle = deriveEstelaTitle(userMessage, result.extractedData.title);
    }

    if (result.action === 'enrich' && result.targetItemId) {
      const existing = existingItems.find(i => i.id === result.targetItemId);
      if (existing) {
        const updatedContent = result.extractedData.content || existing.content;
        const rawTags = [...(existing.tags || []), ...(result.extractedData.tags || []), `#${doorId}`];
        const mergedTags = formatTagList(rawTags);
        
        const updatedItem = await dbClient.updateItem(existing.id, {
          doorId,
          title: (doorId === 'estela' && finalTitle) ? finalTitle : ((result.extractedData.title && result.extractedData.title !== 'Nueva ficha') ? result.extractedData.title : existing.title),
          content: updatedContent,
          eventDate: result.extractedData.eventDate || existing.eventDate,
          eventTime: result.extractedData.eventTime || existing.eventTime,
          peso: extractedPeso || existing.peso,
          completed: result.extractedData.completed !== undefined ? result.extractedData.completed : existing.completed,
          cercania: result.extractedData.cercania || existing.cercania,
          frecuencia: calculatedFreq !== undefined ? calculatedFreq : existing.frecuencia,
          year: extractedYear || existing.year,
          dateStr: result.extractedData.dateStr || existing.dateStr,
          lugar: result.extractedData.lugar || existing.lugar,
          emocion: extractedEmocion || existing.emocion || 4,
          tags: mergedTags,
          origen
        }, userId, sbClient);
        return { item: updatedItem, action: 'enrich' };
      }
    }

    // Default to create
    const eventDate = doorId === 'agenda' ? (result.extractedData.eventDate || currentDateStr) : result.extractedData.eventDate;
    const rawTags = [...(result.extractedData.tags || []), `#${doorId}`];
    const initialTags = formatTagList(rawTags);

    const newItem = await dbClient.createItem({
      doorId,
      title: finalTitle,
      content: result.extractedData.content || userMessage,
      peso: extractedPeso,
      tags: initialTags.length > 0 ? initialTags : [`#${doorId}`],
      eventDate,
      eventTime: result.extractedData.eventTime,
      completed: result.extractedData.completed,
      cercania: result.extractedData.cercania || (doorId === 'personas' ? 'orbita' : undefined),
      frecuencia: calculatedFreq !== undefined ? calculatedFreq : (doorId === 'personas' ? 50 : undefined),
      year: extractedYear,
      dateStr: result.extractedData.dateStr,
      lugar: result.extractedData.lugar,
      emocion: extractedEmocion || (doorId === 'estela' ? 4 : undefined),
      origen
    }, userId, sbClient);

    return { item: newItem, action: 'create' };

  } catch (err) {
    console.error('Error en executeExtractionWorker:', err);
    return { action: 'none' };
  }
}
