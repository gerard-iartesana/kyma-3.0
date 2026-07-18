import React, { useState } from 'react';
import { Sparkles, MessageSquare, Mic, LayoutGrid, ShieldCheck, ArrowRight, ArrowLeft, X } from 'lucide-react';
import { LogoIcon } from './Logo';

interface OnboardingModalProps {
  onClose: () => void;
}

export function OnboardingModal({ onClose }: OnboardingModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: 'Bienvenido a Kyma',
      subtitle: 'Tu espacio personal de autoconocimiento lento',
      text: 'Kyma te ayuda a construir un diario reflexivo, conectando tus recuerdos, relaciones, gustos e ideas del día a día para dibujar tu propio mapa interior.',
      icon: (
        <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
          <div style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0) 70%)',
            animation: 'pulse 3s infinite alternate'
          }} />
          <LogoIcon size={80} className="text-purple animate-float" style={{ zIndex: 2 }} />
        </div>
      )
    },
    {
      title: 'Habla con Kyma',
      subtitle: 'Una conversación libre y natural',
      text: 'Comparte tus vivencias mediante notas escritas o de voz. Kyma te escuchará, reflexionará contigo con el tono de un amigo inteligente y te ayudará a registrar lo que valoras.',
      icon: (
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', alignItems: 'center', margin: '0 auto 24px auto', height: '120px' }}>
          <div style={{
            width: '70px',
            height: '70px',
            borderRadius: '18px',
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-purple)',
            boxShadow: '0 8px 20px rgba(139, 92, 246, 0.15)',
          }}>
            <MessageSquare size={32} />
          </div>
          <div style={{
            width: '70px',
            height: '70px',
            borderRadius: '18px',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8',
            boxShadow: '0 8px 20px rgba(56, 189, 248, 0.15)',
          }}>
            <Mic size={32} />
          </div>
        </div>
      )
    },
    {
      title: 'Todo se organiza en puertas',
      subtitle: 'Diferentes dimensiones de tu vida',
      text: 'Tu información se clasifica de forma automática en puertas dedicadas para que puedas explorar tu agenda, tus metas activas y tu constelación personal de vínculos y pasiones.',
      icon: (
        <div style={{
          width: '100px',
          height: '100px',
          borderRadius: '24px',
          background: 'rgba(139, 92, 246, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px auto',
          color: 'var(--accent-purple)'
        }}>
          <LayoutGrid size={48} />
        </div>
      )
    },
    {
      title: 'Tú decides qué se guarda',
      subtitle: 'El sistema sugiere, tú tienes el control',
      text: 'Kyma nunca añadirá nada a tu mapa sin tu aprobación explícita. Cada tarjeta sugerida queda en estado borrador esperando tu validación o descarte sin costes.',
      icon: (
        <div style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px auto',
          color: '#10b981',
          boxShadow: '0 8px 20px rgba(16, 185, 129, 0.1)'
        }}>
          <ShieldCheck size={52} />
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.55)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3000,
      padding: '16px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        background: 'rgba(15, 15, 20, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '36px 32px 32px 32px',
        overflow: 'hidden',
        textAlign: 'center'
      }}>
        {/* Saltar button */}
        {currentSlide < slides.length - 1 && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '20px',
              right: '24px',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.82rem',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'color 0.15s ease',
              outline: 'none'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            Saltar
          </button>
        )}

        {/* Slide Icon */}
        <div className="animate-fade-in" key={`icon-${currentSlide}`}>
          {slides[currentSlide].icon}
        </div>

        {/* Slide Content */}
        <div style={{ minHeight: '160px', width: '100%', margin: '8px 0 24px 0' }} className="animate-fade-in" key={`content-${currentSlide}`}>
          <h2 style={{ fontSize: '1.7rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px', fontFamily: 'var(--font-serif)' }}>
            {slides[currentSlide].title}
          </h2>
          <h4 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--accent-purple)', marginBottom: '16px' }}>
            {slides[currentSlide].subtitle}
          </h4>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            {slides[currentSlide].text}
          </p>
        </div>

        {/* Indicator dots */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              style={{
                width: currentSlide === idx ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: currentSlide === idx ? 'var(--accent-purple)' : 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                padding: 0,
                outline: 'none'
              }}
            />
          ))}
        </div>

        {/* Footer Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          {currentSlide > 0 ? (
            <button
              onClick={handlePrev}
              className="btn btn-secondary"
              style={{ padding: '8px 16px', fontSize: '0.82rem', gap: '6px' }}
            >
              <ArrowLeft size={14} />
              <span>Atrás</span>
            </button>
          ) : (
            <div style={{ width: '80px' }} />
          )}

          <button
            onClick={handleNext}
            className="btn btn-primary"
            style={{ padding: '10px 22px', fontSize: '0.86rem', gap: '8px', minWidth: '110px', justifyContent: 'center' }}
          >
            {currentSlide === slides.length - 1 ? (
              <>
                <Sparkles size={16} />
                <span>Comenzar</span>
              </>
            ) : (
              <>
                <span>Siguiente</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
