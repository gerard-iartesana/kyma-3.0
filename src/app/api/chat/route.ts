import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key is not configured on the server.' },
        { status: 400 }
      );
    }

    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Map chat messages to Gemini API contents format:
    // { role: 'user' | 'model', parts: [{ text: '...' }] }
    // Note: Gemini API requires alternate user/model messages.
    // Also, we clean up system/buffer markers if any.
    const contents = (messages || [])
      .map((msg: any) => {
        let role = 'user';
        if (msg.sender === 'kyma') {
          role = 'model';
        }
        return {
          role,
          parts: [{ text: msg.text }]
        };
      })
      .filter((c: any) => c.parts[0].text && c.parts[0].text.trim().length > 0);

    // If there are no messages, return a default prompt
    if (contents.length === 0) {
      return NextResponse.json({ text: 'Hola. ¿En qué puedo ayudarte hoy?' });
    }

    const systemInstruction = {
      parts: [
        {
          text: `Eres Kyma, un asistente de autoconocimiento y diario personal lento. Tu tono es calmado, socrático, reflexivo y minimalista. Acompañas al usuario a reflexionar sobre sus notas, tareas, agenda, intereses y vínculos afectivos. Evitas dar respuestas largas, formateadas con excesivos markdown o listas. Respondes con brevedad (máximo 2-3 párrafos cortos) y haces preguntas abiertas y agudas para invitar a la introspección.`
        }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        systemInstruction,
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.7,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error response:', errorText);
      return NextResponse.json(
        { error: `Gemini API returned: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No he podido procesar una respuesta en este momento.';

    return NextResponse.json({ text: replyText });
  } catch (err: any) {
    console.error('API Chat Route Handler Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
