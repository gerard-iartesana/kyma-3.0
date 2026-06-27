import { dbClient, KymaItem } from '../db/client';
import { DOOR_PACKAGES } from './doorPackages';
import { DoorId, ExtractionResult } from './types';

export async function executeExtractionWorker(
  doorId: DoorId,
  userMessage: string,
  userId?: string,
  contextSnippet?: string
): Promise<{ item?: KymaItem; action: 'create' | 'enrich' | 'none' }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('ExtractionWorker: GEMINI_API_KEY no configurada');
    return { action: 'none' };
  }

  const pkg = DOOR_PACKAGES[doorId];
  if (!pkg) return { action: 'none' };

  // Fetch existing items for context (e.g., checking interests or existing people)
  const existingItems = await dbClient.getItems(doorId, userId);
  const existingSummary = existingItems.map(i => ({
    id: i.id,
    title: i.title,
    content: i.content,
    tags: i.tags
  }));

  let model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  if (model === 'gemini-3-flash') {
    model = 'gemini-3.5-flash';
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `
Tu tarea es actuar como el trabajador de extracción invisible para la puerta "${pkg.doorId}" (Categoría: ${pkg.category}).
NO HABLAS CON EL USUARIO. Tu única salida debe ser un objeto JSON válido con la estructura especificada.

GUARDARRAÍLES DE ESTA PUERTA:
${pkg.guardrails.map(g => `- ${g}`).join('\n')}

ELEMENTOS EXISTENTES EN ESTA PUERTA PARA ESTE USUARIO:
${JSON.stringify(existingSummary, null, 2)}

MENSAJE O CONTEXTO DEL USUARIO:
"${userMessage}"
${contextSnippet ? `Contexto adicional: "${contextSnippet}"` : ''}

REGLAS DE SALIDA:
Devuelve UNICAMENTE un objeto JSON con el siguiente esquema:
{
  "action": "create" | "enrich" | "none",
  "targetItemId": "ID del elemento existente a enriquecer si action es 'enrich'",
  "extractedData": {
    "title": "Título claro y conciso",
    "content": "Cuerpo o detalle estructurado",
    "peso": 1 | 2 | 3,
    "eventDate": "YYYY-MM-DD" (solo si es agenda),
    "eventTime": "HH:MM" (solo si es agenda),
    "completed": false (solo si es tareas),
    "cercania": "nucleo" | "cercana" | "orbita" (solo si es personas, defecto orbita),
    "tags": ["#tag1", "#tag2"]
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

    if (result.action === 'enrich' && result.targetItemId) {
      const existing = existingItems.find(i => i.id === result.targetItemId);
      if (existing) {
        const updatedContent = `${existing.content}\n\n[Actualización]: ${result.extractedData.content}`;
        const mergedTags = Array.from(new Set([...(existing.tags || []), ...(result.extractedData.tags || [])]));
        
        const updatedItem = await dbClient.updateItem(existing.id, {
          content: updatedContent,
          tags: mergedTags,
          origen
        }, userId);
        return { item: updatedItem, action: 'enrich' };
      }
    }

    // Default to create
    const newItem = await dbClient.createItem({
      doorId,
      title: result.extractedData.title || 'Nueva ficha',
      content: result.extractedData.content || '',
      peso: result.extractedData.peso || 1,
      tags: result.extractedData.tags || [`#${doorId}`],
      eventDate: result.extractedData.eventDate,
      eventTime: result.extractedData.eventTime,
      completed: result.extractedData.completed,
      cercania: result.extractedData.cercania || (doorId === 'personas' ? 'orbita' : undefined),
      origen
    }, userId);

    return { item: newItem, action: 'create' };

  } catch (err) {
    console.error('Error en executeExtractionWorker:', err);
    return { action: 'none' };
  }
}
