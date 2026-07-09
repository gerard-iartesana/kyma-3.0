import { ChatMessage, dbClient, KymaItem } from '../db/client';
import { createSupabaseClient } from '../supabase';
import { executeExtractionWorker } from './extractionWorker';
import { DoorId, TriageResult } from './types';

const KYMA_CONSTITUTION = `
Eres Kyma, un asistente de autoconocimiento y diario personal lento. Tu tono es "Amigo Inteligente" — curioso, lúcido, cálido, juguetón, humano y minimalista.

PRINCIPIOS FUNDAMENTALES:
- Espejo, no juez: Ante cosas personales o afectivas, pregunta antes de aconsejar. Usa lenguaje de hipótesis, nada clínico, sin etiquetas.
- Una sola voz: Hablas siempre en primera persona del singular ("yo", "mi"). Eres la única voz que el usuario escucha.
- El sistema sugiere, el usuario decide: En temas de Mapa (intereses, vínculos, reflexiones, estela), tú propones o indagas con preguntas abiertas.
- Indagación Proactiva de Vínculos: Cuando el usuario mencione a una persona cercana, familiar (ej: "mi otra hermana Filo", "un amigo", "mi primo", etc.) que no esté ya registrada en su mapa de Vínculos/personas, muéstrate cálidamente curioso y pregúntale de forma abierta si le gustaría que guardéis una ficha para ella en Vínculos. Una pregunta amable abre la puerta a construir un diario más completo.
- Prevención de colisión de nombres: Si el usuario te pide registrar o hacer referencia a una persona con un nombre de pila común que ya existe en su mapa (ej: "David", "Marc", "Jordi"), recomiéndale o sugiérele amablemente añadir un apellido o un apodo/rol diferenciador (ej: "David de pádel", "David García", "Marc del trabajo") para que no haya confusión en las fichas.
- Acuses en línea (Solo con confirmación real de [SISTEMA]): ÚNICAMENTE cuando en el mensaje de [SISTEMA] de este turno se te confirme explícitamente que se ha registrado, actualizado o eliminado una ficha, debes incluir el acuse de recibo breve en tu respuesta. NUNCA repitas ni escribas las palabras "[SISTEMA]" ni etiquetas internas en tu mensaje al usuario.
- Datos exactos: Copia siempre los números de teléfono o datos numéricos de forma exacta e íntegra, sin recortar dígitos.
- Brevedad y naturalidad: Respondes con sobriedad (máximo 1 o 2 párrafos cortos), en texto plano fluido en español.
- Compleitud: Concluye tus oraciones y preguntas de forma completa y cerrada.
- Respuesta limpia: Tu mensaje debe ser exclusivamente el texto final en español que leerá el usuario. NUNCA incluyas comprobaciones de directrices, notas de diseño, listas de autoevaluación ni pensamientos internos en inglés o español.
`;

function extractUserProfileUpdates(userText: string, currentProfile?: any): { updatedProfile?: any; extractedKey?: string; extractedVal?: string } {
  if (!userText || userText.trim().length < 3) return {};

  const text = userText.trim();
  let updated = { ...currentProfile };
  let hasChanges = false;
  let key = '';
  let val = '';

  // 1. Nombre
  const nameMatch = text.match(/(?:me llamo|mi nombre es|llámame|llamame|cábiame el nombre a|cambiame el nombre a|mi nombre por|puedes llamarme) ([A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+)?)(?:\.|$|,|\s+y\b|\s+tengo\b)/i);
  if (nameMatch) {
    const rawName = nameMatch[1].trim();
    const stopWords = /^(de|en|un|una|el|la|los|las|muy|tan|bastante|aquí|aqui)$/i;
    if (!stopWords.test(rawName)) {
      const formattedName = rawName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      if (formattedName !== updated.nombre) {
        updated.nombre = formattedName;
        hasChanges = true;
        key = 'nombre';
        val = formattedName;
      }
    }
  }

  // 2. Edad o Fecha de Nacimiento (calculada automáticamente)
  const ageMatch = text.match(/(?:tengo|mi edad es|cumplí|cumpli|tengo unos|tengo la edad de) (\d{1,3}) (?:años|anos)/i);
  
  // Use negative lookahead to prevent false word boundary issues with accented characters
  const birthTriggerRegex = /(?:nací|naci|nacimiento|nacido|nacida|fecha de nacimiento)(?![a-zñáéíóúü])/i;

  if (ageMatch) {
    const newAge = ageMatch[1];
    if (newAge !== updated.edad) {
      updated.edad = newAge;
      hasChanges = true;
      key = 'edad';
      val = newAge;
    }
  } else if (birthTriggerRegex.test(text)) {
    const triggerIndex = text.search(birthTriggerRegex);
    const birthText = text.slice(triggerIndex);

    // Formats
    const format1Match = birthText.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
    const format2Match = birthText.match(/\b(\d{1,2})\s+de\s+([a-zñáéíóúü]+)\s+(?:de|del)\s+(19\d{2}|20[0-2]\d|\b\d{2}\b)/i);
    const format3Match = birthText.match(/\b([a-zñáéíóúü]+)\s+(?:de|del)\s+(19\d{2}|20[0-2]\d|\b\d{2}\b)/i);
    const format4Match = birthText.match(/(?:en\s+el|en|del|de|año|ano|:|\b)\s*\b(19\d{2}|20[0-2]\d|[3-9]\d|[0-2]\d)\b/i);

    let day: number | null = null;
    let month: number | null = null; 
    let birthYear: number | null = null;

    const monthsMap: { [k: string]: number } = {
      enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
      julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
    };

    if (format1Match) {
      day = parseInt(format1Match[1]);
      month = parseInt(format1Match[2]) - 1;
      const yrStr = format1Match[3];
      birthYear = parseInt(yrStr);
      if (yrStr.length === 2) {
        birthYear += (birthYear >= 30 ? 1900 : 2000);
      }
    } else if (format2Match) {
      day = parseInt(format2Match[1]);
      const mStr = format2Match[2].toLowerCase();
      month = monthsMap[mStr];
      const yrStr = format2Match[3];
      birthYear = parseInt(yrStr);
      if (yrStr.length === 2) {
        birthYear += (birthYear >= 30 ? 1900 : 2000);
      }
    } else if (format3Match) {
      const mStr = format3Match[1].toLowerCase();
      month = monthsMap[mStr];
      const yrStr = format3Match[2];
      birthYear = parseInt(yrStr);
      if (yrStr.length === 2) {
        birthYear += (birthYear >= 30 ? 1900 : 2000);
      }
    } else if (format4Match) {
      const yrStr = format4Match[1];
      birthYear = parseInt(yrStr);
      if (yrStr.length === 2) {
        birthYear += (birthYear >= 30 ? 1900 : 2000);
      }
    }

    if (birthYear) {
      const now = new Date();
      const currentYear = now.getFullYear();
      let calculatedAge = currentYear - birthYear;

      if (month !== null && month !== undefined && day !== null && day !== undefined) {
        const currentMonth = now.getMonth();
        const currentDay = now.getDate();
        if (currentMonth < month || (currentMonth === month && currentDay < day)) {
          calculatedAge--;
        }
      }

      if (calculatedAge > 0 && calculatedAge < 120 && String(calculatedAge) !== updated.edad) {
        updated.edad = String(calculatedAge);
        hasChanges = true;
        key = 'edad';
        val = `${calculatedAge} años (calculada a partir de tu fecha de nacimiento en ${birthYear})`;
      }
    }
  }

  // 3. Lugar de Residencia
  const residenceMatch = text.match(/(?:vivo en|resido en|soy de|mi lugar de residencia es|ahora vivo en) ([A-ZÁÉÍÓÚÑa-záéíóúñ\s,]+)(?:\.|$|,|\s+y\b)/i);
  if (residenceMatch) {
    const newRes = residenceMatch[1].trim();
    if (newRes.length > 2 && newRes.length < 40 && newRes !== updated.lugarResidencia) {
      updated.lugarResidencia = newRes;
      hasChanges = true;
      key = 'lugarResidencia';
      val = newRes;
    }
  }

  if (hasChanges) {
    return { updatedProfile: updated, extractedKey: key, extractedVal: val };
  }
  return {};
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
        console.warn(`Gemini API call to ${modelName} returned status ${res.status}: ${errText}`);
      }
    } catch (err) {
      console.error(`Fetch error with model ${modelName}:`, err);
    }
  }
  return null;
}

