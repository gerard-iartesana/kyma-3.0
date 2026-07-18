import { dbClient, KymaItem } from '../db/client';
import { createSupabaseClient } from '../supabase';
import { DOOR_PACKAGES } from './doorPackages';
import { DoorId, ExtractionResult } from './types';

function formatTagList(tags: string[], itemTitle?: string): string[] {
  const map = new Map<string, string>();
  const ignoredGenericTags = new Set(['intereses', 'interes', 'personas', 'agenda', 'tareas', 'notas', 'reflexiones', 'estela', 'general']);
  const titleLower = itemTitle ? itemTitle.trim().toLowerCase() : '';

  for (const t of tags) {
    let clean = t.trim().replace(/^#/, '');
    if (!clean) continue;

    // Convert CamelCase to spaced words if needed (ej: InteligenciaArtificial -> Inteligencia Artificial)
    clean = clean.replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2').replace(/([A-ZÁÉÍÓÚÑ]+)([A-ZÁÉÍÓÚÑ][a-záéíóúñ])/g, '$1 $2');
    
    const key = clean.toLowerCase().replace(/\s+/g, ' ');
    if (ignoredGenericTags.has(key)) continue;

    // Evitar que la etiqueta duplique exactamente el título de la propia ficha
    if (titleLower && (key === titleLower || key === titleLower.replace(/\s+/g, ' '))) continue;

    if (!map.has(key)) {
      const lowercaseParticles = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'en', 'y', 'para', 'con', 'a']);
      const words = clean.split(/\s+/).map((w, index) => {
        const lowerW = w.toLowerCase();
        if (index > 0 && lowercaseParticles.has(lowerW)) {
          return lowerW;
        }
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      });
      map.set(key, words.join(' '));
    }
  }
  let resultTags = Array.from(map.values());

  // Filtrar redundancias evidentes (ej: si existe Desarrollo de Software o Desarrollo Software, eliminar Programación)
  const hasSoftware = resultTags.some(t => t.toLowerCase().includes('desarrollo') || t.toLowerCase().includes('software'));
  const hasProg = resultTags.some(t => t.toLowerCase().includes('programación') || t.toLowerCase().includes('programacion'));
  if (hasSoftware && hasProg) {
    resultTags = resultTags.filter(t => !t.toLowerCase().includes('programación') && !t.toLowerCase().includes('programacion'));
  }

  return resultTags;
}

