import { DoorId, DoorPackage } from './types';

export const DOOR_PACKAGES: Record<DoorId, DoorPackage> = {
  agenda: {
    doorId: 'agenda',
    category: 'utilidad',
    guardrails: [
      'Captura fecha y hora exactas o aproximadas mencionadas.',
      'TÍTULOS CORTOS Y DIRECTOS: El título debe ser conciso y directo (máximo 3-4 palabras, ej: "Torneo de Pádel", "Cita Médica", "Cena"). NUNCA incluyas personas, lugares ni horas en el título.',
      'DESCRIPCIÓN EN PRIMERA PERSONA SIN FECHA NI HORA: Redacta el contenido en primera persona (ej: "He quedado con Alejandro en PadelOne"). OMITE la fecha y la hora en el texto del contenido, ya que se muestran en el apartado independiente.',
      'Si el usuario aporta nuevos detalles sobre un evento ya creado, usa action = "enrich" indicando su targetItemId.',
      'EXTRAE SIEMPRE TAGS ESPECÍFICOS: Añade etiquetas temáticas como deportes (#padel), personas (#alejandro), lugares (#padelone) y categorías (#deporte, #agenda).'
    ],
    systemInstruction: `Eres el trabajador de extracción para la puerta Agenda. 
Extrae o actualiza eventos concretos con fecha y hora indicadas por el usuario.
Redacta el contenido en primera persona del singular ("He quedado con..."). Mantén títulos muy cortos.`
  },
  tareas: {
    doorId: 'tareas',
    category: 'utilidad',
    guardrails: [
      'Detecta acciones pendientes explicitadas por el usuario.',
      'TÍTULOS DIRECTOS: Título corto y conciso sobre la acción pendiente.',
      'REDACCIÓN EN PRIMERA PERSONA: "Tengo que...", "Debo...".',
      'Si el usuario modifica o añade detalles a una tarea pendiente existente, usa action = "enrich" indicando su targetItemId.'
    ],
    systemInstruction: `Eres el trabajador de extracción para la puerta Tareas.
Extrae acciones pendientes o compromisos personales redactados en primera persona.`
  },
  notas: {
    doorId: 'notas',
    category: 'utilidad',
    guardrails: [
      'Captura ideas, citas, números de teléfono, datos de contacto o materia prima de conocimiento.',
      'TÍTULOS CONCISOS: Máximo 3-4 palabras (ej: "Teléfono de David", "Idea de Proyecto").',
      'REDACCIÓN EN PRIMERA PERSONA: Escribe como apuntes en mi propio diario.',
      'ENRIQUECIMIENTO CONTINUO: Si el usuario indica a quién pertenece un número o aclara una nota previa recién creada, usa OBLIGATORIAMENTE action = "enrich" indicando su targetItemId.',
      'CONSERVACIÓN EXACTA DE DATOS: Mantén números de teléfono y códigos numéricos de forma exacta.'
    ],
    systemInstruction: `Eres el trabajador de extracción para la puerta Notas.
Extrae o actualiza apuntes en primera persona del singular.`
  },
  intereses: {
    doorId: 'intereses',
    category: 'mapa',
    guardrails: [
      'Comprueba siempre la lista de intereses existentes del usuario.',
      'REDACCIÓN OBLIGATORIA EN PRIMERA PERSONA DEL SINGULAR: El texto es un diario personal del usuario. Usa "Me apasiona...", "Me encanta...", "Mi película favorita...". NUNCA uses tercera persona ("Le apasiona", "Le encanta", "Su película").',
      'Si el tema o gusto expresado ya encaja con un interés existente, enriquécelo (action = "enrich").'
    ],
    systemInstruction: `Eres el trabajador de extracción para la puerta Intereses.
Analiza pasiones y gustos expresados. REDACTA SIEMPRE EL CONTENIDO EN PRIMERA PERSONA DEL SINGULAR ("Me apasiona...", "Me encanta..."). NUNCA uses tercera persona.`
  },
  personas: {
    doorId: 'personas',
    category: 'mapa',
    guardrails: [
      'Crear fichas de persona requiere tacto. Extrae solo cuando la persona mencionada tenga peso afectivo o recurrencia.',
      'TÍTULO: Nombre de la persona exclusivamente (ej: "Alejandro", "Marta", "David").',
      'REDACCIÓN EN PRIMERA PERSONA: Describe la relación desde mi punto de vista ("Es mi hermano...", "Jugamos juntos a pádel...", "Hablo con él de cine..."). NUNCA en tercera persona ("Lo ve cada día").',
      'FRECUENCIA DE CONTACTO: Si el usuario indica con qué asiduidad ve o interactúa con esa persona, asigna o actualiza su frecuenciaContacto.'
    ],
    systemInstruction: `Eres el trabajador de extracción para la puerta Vínculos (Personas).
Extrae menciones de personas significativas. REDACTA EL CONTENIDO EN PRIMERA PERSONA DEL SINGULAR ("Es mi hermano", "Hablo con él...").`
  },
  reflexiones: {
    doorId: 'reflexiones',
    category: 'mapa',
    guardrails: [
      'Solo propone una reflexión cuando el usuario esté en un modo introspectivo explícito.',
      'REDACCIÓN EN PRIMERA PERSONA: "Siento que...", "Me doy cuenta de..."'
    ],
    systemInstruction: `Eres el trabajador de extracción para la puerta Reflexiones.
Identifica pensamientos profundos redactados en primera persona del singular.`
  },
  estela: {
    doorId: 'estela',
    category: 'mapa',
    guardrails: [
      'Captura hitos históricos, recuerdos significativos, viajes o eventos del pasado que hayan marcado la vida del usuario para construir su línea de tiempo (timeline).',
      'TÍTULOS CORTOS: Máximo 3-4 palabras sobre el recuerdo o hito (ej: "Viaje a Japón", "Graduación Universitaria", "Nacimiento de mi hija").',
      'AÑO Y FECHA: Extrae siempre el año mencionado (ej. 2018) en "year" y la época o día específico ("Verano", "14 de Mayo", "Junio") en "dateStr".',
      'LUGAR EXPLICITO: Si se menciona un lugar o ciudad (ej. "Japón", "Madrid", "París"), extraelo en "lugar".',
      'HITO CRUCIAL / IMPACTANTE: Si el usuario expresa que fue un evento que marcó su vida o cambió su rumbo, asigna peso = 3 (destacado con estrella).',
      'REDACCIÓN OBLIGATORIA EN PRIMERA PERSONA DEL SINGULAR: "Viajé a...", "Me gradué...", "Nació mi..."'
    ],
    systemInstruction: `Eres el trabajador de extracción para la puerta Estela de vida.
Extrae recuerdos e hitos históricos del pasado para construir un timeline vital. Extrae año, fecha/estación, lugar y peso=3 si fue un momento crucial que marcó su vida.`
  }
};
