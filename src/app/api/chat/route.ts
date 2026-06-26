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

    let model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    
    // Map the requested "gemini-3-flash" to the actual supported identifier "gemini-3.5-flash"
    if (model === 'gemini-3-flash') {
      model = 'gemini-3.5-flash';
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Map chat messages to Gemini API contents format:
    // { role: 'user' | 'model', parts: [{ text: '...' }] }
    // Group consecutive messages of the same role to keep history clean and avoid API constraints.
    const contents: any[] = [];
    
    for (const msg of (messages || [])) {
      if (!msg.text || !msg.text.trim()) continue;
      
      const role = msg.sender === 'kyma' ? 'model' : 'user';
      let text = msg.text;
      
      if (msg.contextItem) {
        text = `[Con respecto al elemento de tipo "${msg.contextItem.doorId}" titulado "${msg.contextItem.title}"]: ${text}`;
      }
      
      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += '\n' + text;
      } else {
        contents.push({
          role,
          parts: [{ text }]
        });
      }
    }

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

