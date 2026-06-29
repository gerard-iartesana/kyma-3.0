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
- Acuses en línea (Solo con confirmación real de [SISTEMA]): ÚNICAMENTE cuando en el mensaje de [SISTEMA] de este turno se te confirme explícitamente que se ha registrado, actualizado o eliminado una ficha (ej: "Se ha registrado una ficha..."), debes incluir el acuse de recibo breve en tu respuesta. NUNCA inventes ni afirmes que se ha guardado o creado una ficha si el mensaje de [SISTEMA] no te lo indica explícitamente.
- Datos exactos: Copia siempre los números de teléfono o datos numéricos de forma exacta e íntegra, sin recortar dígitos.
- Brevedad y naturalidad: Respondes con sobriedad (máximo 1 o 2 párrafos cortos), en texto plano fluido en español.
- Compleitud OBLIGATORIA: Concluye SIEMPRE tus oraciones, preguntas y pensamientos de forma completa y cerrada. Nunca dejes una frase o pregunta a medias ni te cortes al final.
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
  const birthDateMatch = text.match(/(?:nací el|nací en|naci el|naci en|mi fecha de nacimiento es|nacimiento|fecha de nacimiento)(?: el)?\s*(\d{1,2})?\s*(?:de\s+([a-zñáéíóú]+)\s+de\s+|\/|-)?\s*(19\d\d|20[0-2]\d)/i);

  if (ageMatch) {
    const newAge = ageMatch[1];
    if (newAge !== updated.edad) {
      updated.edad = newAge;
      hasChanges = true;
      key = 'edad';
      val = newAge;
    }
  } else if (birthDateMatch) {
    const day = birthDateMatch[1] ? parseInt(birthDateMatch[1]) : null;
    const monthStr = birthDateMatch[2] ? birthDateMatch[2].toLowerCase() : null;
    const birthYear = parseInt(birthDateMatch[3]);

    const now = new Date();
    const currentYear = now.getFullYear();
    let calculatedAge = currentYear - birthYear;

    if (monthStr && day) {
      const monthsMap: { [k: string]: number } = {
        enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
        julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
      };
      const birthMonth = monthsMap[monthStr];
      if (birthMonth !== undefined) {
        const currentMonth = now.getMonth();
        const currentDay = now.getDate();
        if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < day)) {
          calculatedAge--;
        }
      }
    }

    if (calculatedAge > 0 && calculatedAge < 120 && String(calculatedAge) !== updated.edad) {
      updated.edad = String(calculatedAge);
      hasChanges = true;
      key = 'edad';
      val = `${calculatedAge} años (calculada a partir de tu fecha de nacimiento en ${birthYear})`;
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

export async function processKymaTurn(
  messages: ChatMessage[],
  userId?: string,
  accessToken?: string,
  userProfile?: { nombre?: string; edad?: string; lugarResidencia?: string; idioma?: string }
): Promise<{ replyText: string; createdItem?: KymaItem; createdItems?: KymaItem[]; action?: string; updatedProfile?: any }> {
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
          triage = JSON.parse(cleanJson);
        }
      }
    } catch (e) {
      console.error('Error en triage:', e);
    }

    // Question / query check & management intent check
    const isQuestion = /^\s*¿|\?|qué|que hice|que tengo|quién|quien|cómo|como|cuándo|cuando|cuál|cual|cuántos|cuantos|dime|recuérdame|recuerdame|puedes decir/i.test(userText.trim());
    const isManagementIntent = /(?:elimina|eliminar|borra|borrar|cancela|cancelar|quita|quitar|cámbialo|cambialo|muévelo|muevelo|pásalo|pasalo|ponlo como|muévela|muevela|cámbiala|cambiala)\b/i.test(userText);
    
    if (isQuestion || isManagementIntent) {
      triage = { isFicheable: false, confidence: 0 };
    } else {
      // Deterministic override for time, tasks, reflexiones vs memories
      const timePattern = /\b(?:a las?\s+\d{1,2}(?::\d{2})?|\d{1,2}:\d{2})\b/i;
      const pendingTaskPattern = /tengo que|debo|hay que|pendiente|comprar|hacer la compra/i;
      const reflectionKeywords = /\b(?:reflexión|reflexion|pensamiento|filosofía|filosofia|principio vital)\b/i;
      const pastYearMatch = userText.match(/\b(19\d\d|20[0-2]\d)\b/);
      const memoryKeywords = /acordaba|acuerdo|recuerdo de la infancia|mi graduación|mi boda|nacimiento de|fallecimiento|cuando viajé a/i;
      
      if (timePattern.test(userText)) {
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

  // Step 2: Extraction execution across all detected doors (Multi-intent orchestration)
  const allExtractedResults: Array<{ item: KymaItem; action: 'create' | 'enrich' | 'none'; doorId: string }> = [];

  const recentMsgsSnippet = messages.slice(-4).map(m => `${m.sender === 'user' ? 'Usuario' : 'Kyma'}: ${m.text}`).join(' | ');
  const doorsToExtract: DoorId[] = [];

  if (triage.isFicheable && triage.confidence >= 0.55 && triage.doorId) {
    doorsToExtract.push(triage.doorId);
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

  const interestKeywords = /\b(?:vea|ver|temporada|serie|película|pelicula|cine|me gusta|me apasiona|me encanta|afición|aficion|hobby|hobbies|escuchar|música|musica|juego|jugar|deporte|pádel|padel)\b/i;
  if (interestKeywords.test(userText) && !doorsToExtract.includes('intereses')) {
    doorsToExtract.push('intereses');
  }

  const reflectionKeywords = /\b(?:reflexión|reflexion|pensamiento|filosofía|filosofia|principio vital)\b/i;
  if (reflectionKeywords.test(userText) && !doorsToExtract.includes('reflexiones')) {
    doorsToExtract.push('reflexiones');
  }

  const personMatch = /(?:amigo|amiga|hermano|hermana|padre|madre|pareja|novio|novia|tío|tía|tio|tia|primo|prima|compañero|compañera|compañero de|compañera de|con mi|con un|con una|con el|con la|jugaré con|jugaré con mi|quedado con|quedé con|hablé con)\s+([a-záéíóúñ]+)/i.test(userText);
  if (personMatch && !doorsToExtract.includes('personas')) {
    doorsToExtract.push('personas');
  }

  for (const dId of doorsToExtract) {
    try {
      const res = await executeExtractionWorker(
        dId,
        userText,
        userId,
        accessToken,
        `Historial inmediato: ${recentMsgsSnippet}`
      );
      if (res.item && res.action !== 'none') {
        allExtractedResults.push({ item: res.item, action: res.action, doorId: dId });
      }
    } catch (err) {
      console.error(`Error en extracción multi-puerta (${dId}):`, err);
    }
  }

  const primaryExtracted = allExtractedResults[0] || { action: 'none' };
  let finalAction: string = primaryExtracted.action;

  // Step 3: Fetch user items context to allow Kyma to read agenda, tasks, notes, etc.
  let allUserItems: KymaItem[] = [];
  try {
    allUserItems = await dbClient.getItems(undefined, userId, sbClient);
  } catch (err) {
    console.error('Error fetching user items for Kyma context:', err);
  }

  // Step 3.5: AI Item Management & Relocation Engine (Deletion, Relocation, Correction)
  let deletedItemTitle = '';
  let relocatedItemInfo: { oldDoorId?: string; targetDoorId?: string; title?: string } = {};

  const isManagementRequested = /(?:elimina|eliminar|borra|borrar|cancela|cancelar|quita|quitar|cámbialo|cambialo|muévelo|muevelo|pásalo|pasalo|ponlo como|muévela|muevela|cámbiala|cambiala)\b/i.test(userText);

  if (isManagementRequested && allUserItems.length > 0) {
    const mgmtPrompt = `
Analiza la siguiente frase del usuario dentro del historial reciente. Determina si el usuario solicita ELIMINAR / BORRAR una ficha existente o MOVER / CORREGIR la clasificación de una ficha existente de una puerta a otra (por ejemplo, de "estela" a "tareas" o de "notas" a "agenda").

FICHAS ACTUALES DEL USUARIO:
${JSON.stringify(allUserItems.map(i => ({ id: i.id, doorId: i.doorId, title: i.title, content: i.content, eventDate: i.eventDate })), null, 2)}

FRASE DEL USUARIO: "${userText}"

REGLAS DE SALIDA:
- Si el usuario quiere borrar una ficha sin crear otra: "shouldDelete": true, "itemIdToDelete": "<id>", "shouldCreateNew": false.
- Si el usuario quiere corregir o mover una ficha (ej: "no lo pongas en estela, ponlo como tarea" o "cámbialo a tareas"): "shouldDelete": true, "itemIdToDelete": "<id de la ficha incorrecta>", "shouldCreateNew": true, "targetDoorId": "tareas" (o la puerta indicada), "newTitle": "Título conciso para la nueva ficha", "newContent": "Contenido en primera persona".

Devuelve ÚNICAMENTE un JSON con este formato:
{
  "shouldDelete": boolean,
  "itemIdToDelete": "ID exacto de la ficha a eliminar/mover o null",
  "itemTitleToDelete": "Título de la ficha eliminada o null",
  "shouldCreateNew": boolean,
  "targetDoorId": "agenda" | "tareas" | "notas" | "intereses" | "personas" | "reflexiones" | "estela" | null,
  "newTitle": "Título corto para la nueva ficha",
  "newContent": "Contenido en primera persona"
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

          if (parsedMgmt.shouldDelete && parsedMgmt.itemIdToDelete) {
            const itemObj = allUserItems.find(i => i.id === parsedMgmt.itemIdToDelete);
            await dbClient.deleteItem(parsedMgmt.itemIdToDelete, userId, sbClient);
            deletedItemTitle = parsedMgmt.itemTitleToDelete || itemObj?.title || 'la ficha seleccionada';
            finalAction = 'delete';
          }

          if (parsedMgmt.shouldCreateNew && parsedMgmt.targetDoorId && parsedMgmt.newTitle) {
            const newItem = await dbClient.createItem({
              doorId: parsedMgmt.targetDoorId,
              title: parsedMgmt.newTitle,
              content: parsedMgmt.newContent || userText,
              tags: [`#${parsedMgmt.targetDoorId}`, '#general'],
              peso: 2
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
        extraInstruction += `\n\n[SISTEMA]: Se ha ${actionType} automáticamente un evento en la puerta "Agenda" titulado "${ext.item.title}" (${ext.item.eventTime ? `a las ${ext.item.eventTime}` : 'para hoy/mañana'}). DEBES acusar recibo de forma muy clara citando el evento y la hora (ej: "Me apunto tu reunión de las ${ext.item.eventTime || '12:00'} con ${ext.item.title}.").`;
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
    ? `REGISTRO DIALECTAL LATINOAMERICANO (${userResidence}): Puedes usar giros y expresiones cálidas propias de Latinoamérica ("qué lindo", "lindo", "platicar", etc.) adaptadas a la naturalidad de la región.`
    : `REGISTRO DIALECTAL CASTELLANO DE ESPAÑA (ESTRICTO Y OBLIGATORIO): El usuario reside en España/Europa (${userResidence}). Queda TOTALMENTE PROHIBIDO usar expresiones o giros propios de Latinoamérica (NUNCA digas "qué lindo", "tan lindo", "platicar", "apuntarse" en lugar de apuntar, ni tiempos verbales o vocabulario latinoamericano). Usa un castellano fluido, cálido, natural y propio de España (ej: "qué bien", "qué bonito", "genial", "estupendo", "hablar", "charlar").`;

  const userContextInstruction = `
\n\n[DATOS DE CONTEXTO PERSONAL DEL USUARIO]:
NOMBRE DEL USUARIO: ${userName} (Dirígete a él de forma cercana y natural llamándolo por su nombre cuando corresponda).
EDAD: ${userAge}
LUGAR DE RESIDENCIA: ${userResidence}
IDIOMA PREFERIDO: ${userLang}
${dialectInstruction}

[INFORMACIÓN DEL ESPACIO Y AGENDA DEL USUARIO]:
FECHA DE HOY: ${todayStr} (${now.toLocaleDateString('es-ES', { weekday: 'long' })})
HORA ACTUAL DEL DISPOSITIVO: ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} h
FECHA DE MAÑANA: ${tomorrowStr} (${tomorrow.toLocaleDateString('es-ES', { weekday: 'long' })})

FICHAS GUARDADAS EN EL ESPACIO DEL USUARIO:
${userItemsContext || 'No hay fichas guardadas actualmente.'}

REGLA DE LECTURA DE AGENDA Y FICHAS: Cuando el usuario te pregunte qué tiene para hoy, para mañana o sobre sus tareas/notas/agenda/estela de vida, REVISA strictly la lista anterior de fichas guardadas y dale una respuesta precisa y directa citando los eventos, horas y detalles.
`;

  const systemInstruction = {
    parts: [{ text: KYMA_CONSTITUTION + userContextInstruction + extraInstruction }]
  };

  const kymaData = await callGeminiWithFallback(apiKey, {
    contents,
    systemInstruction,
    tools: [
      { googleSearch: {} }
    ],
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
  if (!replyText) {
    replyText = 'No he podido procesar una respuesta en este momento.';
  }

  // Safe targeted sanitization of LLM preamble / artifacts
  replyText = replyText.replace(/^(?:transition\?|first person|final polish|step \d+)[^\n]*\n?/gi, '');
  replyText = replyText.replace(/^['"]?\s*included\.\s*\d+\.\s*\*\*[^*]+\*\*\s*:\s*/i, '');
  replyText = replyText.replace(/^(?:\d+\.|\*|-)?\s*\*\*[^*]+\*\*:?\s*/i, '');
  replyText = replyText.replace(/^['"`]+|['"`]+$/g, '').trim();

  return {
    replyText,
    createdItem: primaryExtracted.item,
    createdItems: allExtractedResults.map(r => r.item),
    action: finalAction,
    updatedProfile: profileExtract.updatedProfile
  };
}
