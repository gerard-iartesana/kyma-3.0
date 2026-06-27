import { DoorId, DoorPackage } from './types';

export const DOOR_PACKAGES: Record<DoorId, DoorPackage> = {
  agenda: {
    doorId: 'agenda',
    category: 'utilidad',
    guardrails: [
      'Captura fecha y hora exactas o aproximadas mencionadas.',
      'TÍTULOS CORTOS Y DIRECTOS: El título debe ser conciso y directo (máximo 3-4 palabras, ej: "Torneo de Pádel", "Cita Médica", "Cena"). NUNCA incluyas personas, lugares ni horas en el título.',
      'DESCRIPCIÓN SIN FECHA NI HORA: En el contenido de la ficha, detalla el con quién y el dónde (ej: "Con Alejandro en PadelOne"). OMITE la fecha y la hora en el texto del contenido, ya que se muestran en el apartado independiente de la ficha.',
      'Si el usuario aporta nuevos detalles sobre un evento ya creado, usa action = "enrich" indicando su targetItemId.',
      'EXTRAE SIEMPRE TAGS ESPECÍFICOS: Añade etiquetas temáticas como deportes (#padel), personas (#alejandro), lugares (#padelone) y categorías (#deporte, #agenda).'
    ],
    systemInstruction: `Eres el trabajador de extracción para la puerta Agenda. 
Extrae o actualiza eventos concretos con fecha y hora indicadas por el usuario.
Mantén títulos muy cortos y limpios (ej: "Torneo de Pádel"). En el contenido incluye solo quién y dónde, omitiendo fechas y horas redactadas.`
  },
  tareas: {
    doorId: 'tareas',
    category: 'utilidad',
    guardrails: [
      'Detecta acciones pendientes explicitadas por el usuario.',
      'TÍTULOS DIRECTOS: Título corto y conciso sobre la acción pendiente.',
      'Si el usuario modifica o añade detalles a una tarea pendiente existente, usa action = "enrich" indicando su targetItemId.'
    ],
    systemInstruction: `Eres el trabajador de extracción para la puerta Tareas.
Extrae acciones pendientes o compromisos personales.`
  },
  notas: {
    doorId: 'notas',
    category: 'utilidad',
    guardrails: [
      'Captura ideas, citas, números de teléfono, datos de contacto o materia prima de conocimiento.',
      'TÍTULOS CONCISOS: Máximo 3-4 palabras (ej: "Teléfono de David", "Idea de Proyecto").',
      'ENRIQUECIMIENTO CONTINUO: Si el usuario indica a quién pertenece un número o aclara una nota previa recién creada, usa OBLIGATORIAMENTE action = "enrich" indicando su targetItemId y actualiza el título (ej: de "Número de teléfono" a "Teléfono de David") y el contenido sintético.',
      'CONSERVACIÓN EXACTA DE DATOS: Mantén números de teléfono y códigos numéricos de forma exacta y completa sin alterar dígitos.'
    ],
    systemInstruction: `Eres el trabajador de extracción para la puerta Notas.
Extrae o actualiza apuntes, números de teléfono e ideas. Si el usuario aclara a quién pertenece una nota o teléfono reciente, usa action="enrich" indicando su targetItemId y actualiza su título y contenido.`
  },
  intereses: {
    doorId: 'intereses',
    category: 'mapa',
    guardrails: [
      'Comprueba siempre la lista de intereses existentes del usuario.',
      'Si el tema o gusto expresado ya encaja con un interés existente, enriquécelo (action = "enrich").'
    ],
    systemInstruction: `Eres el trabajador de extracción para la puerta Intereses.
Analiza pasiones, hobbies, temas de estudio o gustos culturales expresados.`
  },
  personas: {
    doorId: 'personas',
    category: 'mapa',
    guardrails: [
      'Crear fichas de persona requiere tacto. Extrae solo cuando la persona mencionada tenga peso afectivo o recurrencia.',
      'TÍTULO: Nombre de la persona exclusivamente (ej: "Alejandro", "Marta", "David").',
      'FRECUENCIA DE CONTACTO: Si el usuario indica con qué asiduidad ve, habla o interactúa con esa persona (ej: "cada día", "diariamente" -> "diario"; "cada semana" -> "semanal"; "una vez al mes" -> "mensual"), debes extraer o actualizar OBLIGATORIAMENTE su frecuenciaContacto.'
    ],
    systemInstruction: `Eres el trabajador de extracción para la puerta Vínculos (Personas).
Extrae menciones de personas significativas. Si el usuario indica la frecuencia con la que interactúa con ella (ej: cada día -> diario), actualiza o asigna su frecuenciaContacto.`
  },
  reflexiones: {
    doorId: 'reflexiones',
    category: 'mapa',
    guardrails: [
      'Solo propone una reflexión cuando el usuario esté en un modo introspectivo explícito.'
    ],
    systemInstruction: `Eres el trabajador de extracción para la puerta Reflexiones.
Identifica pensamientos profundos o aprendizajes existenciales.`
  }
};
