import { NextResponse } from 'next/server';
import { processKymaTurn } from '@/lib/agents/kymaOrchestrator';

export async function POST(request: Request) {
  try {
    const { messages, userId } = await request.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json({ text: 'Hola. ¿De qué te apetece conversar hoy?' });
    }

    const result = await processKymaTurn(messages, userId);

    return NextResponse.json({
      text: result.replyText,
      createdItem: result.createdItem,
      action: result.action
    });
  } catch (err: any) {
    console.error('API Chat Route Handler Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
