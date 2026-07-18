import React, { useState } from 'react';
import { Sparkles, MessageSquare, Mic, LayoutGrid, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';
import { LogoIcon } from './Logo';

interface OnboardingModalProps {
  onClose: () => void;
}

export function OnboardingModal({ onClose }: OnboardingModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: 'Bienvenido a Kyma',
      subtitle: 'Tu espacio para conversar, recordar y ordenar tu vida',
      text: 'Kyma te ayuda a construir un diario reflexivo conectando tus recuerdos, relaciones, gustos, ideas y planes del día a día.',
      icon: (
        <div style={{ position: 'relative', width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
          <div style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0) 70%)',
            animation: 'pulse 3s infinite alternate'
          }} />
          <LogoIcon size={88} className="text-purple animate-float" style={{ zIndex: 2 }} />
        </div>
      )
    },
    {
      title: 'Habla con Kyma',
      subtitle: 'Una conversación libre y natural',
      text: 'Comparte tus vivencias por texto o voz. Kyma conversa contigo, detecta lo importante y te ayuda a registrar lo que quieres recordar.',
      icon: (
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', alignItems: 'center', margin: '0 auto 28px auto', height: '130px' }}>
          <div style={{
            width: '76px',
            height: '76px',
            borderRadius: '20px',
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-purple)',
            boxShadow: '0 8px 24px rgba(139, 92, 246, 0.15)',
          }}>
            <MessageSquare size={36} />
          </div>
          <div style={{
            width: '76px',
            height: '76px',
            borderRadius: '20px',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8',
            boxShadow: '0 8px 24px rgba(56, 189, 248, 0.15)',
          }}>
            <Mic size={36} />
          </div>
        </div>
      )
    },
    {
      title: 'Todo encuentra su lugar',
      subtitle: 'Tu vida se organiza en puertas',
      text: 'Agenda, tareas, notas, intereses, vínculos, reflexiones y estela de vida. Kyma clasifica lo que cuentas para que puedas volver a ello cuando lo necesites.',
      icon: (
        <div style={{
          width: '110px',
          height: '110px',
          borderRadius: '28px',
          background: 'rgba(139, 92, 246, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 28px auto',
          color: 'var(--accent-purple)'
        }}>
          <LayoutGrid size={52} />
        </div>
      )
    },
    {
      title: 'Tú decides qué se guarda',
      subtitle: 'Kyma sugiere, tú tienes el control',
      text: 'Al empezar, cada tarjeta queda como borrador para que puedas confirmarla, editarla o descartarla. Más adelante podrás activar el modo fluido si Kyma gana tu confianza.',
      icon: (
        <div style={{
          width: '110px',
          height: '110px',
          borderRadius: '50%',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 28px auto',
          color: '#10b981',
          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.1)'
        }}>
          <ShieldCheck size={56} />
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
        maxWidth: '580px',
        background: 'rgba(15, 15, 20, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '28px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 40px 40px 40px',
        overflow: 'hidden',
        textAlign: 'center'
      }}>
        {/* Saltar button */}
        {currentSlide < slides.length - 1 && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '24px',
              right: '28px',
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
            Saltar por ahora
          </button>
        )}

        {/* Slide Icon */}
        <div className="animate-fade-in" key={`icon-${currentSlide}`}>
          {slides[currentSlide].icon}
        </div>

        {/* Slide Content */}
        <div style={{ minHeight: '170px', width: '100%', margin: '12px 0 28px 0' }} className="animate-fade-in" key={`content-${currentSlide}`}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px', fontFamily: 'var(--font-serif)' }}>
            {slides[currentSlide].title}
          </h2>
          <h4 style={{ fontSize: '0.96rem', fontWeight: 600, color: 'var(--accent-purple)', marginBottom: '18px', lineHeight: 1.4 }}>
            {slides[currentSlide].subtitle}
          </h4>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>
            {slides[currentSlide].text}
          </p>
        </div>

        {/* Indicator dots */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '36px' }}>
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
              style={{ padding: '10px 20px', fontSize: '0.84rem', gap: '6px' }}
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
            style={{ padding: '12px 24px', fontSize: '0.88rem', gap: '8px', minWidth: '130px', justifyContent: 'center' }}
          >
            {currentSlide === slides.length - 1 ? (
              <>
                <Sparkles size={16} />
                <span>Empezar conversando</span>
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