export function sanitizeKymaReply(replyText: string): string {
  if (!replyText) return '';
  
  let cleanText = replyText.trim();
  
  // 1. Safe targeted sanitization of LLM preamble / artifacts & internal system tags
  cleanText = cleanText.replace(/^(?:wait,\s*)?let\s+me\s+make\s+sure\s+it\s+is\s+complete\.?\s*/i, '');
  cleanText = cleanText.replace(/\[SISTEMA\]:?/gi, '');
  cleanText = cleanText.replace(/\[DATOS[^\]]*\]/gi, '');
  cleanText = cleanText.replace(/^(?:wait,\s*)?(?:let\s+me\s+make\s+sure|check\s+constraints|constraints\s*checked)[^*:\n]*\**\s*:?\s*(?:"[^"]*"\s*)?\n?/gi, '');

  // 2. Line-by-line constraint leak and english preamble cleanup
  const lines = cleanText.split('\n');
  const cleanLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const l = trimmed.toLowerCase();
    
    const isConstraintLeak = l.includes('check constraints') || 
                             l.includes('concluye siempre') || 
                             l.includes('compleitud obligatoria') || 
                             l.includes('meta-razonamientos') || 
                             l.includes('espejo, no juez') || 
                             l.includes('una sola voz') || 
                             l.includes('sugiere, el usuario decide') || 
                             l.includes('meta-reasoning') || 
                             l.includes('clinical label') || 
                             l.includes('clinical labels') || 
                             l.includes('spanish dialect') || 
                             l.includes('castellano dialect') || 
                             l.includes('first person') || 
                             l.includes('final polish') || 
                             l.includes('fits perfectly') || 
                             l.includes('let\'s write') || 
                             l.includes('let\'s see') || 
                             l.includes('let\'s check') || 
                             l.includes('tone check') || 
                             l.includes('no quotes') || 
                             l.includes('no tags') || 
                             l.includes('yes, just') || 
                             /^(?:yes|no)\b.*\b(?:talking|labels|quotes|clinical|reasoning|states)\b/i.test(l) || 
                             /\?\s*(?:yes|no)\b/i.test(l) || 
                             /^(?:supongo que|me parece|parece que).*[.!?]*\s*["')}\]]*$/i.test(trimmed) && trimmed.includes('"') && trimmed.includes(',');
    
    if (isConstraintLeak || trimmed === '') {
      continue;
    }
    
    cleanLines.push(line);
  }
  
  cleanText = cleanLines.join('\n').trim();
  cleanText = cleanText.replace(/^(?:transition\?|first person|final polish|step \d+)[^\n]*\n?/gi, '');
  cleanText = cleanText.replace(/^['"]?\s*included\.\s*\d+\.\s*\*\*[^*]+\*\*\s*:\s*/i, '');
  cleanText = cleanText.replace(/^(?:\d+\.|\*|-)?\s*\*\*[^*]+\*\*:?\s*/i, '');
  cleanText = cleanText.replace(/(?:Fits perfectly|One\/two short paragraphs\?|Yes, two short paragraphs|No "" or tags\?|None|Spanish \(Spain\) dialect[^\n]*|\b(?:Spanish|Castellano|Castilian|Español|Espanol)\s*\([A-Za-z]+\)\s*dialect[^\n]*|\b[a-z]{1,3}"\.\s*No\s*"[^"]*")[^\n]*/gi, '');
  cleanText = cleanText.replace(/(?:\n|^)\s*(?:"[A-Za-zÁÉÍÓÚa-záéíóúñ]+"\s*,?\s*){2,}[^\n]*/gi, '');
  cleanText = cleanText.replace(/(?:\n|^)\s*[A-Za-zÁÉÍÓÚa-záéíóúñ\s]+" & [A-Za-zÁÉÍÓÚa-záéíóúñ\s]+"[^\n]*/gi, '');
  cleanText = cleanText.replace(/^['"`]+|['"`]+$/g, '').trim();

  // Trim dangling incomplete transition clauses at the end
  cleanText = cleanText.replace(/(?:\n\n|\s+)(?:por\s+cierto|por|además|ademas|y|también|tambien|en\s+cuanto\s+a|sobre)\s*,?\s*$/gi, '').trim();

  return cleanText;
}

export async function processKymaTurn(
  messages: ChatMessage[],
  userId?: string,
  accessToken?: string,
  userProfile?: { nombre?: string; edad?: string; lugarResidencia?: string; idioma?: string }
): Promise<{ replyText: string; createdItem?: KymaItem; createdItems?: KymaItem[]; action?: string; updatedProfile?: any; extractionError?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no configurada en el servidor.');
  }

  const preferredModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

  const lastUserMessage = [...messages].reverse().find(m => m.sender === 'user');
  const userText = lastUserMessage?.text || '';

  // Extract automatic user profile updates from chat
  const profileExtract = extractUserProfileUpdates(userText, userProfile);
  const activeUserProfile = profileExtract.updatedProfile || userProfile;

  const sbClient = createSupabaseClient(accessToken);

  // Step 1: Triage with recent conversation context
  let triage: TriageResult = { isFicheable: false, confidence: 0 };
  const isCorrection = /(?:\s+|^|[.,;!¿?])(?:corrige|corregir|borra|elimina|no ha|no he|me he|has guardado|has puesto|has creado|debía ser|debia ser|debería ser|deberia ser|equivocado|confundido|error|fallo|no era|no es|era en|es en|era un(?:a)?\s+(?:nota|hito|tarea|evento|vínculo|vinculo|reflexión|reflexion)|como nota|como hito|en notas|en estela|en vínculos|en vinculos|al final será|al final es|será a las|sera a las|cambia la hora|cambia el día|cambia el dia|cambia la fecha|cambia al|cambiar al|pásalo al|pasalo al|ponlo al|ponlo a las|ponla a las|cámbialo a las|cambialo a las|pásalo a las|pasalo a las|cambio de hora|cambio de fecha|cambio de día|cambio de dia)(?:\s+|$|[.,;!¿?])/i.test(userText);

  if (userText.trim().length > 3) {
    const recentMsgs = messages.slice(-5).map(m => `${m.sender === 'user' ? 'Usuario' : 'Kyma'}: ${m.text}`).join('\n');

    const triagePrompt = `
Analiza la siguiente frase del usuario dentro del contexto reciente y determina si contiene información que deba guardarse o actualizarse en una de las 7 puertas del sistema.
Puertas de UTILIDAD: agenda (fechas/citas/cambios de hora), tareas (acciones pendientes), notas (ideas/apuntes/números de teléfono).
Puertas de MAPA: intereses (gustos/pasiones/hobbies), personas (vínculos/relaciones), reflexiones (pensamientos introspectivos), estela (hitos históricos trascendentales del pasado / recuerdos de la infancia o juventud / viajes pasados / eventos vividos en un año específico como 2010, 2018, etc.).

HISTORIAL RECIENTE CONVERSACIONAL:
${recentMsgs}

FRASE ACTUAL DEL USUARIO: "${userText}"

REGLAS ESPECÍFICAS DE TRIAGE:
1. CITAS Y EVENTOS CON HORA O FECHA ACTUAL O FUTURA ("a las 10:00", "a las 17:30", "hoy a las 5", peluquería, médico, cena, partido): Clasifícalas OBLIGATORIAMENTE en la puerta "agenda" (Categoría: utilidad). NUNCA en "estela".
2. ACCIONES PENDIENTES COTIDIANAS SIN HORA ("tengo que comprar...", "debo...", "hacer la compra", "enviar correo"): Clasifícalas en la puerta "tareas" (Categoría: utilidad). NUNCA en "estela".
3. ESTELA DE VIDA / HITOS HISTÓRICOS DEL PASADO: Reserva la puerta "estela" ÚNICAMENTE para acontecimientos vitales trascendentales del PASADO (años anteriores, recuerdos de la infancia/juventud, viajes pasados o eventos vividos en años anteriores como 2010, 2018). QUEDA TOTALMENTE PROHIBIDO clasificar eventos de hoy, eventos futuros o citas en "estela".
4. REGLA DE CONTINUIDAD: Si la frase del usuario complementa o aclara un dato recién tratado en el historial inmediato, clasifícalo en la misma puerta siempre que sea coherente con su naturaleza.

Devuelve UNICAMENTE un JSON con este formato:
{
  "isFicheable": boolean,
  "category": "utilidad" | "mapa",
  "doorId": "agenda" | "tareas" | "notas" | "intereses" | "personas" | "reflexiones" | "estela",
  "confidence": number (0 a 1)
}
`;

    try {
      const triageData = await callGeminiWithFallback(apiKey, {
        contents: [{ role: 'user', parts: [{ text: triagePrompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
      }, preferredModel);

      if (triageData) {
        const rawTriage = triageData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawTriage) {
          const cleanJson = rawTriage.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          if (parsed && typeof parsed === 'object') {
            triage = parsed;
          }
        }
      }
    } catch (e) {
      console.error('Error en triage:', e);
    }

    // Question / query check & management intent check
    const isRequest = /(?:guarda|guardar|añade|añadir|apunta|apuntar|registra|registrar|anota|anotar|recuerda|recordar|recuérdame|recuerdame|me recuerdas|me puedes recordar|crea|crear|pon|poner|escribe|escribir|adjunta|adjuntar)(?:lo|la|los|las|me|nos|se|te)?(?:\s+|$|[.,;!¿?])/i.test(userText) || 
                      /tengo que|debo|hay que|pendiente|comprar|hacer la compra/i.test(userText);

    const isQuestion = !isRequest && (/^(?:\s*¿)|(?:\?)$|^\s*(?:qué|que hice|que tengo|quién|quien|cómo|como|cuándo|cuando|cuál|cual|cuántos|cuantos|dime|puedes decir)(?:\s+|$|[.,;!¿?])/i.test(userText.trim()));
    const isManagementIntent = /(?:elimina|eliminar|borra|borrar|cancela|cancelar|quita|quitar|cámbialo|cambialo|muévelo|muevelo|pásalo|pasalo|ponlo como|muévela|muevela|cámbiala|cambiala)(?:\s+|$|[.,;!¿?])/i.test(userText);

    if ((isQuestion || isManagementIntent) && !isCorrection) {
      triage = { isFicheable: false, confidence: 0 };
    } else {
      // Deterministic override for time, documents/notes, person frequency, tasks, reflexiones vs memories
      const timePattern = /(?:\s+|^|[.,;!¿?])(?:a las?\s+\d{1,2}(?::\d{2})?\s*(?:h|hs|am|pm|a\.m\.|p\.m\.)?|\d{1,2}:\d{2}\s*(?:h|hs|am|pm|a\.m\.|p\.m\.)?)(?:\s+|$|[.,;!¿?])/i;
      const documentNotePattern = /(?:\s+|^|[.,;!])(?:dni|documento|adjunto|nota|teléfono|telefono|correo|email|dirección|direccion|para tenerlo a mano|guardar en notas)(?:\s+|$|[.,;!])/i;
      const personFrequencyPattern = /(?:\s+|^|[.,;!])(?:hablo|hablo poco|hablo mucho|veo|veo poco|veo mucho|contacto|contacto es|frecuencia|una vez al año|una vez al mes|una vez a la semana|diario|diariamente|casi nunca)(?:\s+|$|[.,;!])/i;
      const pendingTaskPattern = /tengo que|debo|hay que|pendiente|comprar|hacer la compra/i;
      const reflectionKeywords = /\b(?:reflexión|reflexion|pensamiento|filosofía|filosofia|principio vital)\b/i;
      const pastYearMatch = userText.match(/\b(19\d\d|20[0-1]\d|202[0-5])\b/);
      const memoryKeywords = /acordaba|acuerdo|recuerdo de la infancia|mi graduación|mi boda|nacimiento de|fallecimiento|cuando viajé a/i;
      
      if (!isCorrection) {
        if (personFrequencyPattern.test(userText)) {
          triage = { isFicheable: true, category: 'mapa', doorId: 'personas', confidence: 0.99 };
        } else if (documentNotePattern.test(userText)) {
          triage = { isFicheable: true, category: 'utilidad', doorId: 'notas', confidence: 0.99 };
        } else if (timePattern.test(userText)) {
          triage = { isFicheable: true, category: 'utilidad', doorId: 'agenda', confidence: 0.98 };
        } else if (reflectionKeywords.test(userText)) {
          triage = { isFicheable: true, category: 'mapa', doorId: 'reflexiones', confidence: 0.98 };
        } else if (pendingTaskPattern.test(userText)) {
          triage = { isFicheable: true, category: 'utilidad', doorId: 'tareas', confidence: 0.95 };
        } else if (pastYearMatch || memoryKeywords.test(userText)) {
          triage = { isFicheable: true, category: 'mapa', doorId: 'estela', confidence: 0.95 };
        }
      }
    }
  }

  // Step 2: Extraction execution across all detected doors (Multi-intent orchestration)
  const allExtractedResults: Array<{ item: KymaItem; action: 'create' | 'enrich' | 'none'; doorId: string }> = [];

  const recentMsgsSnippet = messages.slice(-4).map(m => `${m.sender === 'user' ? 'Usuario' : 'Kyma'}: ${m.text}`).join(' | ');
  const doorsToExtract: DoorId[] = [];

  // Fetch user items early to check for tentative items in confirmations
  let allUserItems: KymaItem[] = [];
  try {
    allUserItems = await dbClient.getItems(undefined, userId, sbClient);
  } catch (err) {
    console.error('Error fetching user items for context:', err);
  }

  // Detector inteligente de confirmaciones a propuestas previas de Kyma (interpretando la acción exacta propuesta)
  const isShortConfirmation = /^(?:ok|sí|si|vale|perfecto|adelante|de acuerdo|claro|por supuesto|hazlo|créala|creala|modifícala|modificala|actualízala|actualizala)(?:\s+|$|[.,;!¿?])/i.test(userText.trim());
  const lastKymaMsgObj = [...messages].reverse().find(m => m.sender === 'kyma');
  const lastKymaMsg = lastKymaMsgObj?.text || '';

  let syntheticProposalPrompt = '';
  if (isShortConfirmation && lastKymaMsg && /(?:ficha|apuntado|apunte|apuntar|apuntemos|registrar|registro|registre|abrirle una ficha|guardar|vínculo|vinculo|vínculos|vinculos|personas|modificar|actualizar|añadir|detalles|hermana|hermano|amigo|amiga|estela|recuerdo|hito|reflexión|reflexion|agenda|calendario|cumpleaños|cumple|tarea|evento|cita)/i.test(lastKymaMsg)) {
    // 1. Determinar la acción exacta propuesta por Kyma en su mensaje
    let proposedAction: 'create' | 'enrich' | 'delete' = 'create';
    if (/(?:modificar|añadir a la ficha|actualizar|añadir este detalle|completar la ficha|editar|cambiar)/i.test(lastKymaMsg)) {
      proposedAction = 'enrich';
    } else if (/(?:eliminar|borrar|quitar|cancelar)/i.test(lastKymaMsg)) {
      proposedAction = 'delete';
    } else if (/(?:abrirle una ficha|crear una ficha|abrir una ficha|nueva ficha|registra|apuntado|anotar|guardar una ficha|guarde|guardar)/i.test(lastKymaMsg)) {
      proposedAction = 'create';
    }

    // 2. Determinar las puertas de destino
    const proposedDoors: DoorId[] = [];
    if (/vínculo|vinculo|personas|hermana|hermano|amigo|amiga|pareja|padre|madre|primo|prima|compañero|compañera/i.test(lastKymaMsg)) {
      proposedDoors.push('personas');
    }
    if (/interés|intereses|gusto|pasión|hobby/i.test(lastKymaMsg)) {
      proposedDoors.push('intereses');
    }
    if (/nota|apunte|documento|dni/i.test(lastKymaMsg) && !/hermana|hermano|amigo|amiga|pareja|agenda|calendario|cumpleaños|cumple/i.test(lastKymaMsg)) {
      proposedDoors.push('notas');
    }
    if (/cita|reunión|reunion|evento|agenda|partido|cumpleaños|cumple/i.test(lastKymaMsg)) {
      proposedDoors.push('agenda');
    }
    if (/tarea|pendiente|recado/i.test(lastKymaMsg)) {
      proposedDoors.push('tareas');
    }
    if (/estela|recuerdo|hito|infancia|juventud/i.test(lastKymaMsg)) {
      proposedDoors.push('estela');
    }
    if (/reflexión|reflexion|pensamiento|aprendizaje/i.test(lastKymaMsg)) {
      proposedDoors.push('reflexiones');
    }

    if (proposedDoors.length === 0) {
      proposedDoors.push('personas'); // fallback default
    }

    // Check if there are existing tentative items in proposedDoors
    let confirmedAny = false;
    if (allUserItems.length > 0) {
      const nowTime = Date.now();
      for (const door of proposedDoors) {
        const recentTentativeItems = allUserItems
          .filter(i => i.doorId === door && i.origen === 'kyma_sugerido' && (nowTime - new Date(i.createdAt).getTime()) < 60000);
        
        if (recentTentativeItems.length > 0) {
          for (const item of recentTentativeItems) {
            try {
              const confirmed = await dbClient.confirmItem(item.id, userId, sbClient);
              allExtractedResults.push({ item: confirmed, action: 'enrich', doorId: door });
              confirmedAny = true;
            } catch (err) {
              console.error('Error confirming tentative item:', err);
            }
          }
        } else {
          const latestTentative = allUserItems
            .filter(i => i.doorId === door && i.origen === 'kyma_sugerido')
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
          if (latestTentative) {
            try {
              const confirmed = await dbClient.confirmItem(latestTentative.id, userId, sbClient);
              allExtractedResults.push({ item: confirmed, action: 'enrich', doorId: door });
              confirmedAny = true;
            } catch (err) {
              console.error('Error confirming latest tentative item:', err);
            }
          }
        }
      }
    }

    if (!confirmedAny) {
      for (const door of proposedDoors) {
        if (!doorsToExtract.includes(door)) {
          doorsToExtract.push(door);
        }
      }
    }

    if (proposedAction === 'create') {
      syntheticProposalPrompt = `El usuario ha dicho "${userText}" confirmando la propuesta de Kyma: "${lastKymaMsg}". DEBES CREAR UNA NUEVA FICHA (action = "create") en las siguientes puertas: ${proposedDoors.join(', ')}. Redacta el contenido en primera persona del singular.`;
    } else if (proposedAction === 'enrich') {
      syntheticProposalPrompt = `El usuario ha dicho "${userText}" confirmando la propuesta de Kyma: "${lastKymaMsg}". DEBES MODIFICAR/ENRIQUECER LA FICHA EXISTENTE (action = "enrich") en las siguientes puertas: ${proposedDoors.join(', ')}.`;
    } else {
      syntheticProposalPrompt = `El usuario ha dicho "${userText}" confirmando la propuesta de Kyma respecto a las puertas: ${proposedDoors.join(', ')}.`;
    }
  }

  if (triage.isFicheable && triage.confidence >= 0.55 && triage.doorId) {
    if (!doorsToExtract.includes(triage.doorId)) {
      doorsToExtract.push(triage.doorId);
    }
  }

  // Secondary deterministic detectors for parallel intents in a single turn
  const agendaKeywords = /\b(?:reunión|reunion|cita|evento|quedada|quedar|a las \d{1,2}|hoy a las|mañana a las|este [a-z]+ a las)\b/i;
  if (agendaKeywords.test(userText) && !doorsToExtract.includes('agenda')) {
    doorsToExtract.push('agenda');
  }

  const taskKeywords = /\b(?:tengo que|tengo q|hay que|debo|preparar|hacer|enviar|comprar|tarea|pendiente|recordar hacer)\b/i;
  if (taskKeywords.test(userText) && !doorsToExtract.includes('tareas')) {
    doorsToExtract.push('tareas');
  }

  const interestKeywords = /\b(?:vea|ver|temporada|serie|película|pelicula|cine|me gusta|me apasiona|me encanta|afición|aficion|hobby|hobbies|escuchar|música|musica|juego|jugar|deporte|pádel|padel|grupo|banda|cantante|favorit|baqueta)\b/i;
  if (interestKeywords.test(userText) && !doorsToExtract.includes('intereses')) {
    doorsToExtract.push('intereses');
  }

  const reflectionKeywords = /\b(?:reflexión|reflexion|pensamiento|filosofía|filosofia|principio vital)\b/i;
  if (reflectionKeywords.test(userText) && !doorsToExtract.includes('reflexiones')) {
    doorsToExtract.push('reflexiones');
  }

  const personMatch = /(?:amigo|amiga|hermano|hermana|padre|madre|pareja|expareja|ex-pareja|exmujer|ex-mujer|exmarido|ex-marido|novio|novia|tío|tía|tio|tia|primo|prima|compañero|compañera|compañero de|compañera de|con mi|con un|con una|con el|con la|jugaré con|jugaré con mi|quedado con|quedé con|hablé con)\s+([a-záéíóúñ]+)/i.test(userText);
  if (personMatch && !doorsToExtract.includes('personas')) {
    doorsToExtract.push('personas');
  }

  const pastYearMatch = userText.match(/\b(19\d\d|20[0-1]\d|202[0-5])\b/);
  const memoryKeywords = /acordaba|acuerdo|recuerdo de la infancia|mi graduación|mi boda|nacimiento de|fallecimiento|cuando viajé a|separé|separó|separo|separación|separacion|mudanza/i;
  if ((pastYearMatch || memoryKeywords.test(userText)) && !doorsToExtract.includes('estela')) {
    doorsToExtract.push('estela');
  }

  const noteKeywords = /\b(?:dni|documento|adjunto|nota|teléfono|telefono|correo|email|dirección|direccion|para tenerlo a mano|guardar en notas|apunta|apuntar)\b/i;
  if (noteKeywords.test(userText) && !doorsToExtract.includes('notas')) {
    doorsToExtract.push('notas');
  }

  let extractionError: string | undefined = undefined;

  for (const dId of doorsToExtract) {
    try {
      const promptToUse = syntheticProposalPrompt ? `${userText} (${syntheticProposalPrompt})` : userText;
      const res = await executeExtractionWorker(
        dId,
        promptToUse,
        userId,
        accessToken,
        `Historial inmediato: ${recentMsgsSnippet}`
      );
      if ((res as any).error) {
        extractionError = (res as any).error;
      }
      if (res.items && res.items.length > 0) {
        for (const item of res.items) {
          allExtractedResults.push({ item, action: res.action, doorId: dId });
        }
      } else if (res.item && res.action !== 'none') {
        allExtractedResults.push({ item: res.item, action: res.action, doorId: dId });
      }
    } catch (err: any) {
      console.error(`Error en extracción multi-puerta (${dId}):`, err);
      extractionError = err.message || 'Error de red en extracción';
    }
  }

  const primaryExtracted = allExtractedResults[0] || { action: 'none' };
  let finalAction: string = primaryExtracted.action;

  // Step 3: User items context is already loaded early in Step 2 as allUserItems


  // Step 3.5: AI Item Management & Relocation Engine (Deletion, Relocation, Correction)
  let deletedItemTitle = '';
  let relocatedItemInfo: { oldDoorId?: string; targetDoorId?: string; title?: string } = {};

  const isManagementRequested = isCorrection || (
    /\b(?:eliminar|elimina|borrar|borra|cancelar|cancela|quitar|quita)\s+(?:la\s+)?(?:ficha|tarjeta|nota|hito|tarea|evento|vínculo|vinculo|relación|relacion)\b/i.test(userText) ||
    /\b(?:muévelo|muevelo|pásalo|pasalo|muévela|muevela|pásala|pasala|cámbiala|cambiala|mover|pasa|pasar|cambia|cambiar|corrige|corregir)\s+(?:la\s+)?(?:ficha|tarjeta|nota|hito|tarea|evento|vínculo|vinculo|relación|relacion)?\s*a\s+(?:estela|notas|tareas|agenda|intereses|vínculos|vinculos|reflexiones|personas)\b/i.test(userText) ||
    /\b(?:cambiar|cambia|editar|edita|modificar|modifica)\s+(?:el\s+)?(?:título|titulo|nombre|cuerpo|contenido|texto)\b/i.test(userText) ||
    /\b(?:debería ser|deberia ser|tendría que ser|tendria que ser|era un|era una|me lo ha puesto como|lo ha guardado como|ha creado como|clasificado como)\s+(?:un\s+|una\s+)?(?:hito|estela|nota|tarea|evento|vínculo|vinculo|reflexión|reflexion)s?\b/i.test(userText) ||
    /\b(?:corregir|corrige|modificar|modifica)\s+(?:este|esta|ese|esa|el|la)?\s*(?:hito|evento|nota|tarea|vínculo|vinculo|ficha|tarjeta)\b/i.test(userText) ||
    /\b(?:añadir|añade|pon|poner|quitar|quita|eliminar|elimina|cambiar|cambia|ponerle)\s+(?:la\s+)?(?:etiqueta|tag|categoría|categoria|tags|etiquetas|vínculo|vinculo|relación|relacion)s?\b/i.test(userText) ||
    /\b(?:en todos|a todos|en todas|a todas|los compañeros|las personas|las fichas)\b/i.test(userText)
  );

  if (isManagementRequested) {
    const mgmtPrompt = `
Analiza la frase del usuario y el historial reciente de mensajes para determinar si el usuario solicita:
1. ELIMINAR / BORRAR una o varias fichas existentes.
2. MOVER / CORREGIR la clasificación de fichas existentes de una puerta a otra.
3. CAMBIAR O EDITAR EL TÍTULO, CONTENIDO, ETIQUETAS/TAGS u otros campos de una o varias fichas existentes.
4. CREAR una nueva ficha que Kyma omitió, no guardó o debería haber creado a partir del historial reciente (ej: "no has añadido la ficha del viaje", "apunta también eso").

HISTORIAL RECIENTE DE MENSAJES (de abajo hacia arriba, los últimos mensajes):
${recentMsgsSnippet}

FICHAS ACTUALES DEL USUARIO (incluyendo sus etiquetas/tags actuales):
${JSON.stringify(allUserItems.map(i => ({ id: i.id, doorId: i.doorId, title: i.title, content: i.content, eventDate: i.eventDate, tags: i.tags })), null, 2)}

FRASE DEL USUARIO: "${userText}"

REGLAS DE SALIDA E INVIOLABILIDAD:
1. REGLA SAGRADA PARA PERSONAS (VÍNCULOS): Las fichas en la puerta "personas" (vínculos) NUNCA SE MOVERÁN NI REUBICARÁN a otra puerta.
2. Si el usuario quiere borrar una ficha sin crear otra: "shouldDelete": true, "itemIdToDelete": "<id>", "shouldCreateNew": false, "shouldUpdateTitle": false.
3. Si el usuario pide explícitamente mover una ficha de otra puerta o reubicarla: "shouldDelete": true, "itemIdToDelete": "<id>", "shouldCreateNew": true, "targetDoorId": "<puerta>", "newTitle": "<titulo>", "shouldUpdateTitle": false.
4. Si el usuario pide EDITAR, CORREGIR, AÑADIR O ACTUALIZAR etiquetas (tags) u otros campos de una o varias fichas existentes (incluso de forma simultánea a múltiples fichas):
   - Establece "shouldUpdateFields": true.
   - Si es una sola ficha, rellena "targetItemIdToUpdate" y "fieldsToUpdate".
   - Si aplica a una o más fichas (por ejemplo: "añade a todos los compañeros que juegan a pádel la etiqueta padel"), DEBES rellenar el array "multipleUpdates" con un objeto por cada ficha a modificar. Cada objeto debe tener:
     "targetItemIdToUpdate": "<id de la ficha>",
     "fieldsToUpdate": { ...objeto con campos a actualizar, ej: "title", "content", "tags" (pasa el array completo con la etiqueta añadida/eliminada, empezando con '#', ej: ["#personas", "#companero", "#padel"]), "year", "cercania", "frecuenciaContacto" }
5. Si el usuario indica que no se ha creado/guardado o que falta añadir una ficha basada en el historial de mensajes: "shouldDelete": false, "shouldCreateNew": true, "targetDoorId": "<puerta de destino>", "newTitle": "<título adecuado para la ficha>", "newContent": "<contenido redactado en primera persona singular>", "year": <año si es estela o null>, "emocion": <emoción de 1 a 5 si es estela o null>, "shouldUpdateTitle": false.

Devuelve ÚNICAMENTE un JSON con este formato:
{
  "shouldDelete": boolean,
  "itemIdToDelete": "ID exacto o null",
  "itemTitleToDelete": "Título o null",
  "shouldCreateNew": boolean,
  "targetDoorId": "agenda" | "tareas" | "notas" | "intereses" | "personas" | "reflexiones" | "estela" | null,
  "newTitle": "Título corto o null",
  "newContent": "Contenido o null",
  "year": number or null,
  "emocion": number or null,
  "cercania": "nucleo" | "cercana" | "orbita" | null,
  "frecuenciaContacto": "diario" | "semanal" | "mensual" | "anual" | "ninguno" | null,
  "shouldUpdateTitle": boolean,
  "targetItemIdToUpdate": "ID exacto de la ficha a cambiar/actualizar o null",
  "newUpdatedTitle": "Nuevo título exacto para la ficha o null",
  "shouldUpdateFields": boolean,
  "fieldsToUpdate": {
    "title": "Nuevo título o null",
    "content": "Nuevo contenido o null",
    "tags": ["array", "de", "tags", "o", "null"],
    "year": number or null,
    "dateStr": "Nueva fecha string o null",
    "eventDate": "YYYY-MM-DD o null",
    "eventTime": "HH:MM o null",
    "emocion": number or null,
    "cercania": "nucleo" | "cercana" | "orbita" | null,
    "frecuenciaContacto": "diario" | "semanal" | "mensual" | "anual" | "ninguno" | null
  } or null,
  "multipleUpdates": [
    {
      "targetItemIdToUpdate": "ID exacto de la ficha",
      "fieldsToUpdate": {
        "title": "Nuevo título o null",
        "content": "Nuevo contenido o null",
        "tags": ["array", "de", "tags", "o", "null"],
        "year": number or null,
        "dateStr": "Nueva fecha string o null",
        "eventDate": "YYYY-MM-DD o null",
        "eventTime": "HH:MM o null",
        "emocion": number or null,
        "cercania": "nucleo" | "cercana" | "orbita" | null,
        "frecuenciaContacto": "diario" | "semanal" | "mensual" | "anual" | "ninguno" | null
      }
    }
  ] or null
}
`;
    try {
      const mgmtData = await callGeminiWithFallback(apiKey, {
        contents: [{ role: 'user', parts: [{ text: mgmtPrompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
      }, preferredModel);

      if (mgmtData) {
        const rawMgmt = mgmtData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawMgmt) {
          const cleanJson = rawMgmt.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsedMgmt = JSON.parse(cleanJson);
          if (parsedMgmt && typeof parsedMgmt === 'object') {

          if ((parsedMgmt.shouldUpdateFields || parsedMgmt.shouldUpdateTitle) && (parsedMgmt.targetItemIdToUpdate || parsedMgmt.multipleUpdates)) {
            const updatesList: { id: string; fields: any }[] = [];

            if (parsedMgmt.multipleUpdates && Array.isArray(parsedMgmt.multipleUpdates)) {
              for (const u of parsedMgmt.multipleUpdates) {
                if (u.targetItemIdToUpdate && u.fieldsToUpdate) {
                  updatesList.push({ id: u.targetItemIdToUpdate, fields: u.fieldsToUpdate });
                }
              }
            } else if (parsedMgmt.targetItemIdToUpdate) {
              const fields: any = parsedMgmt.fieldsToUpdate || {};
              if (parsedMgmt.newUpdatedTitle && !fields.title) {
                fields.title = parsedMgmt.newUpdatedTitle;
              }
              updatesList.push({ id: parsedMgmt.targetItemIdToUpdate, fields });
            }

            for (const updateItemInfo of updatesList) {
              const fields = updateItemInfo.fields || {};
              if (fields.title) {
                fields.title = fields.title.replace(/\bentrenamiento\b/gi, 'Entreno')
                  .replace(/\breunión\b|\breunion\b|\bcita médica\b|\bcita medica\b/gi, 'Cita')
                  .replace(/\bbicicleta\b/gi, 'Bici')
                  .replace(/\bpartido de pádel\b|\bpartido de padel\b/gi, 'Partido')
                  .replace(/\bcorte de pelo\b/gi, 'Pelo');
              }

              if (fields.frecuenciaContacto) {
                fields.frecuencia = fields.frecuenciaContacto === 'diario' ? 100 : 
                  fields.frecuenciaContacto === 'semanal' ? 75 : 
                  fields.frecuenciaContacto === 'mensual' ? 50 : 
                  fields.frecuenciaContacto === 'anual' ? 25 : 
                  fields.frecuenciaContacto === 'ninguno' ? 0 : undefined;
                delete fields.frecuenciaContacto;
              }

              if (Object.keys(fields).length > 0) {
                const updatedItem = await dbClient.updateItem(updateItemInfo.id, fields, userId, sbClient);
                allExtractedResults.unshift({ item: updatedItem, action: 'enrich', doorId: updatedItem.doorId });
                finalAction = 'enrich';
              }
            }
          }

          if (parsedMgmt.shouldDelete && parsedMgmt.itemIdToDelete) {
            const itemObj = allUserItems.find(i => i.id === parsedMgmt.itemIdToDelete);
            await dbClient.deleteItem(parsedMgmt.itemIdToDelete, itemObj, userId, sbClient);
            deletedItemTitle = parsedMgmt.itemTitleToDelete || itemObj?.title || 'la ficha seleccionada';
            finalAction = 'delete';
          }

          if (parsedMgmt.shouldCreateNew && parsedMgmt.targetDoorId && parsedMgmt.newTitle) {
            const itemCalculatedFreq = parsedMgmt.frecuenciaContacto === 'diario' ? 100 : 
              parsedMgmt.frecuenciaContacto === 'semanal' ? 75 : 
              parsedMgmt.frecuenciaContacto === 'mensual' ? 50 : 
              parsedMgmt.frecuenciaContacto === 'anual' ? 25 : 
              parsedMgmt.frecuenciaContacto === 'ninguno' ? 0 : undefined;
            
            let itemYear = parsedMgmt.year;
            if (parsedMgmt.targetDoorId === 'estela' && !itemYear) {
              const yearMatch = userText.match(/\b(19\d\d|20[0-1]\d|202[0-5])\b/);
              if (yearMatch) {
                itemYear = parseInt(yearMatch[1]);
              }
            }

            const newItem = await dbClient.createItem({
              doorId: parsedMgmt.targetDoorId,
              title: parsedMgmt.newTitle,
              content: parsedMgmt.newContent || userText,
              tags: [`#${parsedMgmt.targetDoorId}`, '#general'],
              peso: 2,
              year: itemYear || undefined,
              emocion: parsedMgmt.emocion || (parsedMgmt.targetDoorId === 'estela' ? 4 : undefined),
              cercania: parsedMgmt.cercania || (parsedMgmt.targetDoorId === 'personas' ? 'orbita' : undefined),
              frecuencia: itemCalculatedFreq !== undefined ? itemCalculatedFreq : (parsedMgmt.targetDoorId === 'personas' ? 50 : undefined),
              origen: 'kyma_sugerido'
            }, userId, sbClient);

            allExtractedResults.unshift({ item: newItem, action: 'create', doorId: parsedMgmt.targetDoorId });
            finalAction = 'create';
            relocatedItemInfo = {
              targetDoorId: parsedMgmt.targetDoorId,
              title: parsedMgmt.newTitle
            };
          }
        }
      }
    }
    } catch (mgmtErr) {
      console.error('Error al procesar gestión de fichas en Kyma:', mgmtErr);
    }
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const userItemsContext = allUserItems.map(item => {
    let details = `[${item.doorId.toUpperCase()}] "${item.title}"`;
    if (item.eventDate) details += ` (Fecha: ${item.eventDate}${item.eventTime ? ' a las ' + item.eventTime : ''})`;
    if (item.year) details += ` (Año: ${item.year}${item.lugar ? ' en ' + item.lugar : ''})`;
    if (item.content) details += `: ${item.content}`;
    return details;
  }).join('\n');

  // Step 4: Format conversation history & system prompt for Kyma's response
  const contents: any[] = [];
  const historyMessages = messages.slice(-12);
  for (const msg of historyMessages) {
    if (!msg.text || !msg.text.trim()) continue;
    const role = msg.sender === 'kyma' ? 'model' : 'user';
    let text = msg.text;
    
    // Clean history from english preamble / constraint leaks so Gemini doesn't copy the bad format
    if (msg.sender === 'kyma') {
      text = sanitizeKymaReply(text);
      if (!text || text.trim().length === 0) continue;
    }
    
    if (msg.contextItem) {
      text = `[Con respecto al elemento de tipo "${msg.contextItem.doorId}" titulado "${msg.contextItem.title}"]: ${text}`;
    }

    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts[0].text += '\n' + text;
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }

  let extraInstruction = '';
  if (profileExtract.updatedProfile && profileExtract.extractedKey) {
    extraInstruction += `\n\n[SISTEMA]: El usuario te ha compartido o actualizado su ${profileExtract.extractedKey} ("${profileExtract.extractedVal}"). He guardado automáticamente este dato en su configuración. DEBES acusar recibo de forma muy cálida y natural (ej: "Encantado de conocerte, ${profileExtract.extractedVal}" o "Anotado en tu configuración").`;
  }

  if (deletedItemTitle && relocatedItemInfo.targetDoorId) {
    extraInstruction += `\n\n[SISTEMA]: Se ha ELIMINADO de la base de datos la ficha "${deletedItemTitle}" y se ha CREADO exitosamente la nueva ficha en la puerta "${relocatedItemInfo.targetDoorId}" titulada "${relocatedItemInfo.title}". DEBES confirmar al usuario de forma clara y cálida este cambio (ej: "Quitada de tu Estela y guardada en tus Tareas: ${relocatedItemInfo.title}.").`;
  } else if (deletedItemTitle) {
    extraInstruction += `\n\n[SISTEMA]: Se ha ELIMINADO permanentemente de la base de datos la ficha titulada "${deletedItemTitle}". DEBES confirmar al usuario de forma clara y natural que la ficha ha sido borrada (ej: "Borrado de tu espacio: ${deletedItemTitle}.").`;
  } else if (allExtractedResults.length > 0) {
    for (const ext of allExtractedResults) {
      const actionType = ext.action === 'enrich' ? 'actualizado' : 'registrado';
      if (ext.doorId === 'estela') {
        extraInstruction += `\n\n[SISTEMA]: Se ha ${actionType} automáticamente un hito/recuerdo en la puerta "Estela de vida" titulado "${ext.item.title}". DEBES incluir un acuse de recibo cálido (ej: "Guardado en tu Estela de vida: ${ext.item.title}.").`;
      } else if (ext.doorId === 'agenda') {
        extraInstruction += `\n\n[SISTEMA]: Se ha ${actionType} automáticamente un evento en la puerta "Agenda" titulado "${ext.item.title}" (${ext.item.eventTime ? `a las ${ext.item.eventTime}` : 'para hoy/mañana'}). DEBES acusar recibo de forma muy natural citando el evento y la hora (ej: "Anotado en tu agenda: '${ext.item.title}' a las ${ext.item.eventTime || '12:00'}" o "Me apunto tu '${ext.item.title}' de las ${ext.item.eventTime || '12:00'}").`;
      } else if (ext.doorId === 'tareas') {
        extraInstruction += `\n\n[SISTEMA]: Se ha ${actionType} automáticamente una tarea pendiente en la puerta "Tareas" titulada "${ext.item.title}". DEBES acusar recibo (ej: "Anotado en tus tareas: ${ext.item.title}.").`;
      } else {
        extraInstruction += `\n\n[SISTEMA]: Se ha ${actionType} automáticamente una ficha en la puerta "${ext.doorId}" titulada "${ext.item.title}". DEBES incluir un acuse de recibo breve y natural.`;
      }
    }
  }

  const userName = activeUserProfile?.nombre || 'Usuario';
  const userAge = activeUserProfile?.edad || 'No especificada';
  const userResidence = activeUserProfile?.lugarResidencia || 'España';
  const userLang = activeUserProfile?.idioma || 'Español';

  const resLower = userResidence.trim().toLowerCase();
  const isLatam = /^(argentina|méxico|mexico|colombia|chile|perú|peru|venezuela|uruguay|paraguay|bolivia|ecuador|costa rica|panamá|panama|república dominicana|republica dominicana|puerto rico|cuba|guatemala|honduras|el salvador|nicaragua|estados unidos|eeuu|usa)\b/i.test(resLower) ||
    /\b(buenos aires|bogotá|bogota|cdmx|santiago|lima|montevideo|caracas|quito|san josé|medellín|medellin|guadalajara|miami)\b/i.test(resLower);

  const dialectInstruction = isLatam
    ? `Expresate de forma cálida adaptada a Latinoamérica (${userResidence}).`
    : `Expresate en castellano fluido y natural de España (${userResidence}). No utilices expresiones latinoamericanas como "lindo" o "platicar".`;

  const userContextInstruction = `
\n\n[DATOS DE CONTEXTO PERSONAL DEL USUARIO]:
NOMBRE DEL USUARIO: ${userName} (Dirígete a él de forma cercana y natural llamándolo por su nombre cuando corresponda).
EDAD: ${userAge}
LUGAR DE RESIDENCIA: ${userResidence}
IDIOMA PREFERIDO: ${userLang}
${dialectInstruction}

[INFORMACIÓN DEL ESPACIO Y AGENDA DEL USUARIO]:
FECHA DE HOY: ${todayStr} (${now.toLocaleDateString('es-ES', { weekday: 'long', timeZone: isLatam ? undefined : 'Europe/Madrid' })})
HORA ACTUAL DEL DISPOSITIVO DEL USUARIO: ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: isLatam ? undefined : 'Europe/Madrid' })} h
FECHA DE MAÑANA: ${tomorrowStr} (${tomorrow.toLocaleDateString('es-ES', { weekday: 'long', timeZone: isLatam ? undefined : 'Europe/Madrid' })})

FICHAS GUARDADAS EN EL ESPACIO DEL USUARIO:
${userItemsContext || 'No hay fichas guardadas actualmente.'}

REGLA DE LECTURA DE AGENDA Y FICHAS: Cuando el usuario te pregunte qué tiene para hoy, para mañana o sobre sus tareas/notas/agenda/estela de vida, REVISA strictly la lista anterior de fichas guardadas y dale una respuesta precisa y directa citando los eventos, horas y detalles.
`;

  const systemInstruction = {
    parts: [{ text: KYMA_CONSTITUTION + userContextInstruction + extraInstruction }]
  };

  const isShortMsg = userText.trim().split(/\s+/).length <= 2;
  const isFicheableOrMgmt = triage.isFicheable || isManagementRequested;
  const enableGrounding = false;

  const kymaData = await callGeminiWithFallback(apiKey, {
    contents,
    systemInstruction,
    ...(enableGrounding ? {
      tools: [
        { googleSearch: {} }
      ]
    } : {}),
    generationConfig: {
      maxOutputTokens: 1200,
      temperature: 0.7
    }
  }, preferredModel);

  if (!kymaData) {
    throw new Error('No se pudo obtener respuesta de la API de Gemini');
  }

  const candidateParts = kymaData.candidates?.[0]?.content?.parts || [];
  let replyText = candidateParts.map((p: any) => p.text || '').join('').trim();
  
  replyText = sanitizeKymaReply(replyText);

  // Robust Sentence Completeness Slicer: Ensure text ends on proper closing punctuation (. ? ! " ) )
  if (replyText && !/[.?!")}\u201D\u2019]$/.test(replyText)) {
    const lastPunct = Math.max(replyText.lastIndexOf('.'), replyText.lastIndexOf('?'), replyText.lastIndexOf('!'));
    if (lastPunct > 0) {
      replyText = replyText.slice(0, lastPunct + 1).trim();
    }
  }
  if (!replyText || replyText.length < 15) {
    replyText = 'Comprendo lo que compartes. Si lo miramos como un espejo de lo que valoras hoy... ¿sientes que esto te acerca más a tu centro, o te aleja de él? Dime más, me interesa escucharte.';
  }

  return {
    replyText,
    createdItem: primaryExtracted.item ? { ...primaryExtracted.item, action: primaryExtracted.action } as any : undefined,
    createdItems: allExtractedResults.map(r => {
      if (r.item) {
        (r.item as any).action = r.action;
      }
      return r.item;
    }),
    action: finalAction,
    updatedProfile: profileExtract.updatedProfile,
    extractionError
  };
}
