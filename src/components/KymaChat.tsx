import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, dbClient, KymaItem } from '../lib/db/client';
import { supabase } from '../lib/supabase';
import { Send, X, Sparkles, PlusCircle, Trash2, Mic, Plus, Paperclip } from 'lucide-react';
import { LogoIcon } from './Logo';

interface KymaChatProps {
  contextItem: KymaItem | null;
  onClearContext: () => void;
  onItemAddedOrModified: (item?: KymaItem, action?: string) => void;
  onUserProfileUpdated?: (updatedProfile: any) => void;
  onMessageSent?: () => void;
}

function renderFormattedText(text: string) {
  if (!text) return null;
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;
  const splitText = text.split(regex);

  return splitText.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={index} style={{ color: 'var(--text-primary, #f8fafc)', fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if ((part.startsWith('*') && part.endsWith('*') && part.length > 2) || (part.startsWith('_') && part.endsWith('_') && part.length > 2)) {
      return (
        <em key={index} style={{ fontStyle: 'italic', color: '#c084fc', fontWeight: 500 }}>
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

function TypewriterMessage({ text, isLatest, onCharacterTyped }: { text: string; isLatest: boolean; onCharacterTyped?: () => void }) {
  const [displayedText, setDisplayedText] = useState(isLatest ? '' : text);

  useEffect(() => {
    if (!isLatest) {
      setDisplayedText(text);
      return;
    }

    setDisplayedText('');
    let index = 0;
    const speed = 16; // Smooth natural typing speed in ms per character

    const interval = setInterval(() => {
      index++;
      setDisplayedText(text.slice(0, index));
      if (onCharacterTyped) onCharacterTyped();
      if (index >= text.length) {
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, isLatest]);

  const isStillTyping = isLatest && displayedText.length < text.length;

  return (
    <p className="message-text">
      {renderFormattedText(displayedText)}
      {isStillTyping && <span className="typing-cursor" />}
    </p>
  );
}

export function KymaChat({ contextItem, onClearContext, onItemAddedOrModified, onUserProfileUpdated, onMessageSent }: KymaChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef<string>('');
  const accumulatedSpeechRef = useRef<string>('');
  const isListeningRef = useRef<boolean>(false);

  const [attachedFile, setAttachedFile] = useState<{ name: string; type: string; content?: string; previewUrl?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachedFile({
          name: file.name,
          type: file.type,
          previewUrl: event.target?.result as string,
          content: `[Imagen adjunta: ${file.name}]`
        });
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachedFile({
          name: file.name,
          type: file.type,
          content: event.target?.result as string
        });
      };
      reader.readAsText(file);
    }
    if (e.target) e.target.value = '';
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        const rec = new SpeechRecognitionAPI();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = 'es-ES';

        rec.onresult = (event: any) => {
          let finalChunk = '';
          let interimChunk = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const res = event.results[i];
            if (res.isFinal) {
              finalChunk += res[0].transcript;
            } else {
              interimChunk += res[0].transcript;
            }
          }

          if (finalChunk) {
            const cleanFinal = finalChunk.trim();
            if (cleanFinal && !accumulatedSpeechRef.current.endsWith(cleanFinal)) {
              accumulatedSpeechRef.current = (accumulatedSpeechRef.current + ' ' + cleanFinal).trim();
            }
          }

          const currentSpeech = (accumulatedSpeechRef.current + (interimChunk ? ' ' + interimChunk.trim() : '')).trim();
          const base = baseTextRef.current || '';
          const separator = base && currentSpeech && !base.endsWith(' ') ? ' ' : '';
          setInputText(base + separator + currentSpeech);
        };

        rec.onerror = (e: any) => {
          console.error('Speech recognition error', e);
          if (e.error !== 'no-speech') {
            isListeningRef.current = false;
            setIsListening(false);
          }
        };

        rec.onend = () => {
          if (isListeningRef.current) {
            try {
              rec.start();
            } catch (err) {
              isListeningRef.current = false;
              setIsListening(false);
            }
          } else {
            setIsListening(false);
          }
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

    if (isListeningRef.current) {
      isListeningRef.current = false;
      setIsListening(false);
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    } else {
      baseTextRef.current = inputText;
      accumulatedSpeechRef.current = '';
      isListeningRef.current = true;
      setIsListening(true);
      try {
        recognitionRef.current.start();
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
          setMessages(prev => [...prev, { ...newMsg, isNew: true }]);
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
    if (!inputText.trim() && !attachedFile) return;

    if (isListeningRef.current) {
      isListeningRef.current = false;
      setIsListening(false);
      try { recognitionRef.current?.stop(); } catch (err) {}
    }

    let userText = inputText.trim();
    if (attachedFile) {
      if (attachedFile.previewUrl) {
        userText += (userText ? '\n\n' : '') + `[Adjunto imagen/ticket "${attachedFile.name}": Analiza los datos o texto de esta nota/ticket]`;
      } else if (attachedFile.content) {
        userText += (userText ? '\n\n' : '') + `[Contenido del archivo adjunto "${attachedFile.name}":\n${attachedFile.content.slice(0, 4000)}]`;
      }
      setAttachedFile(null);
    }

    setInputText('');
    accumulatedSpeechRef.current = '';
    if (onMessageSent) onMessageSent();

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
        try {
          let kymaText = '';
          
          try {
            const allMsgs = await dbClient.getMessages();
            const sessionRes = await supabase.auth.getSession();
            const session = sessionRes.data.session;
            const userId = session?.user?.id;
            const accessToken = session?.access_token;
            
            let userProfile = undefined;
            if (typeof window !== 'undefined') {
              const savedProf = localStorage.getItem('kyma_user_profile');
              if (savedProf) {
                try { userProfile = JSON.parse(savedProf); } catch (e) {}
              }
            }

            const response = await fetch('/api/chat', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
              },
              body: JSON.stringify({ messages: allMsgs, userId, accessToken, userProfile })
            });
            
            if (response.ok) {
              const data = await response.json();
              kymaText = data.text;
              if (data.updatedProfile) {
                if (typeof window !== 'undefined') {
                  localStorage.setItem('kyma_user_profile', JSON.stringify(data.updatedProfile));
                  window.dispatchEvent(new CustomEvent('kyma_user_profile_updated', { detail: data.updatedProfile }));
                }
                if (onUserProfileUpdated) {
                  onUserProfileUpdated(data.updatedProfile);
                }
              }
              if (data.createdItem || data.action === 'create' || data.action === 'enrich' || data.action === 'delete') {
                onItemAddedOrModified(data.createdItem, data.action);
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

          setIsTyping(false);
          const kymaMsg = await dbClient.receiveKymaMessage(kymaText);
          setMessages(prev => [...prev, { ...kymaMsg, isNew: true }]);
        } catch (err) {
          setIsTyping(false);
          console.error(err);
        }
      }, 800);
    } catch (err) {
      setIsTyping(false);
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
    <div className="chat-container">
      <button 
        type="button"
        className="clear-chat-floating-btn" 
        onClick={handleClearChat}
        title="Limpiar conversación"
      >
        <Trash2 size={18} />
      </button>

      {/* Messages area */}
      <div className="messages-area">
        {messages.map((msg, idx) => {
          const isLatestKyma = msg.sender === 'kyma' && idx === messages.length - 1 && Boolean((msg as any).isNew);
          return (
            <div key={msg.id} className={`message-wrapper ${msg.sender === 'user' ? 'wrapper-user' : 'wrapper-kyma'}`}>
              <div className={`message-bubble ${msg.sender === 'user' ? 'bubble-user' : 'bubble-kyma'}`}>
                {msg.contextItem && (
                  <div className="bubble-context-ref">
                    <Sparkles size={11} />
                    <span>Sobre: {msg.contextItem.title}</span>
                  </div>
                )}
                {msg.sender === 'kyma' ? (
                  <TypewriterMessage 
                    text={msg.text} 
                    isLatest={isLatestKyma} 
                    onCharacterTyped={() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })} 
                  />
                ) : (
                  <p className="message-text">{renderFormattedText(msg.text)}</p>
                )}
                <span className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        
        {isTyping && (
          <div className="message-wrapper wrapper-kyma animate-fade-in" style={{ padding: '4px 8px', margin: '4px 0' }}>
            <div className="thinking-content-clean" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary, #94a3b8)', fontSize: '0.86rem', fontWeight: 500 }}>
              <div className="minimal-chat-spinner" />
              <span>Pensando...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Context indicator */}
      {contextItem && (
        <div className="chat-context-bar animate-fade-in">
          <div className="context-info">
            <Sparkles size={14} className="text-purple animate-pulse" />
            <span>Hablando de: <strong>{contextItem.title}</strong> ({contextItem.doorId})</span>
          </div>
          <button className="clear-context-btn" onClick={onClearContext}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Attached file preview chip */}
      {attachedFile && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          background: 'rgba(236, 72, 153, 0.12)',
          border: '1px solid rgba(236, 72, 153, 0.3)',
          borderRadius: '8px',
          margin: '0 16px 8px 16px',
          fontSize: '0.8rem',
          color: '#f472b6'
        }}>
          <Paperclip size={14} />
          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
            {attachedFile.name}
          </span>
          <button 
            type="button" 
            onClick={() => setAttachedFile(null)}
            style={{ background: 'none', border: 'none', color: '#f472b6', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSend} className="chat-input-form">
        <input 
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/*,.txt,.md,.pdf,.json"
          onChange={handleFileSelect}
        />
        <div className="input-wrapper" style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            className="attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Adjuntar archivo o imagen (txt, md, ticket...)"
            style={{
              position: 'absolute',
              left: '12px',
              background: 'none',
              border: 'none',
              color: attachedFile ? '#ec4899' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              borderRadius: '50%',
              transition: 'all 0.2s ease',
              zIndex: 2
            }}
          >
            <Plus size={22} />
          </button>
          <input
            type="text"
            className="input-field chat-input"
            placeholder="Escribir aquí..."
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
              color: isListening ? '#ef4444' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              borderRadius: '50%',
              transition: 'all 0.2s ease',
              zIndex: 2
            }}
          >
            <Mic size={22} className="mic-icon-svg" />
          </button>
        </div>

        <button type="submit" className="btn btn-primary send-btn" disabled={!inputText.trim() && !attachedFile}>
          <Send size={20} />
        </button>
      </form>

      {/* STYLES */}
      <style jsx global>{`
        .chat-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          border-radius: 0;
          overflow: hidden;
          position: relative;
          background: transparent;
          border: none;
        }

        .clear-chat-floating-btn {
          position: absolute;
          top: 6px;
          right: 6px;
          z-index: 30;
          background: rgba(24, 24, 27, 0.85);
          border: 1px solid var(--border-subtle);
          color: var(--text-muted);
          padding: 8px;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(8px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .clear-chat-floating-btn:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.4);
        }

        /* Mobile Web Browser Mode */
        @media (max-width: 1024px) {
          .clear-chat-floating-btn {
            top: calc(120px + env(safe-area-inset-top, 0px)) !important;
            right: 16px !important;
            width: 40px !important;
            height: 40px !important;
            padding: 0 !important;
            background: rgba(24, 24, 27, 0.92) !important;
            border: 1px solid var(--border-subtle) !important;
            color: var(--text-muted) !important;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4) !important;
            z-index: 50 !important;
          }
          .clear-chat-floating-btn:hover {
            color: #ef4444 !important;
            background: rgba(239, 68, 68, 0.2) !important;
          }
          .messages-area {
            padding-top: calc(176px + env(safe-area-inset-top, 0px)) !important;
            padding-bottom: 24px !important;
            -ms-overflow-style: none !important;
            scrollbar-width: none !important;
          }
          .messages-area::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
        }

        /* Installed PWA Standalone Mode (UNTOUCHED as requested) */
        @media all and (display-mode: standalone) and (max-width: 1024px) {
          .clear-chat-floating-btn {
            top: calc(76px + env(safe-area-inset-top, 0px)) !important;
          }
          .messages-area {
            padding-top: calc(128px + env(safe-area-inset-top, 0px)) !important;
          }
        }

        .messages-area {
          flex: 1;
          overflow-y: auto;
          padding: 36px 4px 20px 4px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          -webkit-overflow-scrolling: touch;
        }

        .message-wrapper {
          display: flex;
          width: 100%;
        }
        .wrapper-user {
          justify-content: flex-end;
        }
        .wrapper-kyma {
          justify-content: flex-start;
        }

        .message-bubble {
          max-width: 85%;
          padding: 14px 18px;
          border-radius: 18px;
          position: relative;
          box-shadow: var(--shadow-sm);
        }
        .bubble-user {
          background: var(--bg-tertiary, #18181b);
          color: var(--text-primary, #f4f4f5);
          border: 1px solid var(--border-focus, #3f3f46);
          border-bottom-right-radius: 4px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .bubble-kyma {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.16) 0%, rgba(168, 85, 247, 0.1) 100%);
          color: #f8fafc;
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-bottom-left-radius: 4px;
          box-shadow: 0 4px 14px rgba(139, 92, 246, 0.1);
        }

        .bubble-context-ref {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.76rem;
          opacity: 0.85;
          margin-bottom: 6px;
          padding-bottom: 6px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.15);
        }

        .message-text {
          font-size: 0.95rem !important;
          line-height: 1.5 !important;
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
        }

        @media (max-width: 768px) {
          .message-text {
            font-size: 1.06rem !important;
            line-height: 1.5 !important;
          }
        }

        .typing-cursor {
          display: inline-block;
          width: 2px;
          height: 1.1em;
          background-color: var(--accent-purple, #a855f7);
          margin-left: 3px;
          vertical-align: middle;
          animation: blinkCursor 0.8s infinite;
        }

        @keyframes blinkCursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        .message-time {
          display: block;
          font-size: 0.68rem;
          opacity: 0.6;
          margin-top: 6px;
          text-align: right;
        }

        /* Thinking indicator styling */
        .minimal-chat-spinner {
          width: 15px;
          height: 15px;
          border: 2px solid rgba(255, 255, 255, 0.15);
          border-top-color: #ec4899;
          border-right-color: #a855f7;
          border-radius: 50%;
          animation: kymaSpin 0.75s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          flex-shrink: 0;
        }

        @keyframes kymaSpin {
          to { transform: rotate(360deg); }
        }

        @keyframes pulseText {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        /* Context Bar */
        .chat-context-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: rgba(139, 92, 246, 0.1);
          border-top: 1px solid rgba(139, 92, 246, 0.2);
          font-size: 0.82rem;
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
          padding: 16px 0 0 0;
          background: transparent;
          border-top: 1px solid var(--border-subtle);
        }
        .chat-input {
          flex: 1;
          padding-left: 48px;
          padding-right: 48px;
        }
        .send-btn {
          flex-shrink: 0;
          width: 42px;
          height: 42px;
          border-radius: var(--border-radius-md);
          padding: 0;
        }
        @media (max-width: 1024px) {
          .chat-input {
            height: 52px;
            font-size: 1.12rem;
          }
          .send-btn {
            width: 52px;
            height: 52px;
          }
        }
        .attach-btn:hover {
          color: #ec4899 !important;
          background: rgba(236, 72, 153, 0.1);
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
