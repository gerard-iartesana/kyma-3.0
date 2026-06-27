import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, dbClient, KymaItem } from '../lib/db/client';
import { supabase } from '../lib/supabase';
import { Send, X, Sparkles, PlusCircle, Trash2, Mic } from 'lucide-react';

interface KymaChatProps {
  contextItem: KymaItem | null;
  onClearContext: () => void;
  onItemAddedOrModified: () => void;
}

export function KymaChat({ contextItem, onClearContext, onItemAddedOrModified }: KymaChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        const rec = new SpeechRecognitionAPI();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'es-ES';

        rec.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              transcript += event.results[i][0].transcript;
            }
          }
          if (transcript) {
            setInputText(prev => {
              const separator = prev.endsWith(' ') || prev.length === 0 ? '' : ' ';
              return prev + separator + transcript;
            });
          }
        };

        rec.onerror = (e: any) => {
          console.error('Speech recognition error', e);
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = rec;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('La transcripción de voz no está soportada en este navegador. Inténtalo en Google Chrome.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };
  
  const handleClearChat = async () => {
    if (confirm('¿Limpiar todo el historial de la conversación?')) {
      try {
        const cleanMsg = await dbClient.clearMessages();
        setMessages(cleanMsg);
        onClearContext();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Load initial messages
  useEffect(() => {
    const fetchMsgs = async () => {
      try {
        const msgs = await dbClient.getMessages();
        setMessages(msgs);
      } catch (err) {
        console.error(err);
      }
    };
    fetchMsgs();
  }, []);

  // Scroll to bottom whenever messages or typing state changes
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // When a context item is set from outside (e.g. clicking "Preguntar a Kyma")
  useEffect(() => {
    if (contextItem) {
      // Trigger a socratic question from Kyma automatically
      setIsTyping(true);
      
      const timer = setTimeout(async () => {
        setIsTyping(false);
        const text = getSocraticQuestion(contextItem);
        try {
          const newMsg = await dbClient.receiveKymaMessage(text);
          setMessages(prev => [...prev, newMsg]);
        } catch (err) {
          console.error(err);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [contextItem]);

  const getSocraticQuestion = (item: KymaItem): string => {
    switch (item.doorId) {
      case 'tareas':
        return `Sobre tu tarea "${item.title}": A veces las listas nos imponen una carga invisible. ¿Esta tarea nace de una necesidad real para hoy o es una inercia del deber?`;
      case 'agenda':
        return `Veo "${item.title}" en tu agenda. ¿Qué expectativas o emociones se despiertan en ti al proyectar este encuentro?`;
      case 'notas':
        return `Leyendo tu nota "${item.title}"... ¿Qué te impulsó a capturarla en este momento? ¿Sientes que conecta con algo que hayamos conversado antes?`;
      case 'intereses':
        return `Hablemos de tu pasión por "${item.title}". ¿Cómo te hace sentir dedicarle tiempo? ¿Sientes que te expande por dentro o funciona más como un refugio temporal?`;
      case 'personas':
        return `Al observar tu red y ver a "${item.title}"... ¿Sientes que vuestro ritmo de contacto actual se alinea con el tipo de vínculo que deseas cultivar?`;
      case 'reflexiones':
        return `Volviendo a tu reflexión "${item.title}"... ¿Cómo resuena en ti volver a leer esto hoy? ¿Ha cambiado tu perspectiva en este tiempo?`;
      default:
        return `Me quedé pensando en "${item.title}". ¿Qué es lo más importante de esto para ti en este momento?`;
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userText = inputText;
    setInputText('');

    try {
      // Send user message
      const ctx = contextItem ? { id: contextItem.id, title: contextItem.title, doorId: contextItem.doorId } : undefined;
      const userMsg = await dbClient.sendMessage(userText, ctx);
      setMessages(prev => [...prev, userMsg]);

      // Clear context after sending message with it
      if (contextItem) {
        onClearContext();
      }

      // Trigger Kyma response
      setIsTyping(true);

      const timer = setTimeout(async () => {
        setIsTyping(false);
        try {
          let kymaText = '';
          
          try {
            const allMsgs = await dbClient.getMessages();
            const sessionRes = await supabase.auth.getSession();
            const userId = sessionRes.data.session?.user?.id;
            
            const response = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ messages: allMsgs, userId })
            });
            
            if (response.ok) {
              const data = await response.json();
              kymaText = data.text;
              if (data.createdItem || data.action === 'create' || data.action === 'enrich') {
                onItemAddedOrModified();
              }
            } else {
              console.warn('Gemini API route returned an error, falling back to simulated response');
            }
          } catch (apiErr) {
            console.error('Error fetching Gemini API:', apiErr);
          }

          if (!kymaText) {
            kymaText = await generateResponse(userText, contextItem);
          }

          const kymaMsg = await dbClient.receiveKymaMessage(kymaText);
          setMessages(prev => [...prev, kymaMsg]);
          onItemAddedOrModified(); // Refresh items in case Kyma created one
        } catch (err) {
          console.error(err);
        }
      }, 1200);
    } catch (err) {
      console.error(err);
    }
  };

  const generateResponse = async (text: string, ctx: KymaItem | null): Promise<string> => {
    const txt = text.toLowerCase();
    
    // Command simulations (organic capture)
    if (txt.includes('crear nota') || txt.includes('nueva nota') || txt.includes('apunta nota')) {
      const content = text.replace(/crear nota|nueva nota|apunta nota/gi, '').trim();
      const title = content.split(/[.!?]/)[0] || 'Idea capturada';
      await dbClient.createItem({
        doorId: 'notas',
        title: title.length > 25 ? title.substring(0, 25) + '...' : title,
        content: content || 'Contenido de la nota capturado desde el chat.',
        tags: ['#notas', '#chat'],
        peso: 2
      });
      return `Entendido. He capturado tu pensamiento y lo he guardado como una Nota en tu panel. ¿Quieres que indaguemos más en esa idea?`;
    }

    if (txt.includes('crear tarea') || txt.includes('nueva tarea') || txt.includes('apunta tarea') || txt.startsWith('tarea:')) {
      const content = text.replace(/crear tarea|nueva tarea|apunta tarea|tarea:/gi, '').trim();
      await dbClient.createItem({
        doorId: 'tareas',
        title: content || 'Tarea desde el chat',
        content: 'Creada automáticamente por Kyma durante nuestra conversación.',
        tags: ['#tareas', '#chat'],
        peso: 1,
        completed: false
      });
      return `Listo, he añadido la tarea "${content}" a tu lista de pendientes en Tareas.`;
    }

    // Context-dependent replies
    if (ctx) {
      if (ctx.doorId === 'tareas') {
        return `Me parece lúcido cómo lo enfocas. A veces, simplemente dar el primer paso quita la fricción del deber. ¿Quieres que mantengamos esta tarea destacada o la dejamos en prioridad normal?`;
      }
      return `Comprendo. Es interesante cómo las piezas de tu mapa van encajando a medida que conversamos. Lo tendré presente para sugerirte conexiones más adelante.`;
    }

    // Basic conversational triggers
    if (txt.includes('hola') || txt.includes('buenas')) {
      return `¡Hola! Qué bueno encontrarnos de nuevo por aquí. Estaba ordenando algunas ideas de tus notas. ¿De qué te apetece conversar hoy?`;
    }
    if (txt.includes('gracias') || txt.includes('genial')) {
      return `Un placer. Acompañarte en este proceso de autodescubrimiento es mi propósito. ¿Hay algo más que quieras explorar en tu panel?`;
    }
    if (txt.includes('marta')) {
      return `Marta ocupa un espacio central en tu red afectiva. En tus notas anteriores percibo que pasar tiempo de calidad juntos te aporta mucha calma. ¿Cómo ha ido vuestro último encuentro?`;
    }
    if (txt.includes('la llegada') || txt.includes('película')) {
      return `La ciencia ficción existencial como "La Llegada" abre preguntas preciosas sobre el determinismo. ¿Te atrae la idea de que todo esté escrito, o prefieres el caos creativo del libre albedrío?`;
    }

    // Default socratic conversational reply
    return `Observo lo que compartes. Si lo miramos como un espejo de lo que valoras hoy... ¿sientes que esto te acerca más a tu centro, o te aleja de él? Dime más, me interesa escucharte.`;
  };

  return (
    <div className="chat-container glass-panel">
      <button 
        type="button"
        className="clear-chat-floating-btn" 
        onClick={handleClearChat}
        title="Limpiar conversación"
      >
        <Trash2 size={16} />
      </button>

      {/* Messages area */}
      <div className="messages-area">
        {messages.map((msg) => (
          <div key={msg.id} className={`message-wrapper ${msg.sender === 'user' ? 'wrapper-user' : 'wrapper-kyma'}`}>
            <div className={`message-bubble ${msg.sender === 'user' ? 'bubble-user' : 'bubble-kyma'}`}>
              {msg.contextItem && (
                <div className="bubble-context-ref">
                  <Sparkles size={10} />
                  <span>Sobre: {msg.contextItem.title}</span>
                </div>
              )}
              <p className="message-text">{msg.text}</p>
              <span className="message-time">
                {new Date(msg.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="message-wrapper wrapper-kyma">
            <div className="message-bubble bubble-kyma typing-bubble">
              <div className="typing-dots">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Context indicator */}
      {contextItem && (
        <div className="chat-context-bar animate-fade-in">
          <div className="context-info">
            <Sparkles size={12} className="text-purple animate-pulse" />
            <span>Hablando de: <strong>{contextItem.title}</strong> ({contextItem.doorId})</span>
          </div>
          <button className="clear-context-btn" onClick={onClearContext}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSend} className="chat-input-form">
        <div className="input-wrapper" style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            className="input-field chat-input"
            style={{ paddingRight: '44px', width: '100%' }}
            placeholder={contextItem ? "Responde a Kyma..." : "Háblale a Kyma, o captura una nota/tarea..."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <button 
            type="button"
            className={`mic-btn ${isListening ? 'listening' : ''}`}
            onClick={toggleListening}
            title={isListening ? "Detener grabación (transcribiendo...)" : "Grabar audio / Transcribir"}
            style={{
              position: 'absolute',
              right: '12px',
              background: 'none',
              border: 'none',
              color: isListening ? '#ef4444' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              zIndex: 10
            }}
          >
            <Mic size={16} />
          </button>
        </div>
        <button type="submit" className="btn btn-primary send-btn" aria-label="Enviar">
          <Send size={16} />
        </button>
      </form>

      <div className="input-tips">
        <span>Consejo: escribe "crear nota [texto]" para capturar al vuelo.</span>
      </div>

      <style jsx>{`
        .chat-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          border-radius: var(--border-radius-lg);
          overflow: hidden;
          border-color: var(--border-subtle);
          position: relative;
        }

        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-subtle);
          background: rgba(20, 20, 23, 0.4);
        }
        .header-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .header-title h2 {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        
        .clear-chat-floating-btn {
          position: absolute;
          top: 16px;
          right: 20px;
          z-index: 30;
          background: rgba(20, 20, 23, 0.6);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          transition: all 0.2s ease;
          box-shadow: var(--shadow-sm);
        }
        .clear-chat-floating-btn:hover {
          color: var(--danger);
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.25);
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.15);
        }

        /* Messages area */
        .messages-area {
          flex: 1;
          overflow-y: auto;
          padding: 52px 20px 20px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: rgba(8, 8, 10, 0.2);
        }

        .message-wrapper {
          display: flex;
          gap: 10px;
          max-width: 85%;
        }
        .wrapper-user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }
        .wrapper-kyma {
          align-self: flex-start;
        }

        /* Avatars removed to keep it cleaner */

        .message-bubble {
          padding: 12px 16px;
          border-radius: var(--border-radius-md);
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .bubble-user {
          background: var(--accent-gradient);
          color: #fff;
          border-bottom-right-radius: 2px;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);
        }
        .bubble-kyma {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: 1px solid var(--border-subtle);
          border-bottom-left-radius: 2px;
        }

        .bubble-context-ref {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.72rem;
          color: rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.12);
          padding: 2px 6px;
          border-radius: 4px;
          width: fit-content;
        }
        .bubble-kyma .bubble-context-ref {
          color: var(--accent-purple);
          background: rgba(139, 92, 246, 0.08);
        }

        .message-text {
          font-size: 0.9rem;
          line-height: 1.5;
          word-break: break-word;
        }
        .message-time {
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.6);
          align-self: flex-end;
        }
        .bubble-kyma .message-time {
          color: var(--text-muted);
        }

        /* Typing animations */
        .typing-bubble {
          padding: 12px 18px;
        }
        .typing-dots {
          display: flex;
          gap: 4px;
          align-items: center;
          height: 16px;
        }
        .typing-dots .dot {
          width: 5px;
          height: 5px;
          background: var(--text-secondary);
          border-radius: 50%;
          animation: dotBounce 1.4s infinite ease-in-out both;
        }
        .typing-dots .dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dots .dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes dotBounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        /* Context bar */
        .chat-context-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
          background: rgba(139, 92, 246, 0.08);
          border-top: 1px solid rgba(139, 92, 246, 0.15);
          border-bottom: 1px solid rgba(139, 92, 246, 0.15);
          font-size: 0.8rem;
        }
        .context-info {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-primary);
        }
        .clear-context-btn {
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2px;
          border-radius: 50%;
        }
        .clear-context-btn:hover {
          color: var(--text-primary);
          background: rgba(252, 252, 253, 0.1);
        }

        /* Input field */
        .chat-input-form {
          display: flex;
          gap: 10px;
          padding: 14px 20px;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border-subtle);
        }
        .chat-input {
          flex: 1;
        }
        .send-btn {
          flex-shrink: 0;
          width: 42px;
          height: 42px;
          border-radius: var(--border-radius-md);
          padding: 0;
        }
        .mic-btn:hover {
          color: var(--accent-purple) !important;
          background: rgba(139, 92, 246, 0.1);
        }
        .mic-btn.listening {
          background: rgba(239, 68, 68, 0.15) !important;
          animation: micPulse 1.5s infinite ease-in-out;
        }
        @keyframes micPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { transform: scale(1.15); box-shadow: 0 0 10px 4px rgba(239, 68, 68, 0.2); }
        }

        .input-tips {
          font-size: 0.72rem;
          color: var(--text-muted);
          text-align: center;
          padding-bottom: 12px;
          background: var(--bg-secondary);
        }

        .text-purple { color: var(--accent-purple); }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
      `}</style>
    </div>
  );
}
