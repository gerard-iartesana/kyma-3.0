import { dbClient, KymaItem } from '../db/client';
import { createSupabaseClient } from '../supabase';
import { DOOR_PACKAGES } from './doorPackages';
import { DoorId, ExtractionResult } from './types';

function formatTagList(tags: string[]): string[] {
  const map = new Map<string, string>();
  for (const t of tags) {
    let clean = t.trim().replace(/^#/, '');
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!map.has(key)) {
      const words = clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1));
      map.set(key, words.join(' '));
    }
  }
  return Array.from(map.values());
}

function getFrequencyScore(freqLabel?: string): number | undefined {
  if (!freqLabel) return undefined;
  const l = freqLabel.toLowerCase();
  if (l.includes('0') || l.includes('cero') || l.includes('ningun') || l.includes('ningún') || l.includes('nulo') || l.includes('sin contacto') || l.includes('no nos hablamos') || l.includes('dejamos de hablar') || l.includes('distanci')) return 0;
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

async function callGeminiWithFallback(apiKey: string, bodyObj: any, preferredModel?: string): Promise<any> {
  const targetModel = preferredModel || process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const modelsToTry = Array.from(new Set([targetModel, 'gemini-3.5-flash']));

  for (const modelName of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj)
      });
      if (res.ok) {
        return await res.json();
      } else {
        const errText = await res.text();
        console.warn(`ExtractionWorker Gemini API call to ${modelName} returned status ${res.status}: ${errText}`);
      }
    } catch (err) {
      console.error(`Fetch error with model ${modelName}:`, err);
    }
  }
  return null;
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

  const preferredModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

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
3. "content" PARA AGENDA: OMITE totalmente la fecha y la hora en la redacción del texto del contenido, ya que la fecha y la hora se guardan en sus campos dedicados (eventDate, eventTime). 
4. "tags": Si la puerta es "personas" (vínculos), usa EXCLUSIVAMENTE etiquetas de clasificación social/relacional (ej: "#Familia", "#Hermano", "#Sobrina", "#Amigo", "#Trabajo", "#Compañero"). NUNCA uses actividades o lugares anecdóticos (NUNCA "#Playa", "#Cine", "#Padel", "#Contacto") ni repitas el nombre de la persona. Para otras puertas (como "intereses"), extrae etiquetas temáticas generales y sus géneros (ej: "#Cine", "#CineDeTerror", "#Deporte", "#Pádel", "#Series"), prohibiendo títulos u obras concretas (NUNCA "#LaCasaDelDragon", "#Nolan").

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
    "recurrencia": "none" | "semanal" | "mensual" | "anual" | "primer_lunes_mes" | "ultimo_viernes_mes" (solo si es agenda, detecta expresiones como "todos los lunes", "primer lunes de cada mes", "último viernes del mes"),
    "completed": false (solo si es tareas),
    "cercania": "nucleo" | "cercana" | "orbita" (solo si es personas, defecto orbita),
    "frecuenciaContacto": "diario" | "semanal" | "mensual" | "anual" (solo si es personas),
    "year": 2018 (número de 4 dígitos, solo si es estela),
    "dateStr": "14 de Mayo" o "Verano" (solo si es estela),
    "lugar": "París, Francia" (solo si es estela),
    "fileUrl": "URL o base64 si el usuario adjuntó un archivo/imagen o null",
    "fileName": "Nombre del archivo adjunto si lo hay o null",
    "tags": ["#Cine", "#CineDeTerror", "#Deporte", "#Ocio"]
  },
  "reasoning": "Breve justificación interna"
}
`;

  try {
    const data = await callGeminiWithFallback(apiKey, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    }, preferredModel);

    if (!data) return { action: 'none' };

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return { action: 'none' };

    const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    let result: ExtractionResult;
    try {
      result = JSON.parse(cleanJson);
      result.doorId = doorId;
    } catch (e) {
      return { action: 'none' };
    }

    if (result.action === 'none' || !result.extractedData) {
      return { action: 'none' };
    }

    // Determine origen (todas las sugerencias de Kyma requieren confirmacion previa)
    const origen = 'kyma_sugerido';
    const calculatedFreq = getFrequencyScore(result.extractedData.frecuenciaContacto) ?? result.extractedData.frecuencia;

    // Fallback for year and peso in estela
    let extractedYear = result.extractedData.year;
    const currentYear = now.getFullYear();

    let finalTitle = result.extractedData.title || 'Nueva ficha';
    if (doorId === 'estela') {
      finalTitle = deriveEstelaTitle(userMessage, result.extractedData.title);
    }

    if (doorId === 'estela') {
      // PROHIBICIÓN ABSOLUTA: Las personas/vínculos NUNCA se crean en Estela de vida
      const personKeywords = /\b(?:hermana|hermano|amigo|amiga|pareja|padre|madre|primo|prima|sobrina|sobrino|compañero|compañera|vicenta|marta|alejandro|david)\b/i;
      const isPersonIntent = personKeywords.test(userMessage) || personKeywords.test(finalTitle) || result.extractedData.cercania !== undefined || result.extractedData.frecuenciaContacto !== undefined;
      const memoryKeywords = /\b(?:falleci|falleció|muerte|murió|murio|pérdida|perdida|gradu|gradué|gradue|licenciad|nacimiento|bebé|bebe|boda|casé|case|infancia|juventud|distanciamiento|me dejé de hablar|nos dejamos de hablar)\b/i;

      // Si se trata de la persona como tal (o cambio de frecuencia) y no de un evento/hito del pasado explícito, rechazar Estela
      if (isPersonIntent && !memoryKeywords.test(userMessage)) {
        console.warn('[Strict Guardrail Block] Rechazado Estela por tratarse de una persona o frecuencia de contacto.');
        return { action: 'none' };
      }

      const documentOrNoteKeywords = /\b(?:dni|documento|adjunto|nota|teléfono|telefono|correo|email|para tenerlo a mano|guardar en notas)\b/i;
      if (documentOrNoteKeywords.test(userMessage)) {
        console.warn('[Strict Guardrail Block] Rechazado Estela por tratarse de un documento o nota utilitaria.');
        return { action: 'none' };
      }

      if (!extractedYear) {
        const yearMatch = userMessage.match(/\b(19\d\d|20[0-1]\d|202[0-5])\b/);
        if (yearMatch) {
          extractedYear = parseInt(yearMatch[1]);
        }
      }

      const historicalKeywords = /\b(?:falleci|falleció|muerte|murió|murio|pérdida|perdida|gradu|gradué|gradue|licenciad|nacimiento|bebé|bebe|boda|casé|case|infancia|juventud|19\d\d|20[0-1]\d|202[0-5])\b/i;
      const hasExplicitPastYear = extractedYear && extractedYear < currentYear;
      const isHistoricalMemory = historicalKeywords.test(userMessage);

      if (!hasExplicitPastYear && !isHistoricalMemory) {
        console.warn('[Strict Guardrail Block] Rechazado Estela por no contener año pasado explícito ni marcas históricas del pasado.');
        return { action: 'none' };
      }

      if (extractedYear && extractedYear >= currentYear) {
        console.warn(`[Strict Guardrail Block] Rechazado Estela para el año ${extractedYear} (debe ser estricto pasado < ${currentYear}).`);
        return { action: 'none' };
      }

      const timeOrCurrentPattern = /\b(?:a las?\s+\d{1,2}(?::\d{2})?|\d{1,2}:\d{2}|hoy|mañana|esta tarde|esta mañana|esta noche|próximo|proximo)\b/i;
      if (timeOrCurrentPattern.test(userMessage)) {
        console.warn('[Strict Guardrail Block] Rechazado Estela por contener indicación horaria o de tiempo presente/futuro.');
        return { action: 'none' };
      }
    }

    let extractedPeso = result.extractedData.peso || 1;
    let extractedEmocion = result.extractedData.emocion;

    if (doorId === 'tareas') {
      const isSameDayTask = /\b(?:hoy|esta tarde|esta mañana|esta noche|ahora mismo|imprescindible hoy)\b/i.test(userMessage) || 
        (result.extractedData.eventDate && result.extractedData.eventDate === currentDateStr);
      if (isSameDayTask) {
        extractedPeso = 3; // Marcar como Urgente (peso 3) directamente
      }
    }

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

    if (result.action === 'enrich' && result.targetItemId) {
      const existing = existingItems.find(i => i.id === result.targetItemId);
      if (existing) {
        let updatedContent = existing.content || '';
        if (result.extractedData.content) {
          const newChunk = result.extractedData.content.trim();
          if (!updatedContent) {
            updatedContent = newChunk;
          } else if (!updatedContent.toLowerCase().includes(newChunk.toLowerCase())) {
            updatedContent = `${updatedContent}\n\n${newChunk}`;
          }
        }
        const rawTags = result.extractedData.tags && result.extractedData.tags.length > 0 
          ? [...result.extractedData.tags, `#${doorId}`]
          : [...(existing.tags || []), `#${doorId}`];
        const mergedTags = formatTagList(rawTags);
        
        const targetDoorId = existing.doorId === 'personas' ? 'personas' : doorId;
        const updatedItem = await dbClient.updateItem(existing.id, {
          doorId: targetDoorId,
          title: (targetDoorId === 'estela' && finalTitle) ? finalTitle : ((result.extractedData.title && result.extractedData.title !== 'Nueva ficha') ? result.extractedData.title : existing.title),
          content: updatedContent,
          eventDate: result.extractedData.eventDate || existing.eventDate,
          eventTime: result.extractedData.eventTime || existing.eventTime,
          recurrencia: result.extractedData.recurrencia || existing.recurrencia,
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
    const rawTags = [...(result.extractedData.tags || []), doorId];
    const initialTags = formatTagList(rawTags);

    let extractedFileUrl = result.extractedData.fileUrl;
    let extractedFileName = result.extractedData.fileName;
    if (!extractedFileUrl && userMessage.includes('fileUrl: "')) {
      const matchUrl = userMessage.match(/fileUrl:\s*"([^"]+)"/);
      if (matchUrl) extractedFileUrl = matchUrl[1];
    }
    if (!extractedFileName && userMessage.includes('Adjunto: ')) {
      const matchName = userMessage.match(/Adjunto:\s*([^\n\r\]]+)/);
      if (matchName) extractedFileName = matchName[1].trim();
    }

    const newItem = await dbClient.createItem({
      doorId,
      title: finalTitle,
      content: result.extractedData.content || userMessage,
      peso: extractedPeso,
      tags: initialTags.length > 0 ? initialTags : [doorId],
      eventDate,
      eventTime: result.extractedData.eventTime,
      recurrencia: result.extractedData.recurrencia,
      completed: result.extractedData.completed,
      cercania: result.extractedData.cercania || (doorId === 'personas' ? 'orbita' : undefined),
      frecuencia: calculatedFreq !== undefined ? calculatedFreq : (doorId === 'personas' ? 50 : undefined),
      year: extractedYear,
      dateStr: result.extractedData.dateStr,
      lugar: result.extractedData.lugar,
      emocion: extractedEmocion || (doorId === 'estela' ? 4 : undefined),
      fileUrl: extractedFileUrl,
      fileName: extractedFileName,
      origen
    }, userId, sbClient);

    return { item: newItem, action: 'create' };

  } catch (err) {
    console.error('Error en executeExtractionWorker:', err);
    return { action: 'none' };
  }
}
