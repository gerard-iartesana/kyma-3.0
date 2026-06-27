export interface DoorModule {
  id: string;
  title: string;
  icon: string; // Lucide icon name
  category: 'utility' | 'map';
  description: string;
  emptyPromise: string; // The text shown in velada/empty state to communicate potential
}

export const DOOR_MODULES: DoorModule[] = [
  {
    id: 'agenda',
    title: 'Agenda',
    icon: 'Calendar',
    category: 'utility',
    description: 'Calendario y eventos. Kyma contextualiza lo que ocurre en tu vida.',
    emptyPromise: 'Tu agenda está despejada. Háblale a Kyma de tus próximos planes o reuniones para ver cómo se organizan solos aquí.'
  },
  {
    id: 'tareas',
    title: 'Tareas',
    icon: 'CheckSquare',
    category: 'utility',
    description: 'To-dos, recordatorios y listas. Detecta patrones sin juzgar.',
    emptyPromise: 'No hay tareas pendientes. ¿Qué tienes en mente para hoy? Cuéntaselo a Kyma en el chat para añadirlo.'
  },
  {
    id: 'notas',
    title: 'Notas',
    icon: 'FileText',
    category: 'utility',
    description: 'Capturas rápidas e ideas sueltas. La materia prima de tu mapa.',
    emptyPromise: 'Ninguna nota guardada. Vuelca tus pensamientos sueltos hablando con Kyma; ella los guardará de forma limpia.'
  },
  {
    id: 'intereses',
    title: 'Intereses',
    icon: 'Compass',
    category: 'map',
    description: 'Mapa de pasiones: lo que te atrae y cómo lo experimentas.',
    emptyPromise: 'Esta puerta está velada. A medida que compartas tus libros, películas, pasiones y hobbies en el chat con Kyma, tu mapa de intereses se irá dibujando aquí con sus conexiones y pesos.'
  },
  {
    id: 'personas',
    title: 'Vínculos',
    icon: 'Users',
    category: 'map',
    description: 'Memoria afectiva de quién te importa y la frecuencia de contacto.',
    emptyPromise: 'Esta puerta está velada. Cuéntale a Kyma sobre tus conversaciones con amigos, familiares y conocidos. Aquí verás emerger tu red afectiva organizada por órbitas concéntricas y cercanías.'
  },
  {
    id: 'reflexiones',
    title: 'Reflexiones',
    icon: 'Lightbulb',
    category: 'map',
    description: 'Diario interior y conversaciones socráticas profundas.',
    emptyPromise: 'Esta puerta está velada. Cuando converses con Kyma en modo espejo para examinar una idea, tus aprendizajes e introspecciones se guardarán en este lienzo de autodescubrimiento.'
  },
  {
    id: 'estela',
    title: 'Estela de vida',
    icon: 'Activity',
    category: 'map',
    description: 'Línea de tiempo de hitos históricos, recuerdos y momentos que han marcado tu vida.',
    emptyPromise: 'Esta puerta está velada. Cuéntale a Kyma tus recuerdos más significativos, viajes o momentos del pasado para construir gradualmente tu línea de tiempo vital aquí.'
  }
];
