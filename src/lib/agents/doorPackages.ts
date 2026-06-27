import { DoorId, DoorPackage } from './types';

export const DOOR_PACKAGES: Record<DoorId, DoorPackage> = {
  agenda: {
    doorId: 'agenda',
    category: 'utilidad',
    guardrails: [
      'Captura fecha y hora exactas o aproximadas mencionadas.',
      'Si la fecha es ambigua (ej. "el lunes" sin especificar), no inventes; captura lo que haya y formula una pregunta ligera si es indispensable.',
      'Nunca inventar hora si el usuario no la mencionó.'
    ],
    systemInstruction: `Eres el trabajador de extracción para la puerta Agenda. 
Extrae eventos concretos con fecha y hora indicadas por el usuario.
Asigna peso (1: normal, 2: destacado/social, 3: urgente/importante) y tags relevantes (ej. #agenda, #cita, #trabajo).`
  },
  tareas: {
    doorId: 'tareas',
    category: 'utilidad',
    guardrails: [
      'Detecta acciones pendientes explicitadas por el usuario.',
      'Evalúa la urgencia o importancia objetiva (peso 1-3) sin juzgar ni moralizar.'
    ],
    systemInstruction: `Eres el trabajador de extracción para la puerta Tareas.
Extrae acciones pendientes o compromisos personales.
Asigna peso (1: baja prioridad, 2: normal, 3: urgente/alta) y tags oportunos (ej. #tareas, #compra, #proyecto).`
  },
  notas: {
    doorId: 'notas',
    category: 'utilidad',
    guardrails: [
      'Captura ideas, citas, pensamientos breves o materia prima de conocimiento.',
      'Mantén la estructura al mínimo para preservar el tono crudo e intuitivo del usuario.'
    ],
    systemInstruction: `Eres el trabajador de extracción para la puerta Notas.
Extrae fragmentos de ideas, citas o apuntes informales.
Genera un título descriptivo breve y extrae tags temáticos (ej. #notas, #idea, #diseño).`
  },
  intereses: {
    doorId: 'intereses',
    category: 'mapa',
    guardrails: [
      'Comprueba siempre la lista de intereses existentes del usuario.',
      'Si el tema o gusto expresado ya encaja o se relaciona con un interés existente, enriquécelo (action = "enrich") agregando nuevos matices en lugar de crear un duplicado (action = "create").'
    ],
    systemInstruction: `Eres el trabajador de extracción para la puerta Intereses.
Analiza pasiones, hobbies, temas de estudio o gustos culturales expresados.
Si el usuario menciona una obra o aspecto de un interés que ya posee, debes indicar action="enrich" y proponer la actualización del contenido.
Si es un área completamente nueva, propone action="create".`
  },
  personas: {
    doorId: 'personas',
    category: 'mapa',
    guardrails: [
      'Crear fichas de persona requiere tacto. Extrae solo cuando la persona mencionada tenga peso afectivo o recurrencia.',
      'La cercanía ("nucleo", "cercana", "orbita") la determina el usuario. Asigna "orbita" por defecto si se crea una propuesta.'
    ],
    systemInstruction: `Eres el trabajador de extracción para la puerta Vínculos (Personas).
Extrae menciones de personas significativas con las que el usuario interactúa o reflexiona.
Genera un resumen del vínculo sin etiquetas clínicas ni juicios. Asigna cercania="orbita" por defecto.`
  },
  reflexiones: {
    doorId: 'reflexiones',
    category: 'mapa',
    guardrails: [
      'No extraigas de comentarios superficiales o de pasada.',
      'Solo propone una reflexión cuando el usuario esté en un modo introspectivo explícito sobre su vida, emociones o principios.'
    ],
    systemInstruction: `Eres el trabajador de extracción para la puerta Reflexiones.
Identifica pensamientos profundos, dilemas personales o aprendizajes existenciales expresados.
Sintetiza la reflexión en un título evocador y un resumen respetuoso.`
  }
};