function getFrequencyScore(freqLabel?: string): number | undefined {
  if (!freqLabel) return undefined;
  const l = freqLabel.toLowerCase();
  if (l.includes('0') || l.includes('cero') || l.includes('ningun') || l.includes('ningún') || l.includes('ninguno') || l.includes('nada') || l.includes('nulo') || l.includes('sin contacto') || l.includes('no nos hablamos') || l.includes('dejamos de hablar') || l.includes('distanci')) return 0;
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
): Promise<{ item?: KymaItem; items?: KymaItem[]; action: 'create' | 'enrich' | 'none' }> {
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
1. "title": DEBE SER DIRECTO Y CORTO (máximo 3-4 palabras, ej: "Torneo de Pádel", "Día de Playa", "Cita Médica", "David"). NUNCA incluyas personas, lugares ni horas en el título salvo si la puerta es personas donde el título es exclusivamente el nombre de la persona. Para la puerta "intereses", EVITA nombres genéricos de una sola palabra (como "Cine", "Deporte", "Música"); genera títulos específicos y descriptivos (ej: "Cine clásico de misterio", "Práctica de running y pádel").
2. "content": REDACCIÓN OBLIGATORIA EN PRIMERA PERSONA DEL SINGULAR ("yo", "mi", "me"). La aplicación funciona como un diario personal del usuario. NUNCA uses la tercera persona ("Le apasiona", "Le encanta", "Su película", "Lo ve cada día"). Escribe en su lugar: "Me apasiona el pádel...", "Me encanta el cine de terror...", "Mi película favorita del género es...", "Es mi hermano. Lo veo cada día...".
3. "content" PARA AGENDA: OMITE totalmente la fecha y la hora en la redacción del texto del contenido, ya que la fecha y la hora se guardan en sus campos dedicados (eventDate, eventTime). 
4. "tags": Si la puerta es "personas" (vínculos), usa EXCLUSIVAMENTE etiquetas de clasificación social/relacional (ej: "#Familia", "#Hermano", "#Sobrina", "#Amigo", "#Trabajo", "#Compañero"). NUNCA uses actividades o lugares anecdóticos (NUNCA "#Playa", "#Cine", "#Padel", "#Contacto") ni repitas el nombre de la persona. Para otras puertas (como "intereses"), extrae etiquetas temáticas generales y sus géneros (ej: "#Cine", "#CineDeTerror", "#Deporte", "#Pádel", "#Series"), prohibiendo títulos u obras concretas (NUNCA "#LaCasaDelDragon", "#Nolan").
5. "ENRIQUECIMIENTO DE SUGERENCIAS RECIENTES": Si el mensaje o contexto aporta información complementaria inmediata (como la hora, el lugar, la fecha o especificaciones adicionales) sobre un elemento tentativo reciente que ya figura en ELEMENTOS EXISTENTES (por ejemplo, un evento de agenda que se acaba de proponer y no tiene hora todavía), DEBES seleccionar obligatoriamente action = "enrich", asignar targetItemId al id de ese elemento sugerido, y rellenar en extractedData los campos a actualizar (ej: eventTime: "21:00"). NUNCA crees una ficha duplicada si puedes enriquecer la existente.

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
    "frecuenciaContacto": "diario" | "semanal" | "mensual" | "anual" | "ninguno" (solo si es personas, usa 'ninguno' si no hay contacto o el contacto es cero),
    "year": 2018 (número de 4 dígitos, solo si es estela),
    "dateStr": "14 de Mayo" o "Verano" (solo si es estela. DEBE SER MUY CORTO, máximo día y mes o un solo mes. NUNCA pongas rangos, ni dos meses, ni textos largos como 'Octubre y Noviembre' o 'Finales de año' ya que rompe la interfaz),
    "lugar": "París, Francia" (solo si es estela),
    "emocion": 1 | 2 | 3 | 4 | 5 (solo si es estela: 1: Muy triste/doloroso/pérdida/fallecimiento, 2: Triste/pena/melancolía/fin de relación/distanciamiento, 3: Calma/neutro, 4: Alegre, 5: Muy alegre),
    "fileUrl": "URL o base64 si el usuario adjuntó un archivo/imagen o null",
    "fileName": "Nombre del archivo adjunto si lo hay o null",
    "tags": ["#Cine", "#CineDeTerror", "#Deporte", "#Ocio"]
  },
  "extractedItems": [ // LISTA OPCIONAL: Úsala EXCLUSIVAMENTE si el mensaje o contexto implica la creación/enriquezimiento de MÚLTIPLES elementos (por ejemplo, registrar a varias personas mencionadas de una vez como 'Cristina', 'Nati', 'Roser' y 'Carla'). Cada objeto de esta lista debe tener la misma estructura que "extractedData". Si usas esta lista, puedes omitir o dejar vacío "extractedData".
    {
      "title": "Nombre de la primera persona (o título del primer hito)",
      "content": "Detalles del vínculo o relación en primera persona del singular",
      "cercania": "orbita",
      "frecuenciaContacto": "ninguno"
    }
  ],
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
    let result: ExtractionResult | undefined = undefined;
    try {
      const parsed = JSON.parse(cleanJson);
      if (parsed && typeof parsed === 'object') {
        result = parsed as ExtractionResult;
        result.doorId = doorId;
      }
    } catch (e) {
      return { action: 'none' };
    }

    if (!result) {
      return { action: 'none' };
    }

    // Normalizador de esquemas alternativos o simplificados devueltos por la IA
    if (result && !result.extractedData && !result.extractedItems) {
      if ((result as any).extracted_data) {
        result.extractedData = (result as any).extracted_data;
      } else if ((result as any).data) {
        result.extractedData = (result as any).data;
      } else if ((result as any).item) {
        result.extractedData = (result as any).item;
      } else if ((result as any).content || (result as any).title || (result as any).milestone) {
        result.extractedData = {
          title: (result as any).title || (result as any).titulo,
          content: (result as any).content || (result as any).milestone || (result as any).texto,
          year: (result as any).year || (result as any).año || (result as any).ano,
          dateStr: (result as any).dateStr || (result as any).date_str || (result as any).fecha || (result as any).mes,
          lugar: (result as any).lugar || (result as any).place,
          emocion: (result as any).emocion || (result as any).emotion,
          peso: (result as any).peso || (result as any).weight,
          tags: (result as any).tags
        } as any;
      }
    }

    if (!result.action && (result.extractedData || result.extractedItems)) {
      result.action = 'create';
    }

    if (result.action === 'none') {
      return { action: 'none' };
    }

    // Support multiple items extraction (array) - Early Exit
    if (result.action === 'create' && result.extractedItems && result.extractedItems.length > 0) {
      const createdItems: KymaItem[] = [];
      const origen = 'kyma_sugerido';
      
      let extractedFileUrl: string | undefined = undefined;
      let extractedFileName: string | undefined = undefined;
      if (userMessage.includes('fileUrl: "')) {
        const matchUrl = userMessage.match(/fileUrl:\s*"([^"]+)"/);
        if (matchUrl) extractedFileUrl = matchUrl[1];
      }
      if (userMessage.includes('Adjunto: ')) {
        const matchName = userMessage.match(/Adjunto:\s*([^\n\r\]]+)/);
        if (matchName) extractedFileName = matchName[1].trim();
      }

      for (const itemData of result.extractedItems) {
        let itemCalculatedFreq = getFrequencyScore(itemData.frecuenciaContacto) ?? itemData.frecuencia;
        if (doorId === 'personas') {
          const isExplicitNoContact = /\b(?:contacto 0|contacto cero|sin contacto|no nos hablamos|no me hablo|dejamos de hablar|cero contacto|contacto nulo|ningún contacto|ningun contacto)\b/i.test(userMessage) || 
            /\b(?:cero|ninguno|no nos hablamos|sin contacto)\b/i.test(itemData.frecuenciaContacto || '');
          if (isExplicitNoContact) {
            itemCalculatedFreq = 0;
          }
        }
        
        let itemExtractedYear = itemData.year;
        if (doorId === 'estela' && !itemExtractedYear) {
          const yearMatch = userMessage.match(/\b(19\d\d|20[0-1]\d|202[0-5])\b/) || (contextSnippet && contextSnippet.match(/\b(19\d\d|20[0-1]\d|202[0-5])\b/));
          if (yearMatch) {
            itemExtractedYear = parseInt(yearMatch[1]);
          }
        }

        let itemExtractedEmocion = itemData.emocion;
        if (doorId === 'estela') {
          if (/importante|hito|crucial|mundial|marcó|marco|momento|inolvidable/i.test(userMessage)) {
            // keep default
          }
          if (/más triste|mas triste|golpe durísimo|golpe durisimo|terrible|fallecimiento|muerte|murió|murio|pérdida|perdida|doloroso|separé|separó|separo|separación|separacion|divorcio|exmujer|exmarido/i.test(userMessage)) {
            itemExtractedEmocion = 1;
          } else if (/(?:triste|pena|dolor|lloré de pena|mudanza|dejé|deje|perro|trabajo|vida allí|vida alli)/i.test(userMessage) && !itemExtractedEmocion) {
            itemExtractedEmocion = 2;
          }
        }

        let itemExtractedPeso = itemData.peso || 1;
        if (doorId === 'intereses' && !itemData.peso) {
          itemExtractedPeso = 2;
        }

        let itemTitle = itemData.title || 'Nueva ficha';
        if (doorId === 'estela') {
          itemTitle = deriveEstelaTitle(userMessage, itemData.title);
        }

        const itemEventDate = doorId === 'agenda' ? (itemData.eventDate || currentDateStr) : itemData.eventDate;
        const itemRawTags = [...(itemData.tags || [])];
        const itemInitialTags = formatTagList(itemRawTags, itemTitle);

        const createdItem = await dbClient.createItem({
          doorId,
          title: itemTitle,
          content: itemData.content || userMessage,
          peso: itemExtractedPeso,
          tags: itemInitialTags,
          eventDate: itemEventDate,
          eventTime: itemData.eventTime,
          recurrencia: itemData.recurrencia,
          completed: itemData.completed,
          cercania: itemData.cercania || (doorId === 'personas' ? 'orbita' : undefined),
          frecuencia: itemCalculatedFreq !== undefined ? itemCalculatedFreq : (doorId === 'personas' ? 50 : undefined),
          year: itemExtractedYear,
          dateStr: itemData.dateStr,
          lugar: itemData.lugar,
          emocion: itemExtractedEmocion || (doorId === 'estela' ? 4 : undefined),
          fileUrl: extractedFileUrl,
          fileName: extractedFileName,
          origen
        }, userId, sbClient);

        createdItems.push(createdItem);
      }

      return { items: createdItems, item: createdItems[0], action: 'create' };
    }

    if (!result.extractedData) {
      return { action: 'none' };
    }

    // Determine origen (todas las sugerencias de Kyma requieren confirmacion previa)
    const origen = 'kyma_sugerido';
    let calculatedFreq = getFrequencyScore(result.extractedData.frecuenciaContacto) ?? result.extractedData.frecuencia;
    if (doorId === 'personas') {
      const isExplicitNoContact = /\b(?:contacto 0|contacto cero|sin contacto|no nos hablamos|no me hablo|dejamos de hablar|cero contacto|contacto nulo|ningún contacto|ningun contacto)\b/i.test(userMessage) || 
        /\b(?:cero|ninguno|no nos hablamos|sin contacto)\b/i.test(result.extractedData.frecuenciaContacto || '');
      if (isExplicitNoContact) {
        calculatedFreq = 0;
      }
    }

    // Fallback for year and peso in estela
    let extractedYear = result.extractedData.year;
    const currentYear = now.getFullYear();

    let rawTitle = result.extractedData.title || 'Nueva ficha';
    if (doorId === 'agenda' || doorId === 'tareas') {
      rawTitle = rawTitle.replace(/\bentrenamiento\b/gi, 'Entreno')
        .replace(/\breunión\b|\breunion\b|\bcita médica\b|\bcita medica\b/gi, 'Cita')
        .replace(/\bbicicleta\b/gi, 'Bici')
        .replace(/\bpartido de pádel\b|\bpartido de padel\b/gi, 'Partido')
        .replace(/\bcorte de pelo\b/gi, 'Pelo');
    }
    let finalTitle = rawTitle;
    if (doorId === 'estela') {
      finalTitle = deriveEstelaTitle(userMessage, result.extractedData.title);
    }

    if (doorId === 'estela') {
      if (!extractedYear) {
        const yearMatch = userMessage.match(/\b(19\d\d|20[0-1]\d|202[0-5])\b/) || (contextSnippet && contextSnippet.match(/\b(19\d\d|20[0-1]\d|202[0-5])\b/));
        if (yearMatch) {
          extractedYear = parseInt(yearMatch[1]);
        } else {
          extractedYear = currentYear;
        }
      }

      const hasExplicitPastYear = extractedYear && extractedYear < currentYear;

      // PROHIBICIÓN ABSOLUTA: Las personas/vínculos como tal NUNCA se crean en Estela de vida
      const personKeywords = /\b(?:hermana|hermano|amigo|amiga|pareja|padre|madre|primo|prima|sobrina|sobrino|compañero|compañera|hijo|hija|tío|tía|jefe|jefa|socio|socia)\b/i;
      const isPersonIntent = personKeywords.test(userMessage) || personKeywords.test(finalTitle) || result.extractedData.cercania !== undefined || result.extractedData.frecuenciaContacto !== undefined;
      const memoryKeywords = /\b(?:falleci|falleció|muerte|murió|murio|pérdida|perdida|gradu|gradué|gradue|licenciad|nacimiento|bebé|bebe|boda|casé|case|infancia|juventud|distanciamiento|me dejé de hablar|nos dejamos de hablar|adopt|adopc|perro|gato|mascota|viaje|viajé|mudanza|mudé|ingres|ingreso|hospital|enfermedad|salud|operac|operó|opero|cirugía|accidente|infarto|derrame|médico|medico|diagnóst|diagnost|concierto|festival|show|evento|fiesta|celebrac|memorable|inolvidable|fuimos|visita|visit)\b/i;

      // Si se trata de la persona como tal (o cambio de frecuencia) y no de un evento/hito del pasado explícito, rechazar Estela
      if (isPersonIntent && !memoryKeywords.test(userMessage) && !hasExplicitPastYear) {
        console.warn('[Strict Guardrail Block] Rechazado Estela por tratarse de una persona o frecuencia de contacto.');
        return { action: 'none' };
      }

      const documentOrNoteKeywords = /\b(?:dni|documento|adjunto|nota|teléfono|telefono|correo|email|para tenerlo a mano|guardar en notas)\b/i;
      if (documentOrNoteKeywords.test(userMessage)) {
        console.warn('[Strict Guardrail Block] Rechazado Estela por tratarse de un documento o nota utilitaria.');
        return { action: 'none' };
      }

      const historicalKeywords = /\b(?:falleci|falleció|muerte|murió|murio|pérdida|perdida|gradu|gradué|gradue|licenciad|nacimiento|bebé|bebe|boda|casé|case|infancia|juventud|trabajo|empleo|proyecto|elecciones|consell|gerard|jefe|empresa|socio|19\d\d|20[0-1]\d|202[0-5]|ingres|ingreso|hospital|enfermedad|salud|operac|operó|opero|cirugía|accidente|infarto|derrame|médico|medico|diagnóst|diagnost)\b/i;
      const isHistoricalMemory = historicalKeywords.test(userMessage);

      if (!hasExplicitPastYear && !isHistoricalMemory) {
        console.warn('[Strict Guardrail Block] Rechazado Estela por no contener año pasado explícito ni marcas históricas del pasado.');
        return { action: 'none' };
      }

      if (extractedYear && extractedYear > currentYear) {
        console.warn(`[Strict Guardrail Block] Rechazado Estela para el año futuro ${extractedYear}.`);
        return { action: 'none' };
      }

      if (extractedYear === currentYear && result.extractedData.eventDate) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const localTodayStr = `${year}-${month}-${day}`;
        if (result.extractedData.eventDate >= localTodayStr) {
          console.warn('[Strict Guardrail Block] Rechazado Estela por tratarse de un evento de hoy o futuro en el año actual.');
          return { action: 'none' };
        }
      }

      const timeOrCurrentPattern = /\b(?:a las?\s+\d{1,2}(?::\d{2})?|\d{1,2}:\d{2}|hoy|mañana|esta tarde|esta mañana|esta noche|próximo|proximo)\b/i;
      if (timeOrCurrentPattern.test(userMessage)) {
        console.warn('[Strict Guardrail Block] Rechazado Estela por contener indicación horaria o de tiempo presente/futuro.');
        return { action: 'none' };
      }
    }

    let extractedPeso = result.extractedData.peso || 1;
    let extractedEmocion = result.extractedData.emocion;

    if (doorId === 'intereses') {
      const isExplicitPassion = /\b(?:apasiona|apasionante|apasionado|apasionada|pasión|pasion|locura|mi mayor afición|mi gran afición|favorito|favorita|favoritos|favoritas|preferido|preferida|preferidos|preferidas)\b/i.test(userMessage) || 
        /\b(?:apasiona|apasionante|pasión|pasion|favorito|favorita|favoritos|favoritas|preferido|preferida|preferidos|preferidas)\b/i.test(result.extractedData.content || '');
      if (isExplicitPassion) {
        extractedPeso = 3; // Marcar como Pasión (peso 3) si expresa pasion/favorito
      } else if (/\b(?:me gusta|me encanta|interesa|interesante|afición|aficion)\b/i.test(userMessage)) {
        extractedPeso = 2; // Marcar como Interés habitual (peso 2)
      } else if (!result.extractedData.peso) {
        extractedPeso = 2; // Defecto para intereses
      }
    }

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
      if (/más triste|mas triste|golpe durísimo|golpe durisimo|terrible|fallecimiento|muerte|desgracia|pérdida|perdida|doloroso|separé|separó|separo|separación|separacion|divorcio|exmujer|exmarido/i.test(userMessage)) {
        extractedEmocion = 1;
        extractedPeso = 3;
      } else if (/(?:triste|pena|dolor|lloré de pena|mudanza|dejé|deje|perro|trabajo|vida allí|vida alli)/i.test(userMessage) && !extractedEmocion) {
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
          } else if (doorId === 'intereses' || newChunk.length > updatedContent.length * 0.7) {
            // Si la IA ha reescrito el contenido completo de forma cohesiva, usar la nueva version estructurada
            updatedContent = newChunk;
          } else {
            // Verificar si el nuevo fragmento ya esta presente parcialmente para evitar redundancia aditiva
            const existingLower = updatedContent.toLowerCase();
            const chunkLower = newChunk.toLowerCase();
            if (!existingLower.includes(chunkLower) && !chunkLower.split('.').some(s => s.trim().length > 10 && existingLower.includes(s.trim()))) {
              updatedContent = `${updatedContent}\n\n${newChunk}`;
            }
          }
        }
        const rawTags = result.extractedData.tags && result.extractedData.tags.length > 0 
          ? [...result.extractedData.tags]
          : [...(existing.tags || [])];
        const targetTitle = (finalTitle && finalTitle !== 'Nueva ficha') ? finalTitle : ((result.extractedData.title && result.extractedData.title !== 'Nueva ficha') ? result.extractedData.title : existing.title);
        const mergedTags = formatTagList(rawTags, targetTitle);
        
        const targetDoorId = existing.doorId === 'personas' ? 'personas' : doorId;
        const updatedItem = await dbClient.updateItem(existing.id, {
          doorId: targetDoorId,
          title: targetTitle,
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

    let extractedFileUrl = result.extractedData?.fileUrl;
    let extractedFileName = result.extractedData?.fileName;
    if (!extractedFileUrl && userMessage.includes('fileUrl: "')) {
      const matchUrl = userMessage.match(/fileUrl:\s*"([^"]+)"/);
      if (matchUrl) extractedFileUrl = matchUrl[1];
    }
    if (!extractedFileName && userMessage.includes('Adjunto: ')) {
      const matchName = userMessage.match(/Adjunto:\s*([^\n\r\]]+)/);
      if (matchName) extractedFileName = matchName[1].trim();
    }

    // Default to single create
    if (!result.extractedData) {
      return { action: 'none' };
    }

    const eventDate = doorId === 'agenda' ? (result.extractedData.eventDate || currentDateStr) : result.extractedData.eventDate;
    const rawTags = [...(result.extractedData.tags || [])];
    const initialTags = formatTagList(rawTags, finalTitle);

    const newItem = await dbClient.createItem({
      doorId,
      title: finalTitle,
      content: result.extractedData.content || userMessage,
      peso: extractedPeso,
      tags: initialTags,
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

  } catch (err: any) {
    console.error('Error en executeExtractionWorker:', err);
    return { action: 'none', error: err.message || 'Error de extracción' } as any;
  }
}
