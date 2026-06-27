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
- Acuses en línea (Fichas registradas): Cuando en las instrucciones del [SISTEMA] se te indique que se ha registrado o actualizado una ficha en cualquier puerta (ej. agenda o estela de vida), debes acusar recibo de manera breve y natural en tu respuesta (ej: "Guardado en tu Estela de vida: [Título]."), continuando la charla fluida sin cortar el hilo.
- Datos exactos: Copia siempre los números de teléfono o datos numéricos de forma exacta e íntegra, sin recortar dígitos.
- Brevedad y naturalidad: Respondes con sobriedad (máximo 1 o 2 párrafos cortos), en texto plano fluido en español.
- Compleitud: Concluye siempre tus oraciones y pensamientos de forma completa.
`;

function extractUserProfileUpdates(userText: string, currentProfile?: any): { updatedProfile?: any; extractedKey?: string; extractedVal?: string } {
  if (!userText || userText.trim().length < 3) return {};

  const text = userText.trim();
  let updated = { ...currentProfile };
  let hasChanges = false;
  let key = '';
  let val = '';

  // 1. Nombre
  const nameMatch = text.match(/(?:me llamo|mi nombre es|llámame|llamame|cábiame el nombre a|cambiame el nombre a|mi nombre por|puedes llamarme) ([A-ZÁÉÍÓÚÑa-záéíóúñ]+)/i);
  if (nameMatch) {
    const newName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);
    if (newName !== updated.nombre) {
      updated.nombre = newName;
      hasChanges = true;
      key = 'nombre';
      val = newName;
    }
  }

  // 2. Edad
  const ageMatch = text.match(/(?:tengo|mi edad es|cumplí|cumpli|tengo unos) (\d{1,3}) (?:años|anos)/i);
  if (ageMatch) {
    const newAge = ageMatch[1];
    if (newAge !== updated.edad) {
      updated.edad = newAge;
      hasChanges = true;
      key = 'edad';
      val = newAge;
    }
  }

  // 3. Lugar de Residencia
  const residenceMatch = text.match(/(?:vivo en|resido en|soy de|mi lugar de residencia es) ([A-ZÁÉÍÓÚÑa-záéíóúñ\s,]+)(?:\.|$|,)/i);
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

export async function processKymaTurn(
  messages: ChatMessage[],
  userId?: string,
  accessToken?: string,
  userProfile?: { nombre?: string; edad?: string; lugarResidencia?: string; idioma?: string }
): Promise<{ replyText: string; createdItem?: KymaItem; action?: string; updatedProfile?: any }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no configurada en el servidor.');
  }

  let model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  if (model === 'gemini-3-flash') {
    model = 'gemini-3.5-flash';
  }

  const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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
Puertas de MAPA: intereses (gustos/pasiones/hobbies), personas (vínculos/relaciones), reflexiones (pensamientos introspectivos), estela (hitos históricos del pasado / recuerdos de la infancia o juventud / viajes pasados / eventos vividos en un año específico como 2010, 2018, etc.).

HISTORIAL RECIENTE CONVERSACIONAL:
${recentMsgs}

FRASE ACTUAL DEL USUARIO: "${userText}"

REGLAS ESPECÍFICAS DE TRIAGE:
1. SI EL USUARIO MENCIONA UN RECUERDO, ANÉCDOTA PASADA, O UN AÑO PASADO (ej. "en 2010", "recuerdo cuando", "un momento importante de mi vida", "un viaje que hice"), CLASIFÍCALO OBLIGATORIAMENTE EN LA PUERTA "estela" (Categoría: mapa) CON CONFIDENCIA ALTA (>= 0.85).
2. REGLA DE CONTINUIDAD: Si la frase del usuario complementa o aclara un dato recién tratado en el historial inmediato, clasifícalo en la misma puerta previa.

Devuelve UNICAMENTE un JSON con este formato:
{
  "isFicheable": boolean,
  "category": "utilidad" | "mapa",
  "doorId": "agenda" | "tareas" | "notas" | "intereses" | "personas" | "reflexiones" | "estela",
  "confidence": number (0 a 1)
}
`;

    try {
      const triageRes = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: triagePrompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
        })
      });

      if (triageRes.ok) {
        const triageData = await triageRes.json();
        const rawTriage = triageData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawTriage) {
          const cleanJson = rawTriage.replace(/```json/gi, '').replace(/```/g, '').trim();
          triage = JSON.parse(cleanJson);
        }
      }
    } catch (e) {
      console.error('Error en triage:', e);
    }

    // Question / query check to prevent duplications on read turns
    const isQuestion = /^\s*¿|\?|qué|que hice|que tengo|quién|quien|cómo|como|cuándo|cuando|cuál|cual|cuántos|cuantos|dime|recuérdame|recuerdame|puedes decir/i.test(userText.trim());
    if (isQuestion) {
      triage = { isFicheable: false, confidence: 0 };
    } else {
      // Deterministic override for memories, past years, and life milestones
      const pastYearMatch = userText.match(/\b(19\d\d|20[0-2]\d)\b/);
      const memoryKeywords = /acordaba|acuerdo|recuerdo|infancia|juventud|momento de mi vida|hito|viaje a|en mi vida|mundial/i;
      if (pastYearMatch || memoryKeywords.test(userText)) {
        triage = { isFicheable: true, category: 'mapa', doorId: 'estela', confidence: 0.95 };
      }
    }
  }

  // Step 2: Extraction execution if confidence is sufficient
  let extractedResult: { item?: KymaItem; action: 'create' | 'enrich' | 'none' } = { action: 'none' };

  if (triage.isFicheable && triage.confidence >= 0.55 && triage.doorId) {
    const recentMsgsSnippet = messages.slice(-4).map(m => `${m.sender === 'user' ? 'Usuario' : 'Kyma'}: ${m.text}`).join(' | ');
    extractedResult = await executeExtractionWorker(
      triage.doorId,
      userText,
      userId,
      accessToken,
      `Historial inmediato: ${recentMsgsSnippet}`
    );

    // Secondary multi-door extraction for personas/vínculos if a person is mentioned
    const personMatch = userText.match(/(?:amigo|amiga|hermano|hermana|padre|madre|pareja|novio|novia|tío|tía|primo|prima|compañero|compañera|con) ([A-ZÁÉÍÓÚ][a-záéíóú]+)/i);
    if (personMatch && triage.doorId !== 'personas') {
      try {
        await executeExtractionWorker(
          'personas',
          userText,
          userId,
          accessToken,
          `Mención de persona en ${triage.doorId}: ${userText}`
        );
      } catch (personErr) {
        console.error('Error en extracción secundaria de personas:', personErr);
      }
    }
  }

  // Step 3: Fetch user items context to allow Kyma to read agenda, tasks, notes, etc.
  let allUserItems: KymaItem[] = [];
  try {
    allUserItems = await dbClient.getItems(undefined, userId, sbClient);
  } catch (err) {
    console.error('Error fetching user items for Kyma context:', err);
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

  if (extractedResult.item) {
    if (extractedResult.item.doorId === 'estela') {
      const actionType = extractedResult.action === 'enrich' ? 'actualizado' : 'registrado';
      extraInstruction += `\n\n[SISTEMA]: Se ha ${actionType} automáticamente un hito/recuerdo en la puerta "Estela de vida" titulado "${extractedResult.item.title}". DEBES incluir un acuse de recibo cálido e integrado en tu respuesta (ej: "Guardado en tu Estela de vida: ${extractedResult.item.title}.").`;
    } else if (triage.category === 'utilidad') {
      const actionType = extractedResult.action === 'enrich' ? 'actualizado' : 'registrado';
      extraInstruction += `\n\n[SISTEMA]: Se ha ${actionType} automáticamente una ficha en la puerta "${extractedResult.item.doorId}" titulada "${extractedResult.item.title}". DEBES incluir un acuse de recibo breve y natural en tu respuesta (ej: "Apuntado en tu agenda: ${extractedResult.item.title}.").`;
    } else if (triage.category === 'mapa') {
      extraInstruction += `\n\n[SISTEMA]: El usuario ha compartido una inquietud/interés de Mapa. Se ha preparado una propuesta tentative en segundo plano. Tu cometido ahora es INDAGAR curiosamente y hacer una pregunta socrática o reflexiva abierta sobre ello antes de dar nada por sentado.`;
    }
  }

  const userName = activeUserProfile?.nombre || 'Usuario';
  const userAge = activeUserProfile?.edad || 'No especificada';
  const userResidence = activeUserProfile?.lugarResidencia || 'No especificado';
  const userLang = activeUserProfile?.idioma || 'Español';

  const userContextInstruction = `
\n\n[DATOS DE CONTEXTO PERSONAL DEL USUARIO]:
NOMBRE DEL USUARIO: ${userName} (Dirígete a él de forma cercana y natural llamándolo por su nombre cuando corresponda).
EDAD: ${userAge}
LUGAR DE RESIDENCIA: ${userResidence}
IDIOMA PREFERIDO: ${userLang}

[INFORMACIÓN DEL ESPACIO Y AGENDA DEL USUARIO]:
FECHA DE HOY: ${todayStr} (${now.toLocaleDateString('es-ES', { weekday: 'long' })})
FECHA DE MAÑANA: ${tomorrowStr} (${tomorrow.toLocaleDateString('es-ES', { weekday: 'long' })})

FICHAS GUARDADAS EN EL ESPACIO DEL USUARIO:
${userItemsContext || 'No hay fichas guardadas actualmente.'}

REGLA DE LECTURA DE AGENDA Y FICHAS: Cuando el usuario te pregunte qué tiene para hoy, para mañana o sobre sus tareas/notas/agenda/estela de vida, REVISA strictly la lista anterior de fichas guardadas y dale una respuesta precisa y directa citando los eventos, horas y detalles.
`;

  const systemInstruction = {
    parts: [{ text: KYMA_CONSTITUTION + userContextInstruction + extraInstruction }]
  };

  const kymaRes = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction,
      generationConfig: {
        maxOutputTokens: 1200,
        temperature: 0.7
      }
    })
  });

  if (!kymaRes.ok) {
    throw new Error(`Gemini API error: ${kymaRes.statusText}`);
  }

  const kymaData = await kymaRes.json();
  let replyText = kymaData.candidates?.[0]?.content?.parts?.[0]?.text || 'No he podido procesar una respuesta en este momento.';

  // Safe targeted sanitization of LLM preamble / artifacts
  replyText = replyText.replace(/^(?:transition\?|first person|final polish|step \d+)[^\n]*\n?/gi, '');
  replyText = replyText.replace(/^['"]?\s*included\.\s*\d+\.\s*\*\*[^*]+\*\*\s*:\s*/i, '');
  replyText = replyText.replace(/^(?:\d+\.|\*|-)?\s*\*\*[^*]+\*\*:?\s*/i, '');
  replyText = replyText.replace(/^['"`]+|['"`]+$/g, '').trim();
  replyText = replyText.replace(/\s*¿\s*$/g, '').trim();

  return {
    replyText,
    createdItem: extractedResult.item,
    action: extractedResult.action,
    updatedProfile: profileExtract.updatedProfile
  };
}
