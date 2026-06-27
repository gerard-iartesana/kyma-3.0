import { ChatMessage, KymaItem } from '../db/client';
import { executeExtractionWorker } from './extractionWorker';
import { DoorId, TriageResult } from './types';

const KYMA_CONSTITUTION = `
Eres Kyma, un asistente de autoconocimiento y diario personal lento. Tu tono es "Amigo Inteligente" — curioso, lúcido, cálido, juguetón, humano y minimalista.

PRINCIPIOS FUNDAMENTALES:
- Espejo, no juez: Ante cosas personales o afectivas, pregunta antes de aconsejar. Usa lenguaje de hipótesis, nada clínico, sin etiquetas.
- Una sola voz: Hablas siempre en primera persona del singular ("yo", "mi"). Eres la única voz que el usuario escucha.
- El sistema sugiere, el usuario decide: En temas de Mapa (intereses, vínculos, reflexiones), tú propones o indagas con preguntas abiertas.
- Acuses en línea (Utilidad): Cuando en las instrucciones del [SISTEMA] se te indique que se ha registrado una ficha de utilidad o un cambio en ella, debes acusar recibo de manera breve y natural en tu respuesta (ej: "Apuntado el cambio: torneo de pádel hoy a las 19:00h."), continuando la charla fluida sin cortar el hilo.
- Brevedad y naturalidad: Respondes con sobriedad (máximo 2 párrafos cortos), en texto plano fluido o markdown muy ligero.

REGLA ESTRICTA DE SALIDA DIRECTA:
Responde DIRECTAMENTE al usuario en español. Queda estrictamente PROHIBIDO incluir cualquier tipo de pensamiento previo, evaluación interna, lista de verificación de reglas (como "transition? Yes", "First person singular?", "Final Polish", etc.) o meta-análisis. Tu respuesta debe empezar directamente con tus palabras para el usuario.
`;

export async function processKymaTurn(
  messages: ChatMessage[],
  userId?: string,
  accessToken?: string
): Promise<{ replyText: string; createdItem?: KymaItem; action?: string }> {
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

  // Step 1: Triage (Determine if the message triggers a door extraction)
  let triage: TriageResult = { isFicheable: false, confidence: 0 };

  if (userText.trim().length > 5) {
    const triagePrompt = `
Analiza la siguiente frase del usuario y determina si contiene información que deba guardarse o actualizarse en una de las 6 puertas del sistema.
Puertas de UTILIDAD: agenda (fechas/citas/cambios de hora), tareas (acciones pendientes), notas (ideas/apuntes).
Puertas de MAPA: intereses (gustos/pasiones/hobbies), personas (vínculos/relaciones), reflexiones (pensamientos introspectivos/filosóficos).

FRASE: "${userText}"

Devuelve UNICAMENTE un JSON con este formato:
{
  "isFicheable": boolean,
  "category": "utilidad" | "mapa",
  "doorId": "agenda" | "tareas" | "notas" | "intereses" | "personas" | "reflexiones",
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
          triage = JSON.parse(rawTriage);
        }
      }
    } catch (e) {
      console.error('Error en triage:', e);
    }
  }

  // Step 2: Extraction execution if confidence is sufficient
  let extractedResult: { item?: KymaItem; action: 'create' | 'enrich' | 'none' } = { action: 'none' };

  if (triage.isFicheable && triage.confidence >= 0.6 && triage.doorId) {
    extractedResult = await executeExtractionWorker(
      triage.doorId,
      userText,
      userId,
      accessToken,
      lastUserMessage?.contextItem ? `Elemento en contexto: ${lastUserMessage.contextItem.title}` : undefined
    );
  }

  // Step 3: Format conversation history & system prompt for Kyma's response
  const contents: any[] = [];
  for (const msg of messages) {
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
  if (extractedResult.item) {
    if (triage.category === 'utilidad') {
      const actionType = extractedResult.action === 'enrich' ? 'actualizado' : 'registrado';
      extraInstruction = `\n\n[SISTEMA]: Se ha ${actionType} automáticamente una ficha en la puerta "${extractedResult.item.doorId}" titulada "${extractedResult.item.title}". DEBES incluir un acuse de recibo breve y natural en tu respuesta (ej: "Apuntado el cambio: ${extractedResult.item.title}.").`;
    } else if (triage.category === 'mapa') {
      extraInstruction = `\n\n[SISTEMA]: El usuario ha compartido una inquietud/interés de Mapa. Se ha preparado una propuesta tentative en segundo plano. Tu cometido ahora es INDAGAR curiosamente y hacer una pregunta socrática o reflexiva abierta sobre ello antes de dar nada por sentado.`;
    }
  }

  const systemInstruction = {
    parts: [{ text: KYMA_CONSTITUTION + extraInstruction }]
  };

  const kymaRes = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction,
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7
      }
    })
  });

  if (!kymaRes.ok) {
    throw new Error(`Gemini API error: ${kymaRes.statusText}`);
  }

  const kymaData = await kymaRes.json();
  let replyText = kymaData.candidates?.[0]?.content?.parts?.[0]?.text || 'No he podido procesar una respuesta en este momento.';

  // Sanitize any accidental meta tags, thinking artifacts, or headers from LLM output
  replyText = replyText.replace(/^[\s\S]*?(?:transition\?\s*yes|\*\s*first\s*person[^*?]*\?|\w+\?\s*yes)[^"\n]*["`']?/gi, '');
  replyText = replyText.replace(/^(?:transition\?|\*?\s*first person|final polish)[^\n]*\n?/gi, '');
  replyText = replyText.replace(/^['"]?\s*included\.\s*\d+\.\s*\*\*[^*]+\*\*\s*:\s*/i, '');
  replyText = replyText.replace(/^\d+\.\s*\*\*[^*]+\*\*\s*:\s*/i, '');
  replyText = replyText.replace(/^['"]|['"]$/g, '').trim();

  return {
    replyText,
    createdItem: extractedResult.item,
    action: extractedResult.action
  };
}
