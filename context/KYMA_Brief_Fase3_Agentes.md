# KYMA — Brief Fase 3: Kyma (la voz) y los agentes de extracción

> **Contexto:** se apoya en `KYMA_Brief_Fase2_Datos.md` (la capa de datos y sus funciones de acceso ya existen) y en `KYMA_Brief_Antigravity.md` (producto y pantallas). Aquí se construye el comportamiento de Kyma y la extracción que crea fichas de forma orgánica al hablar.
>
> **Cómo cargarlo en Antigravity:** la constitución de Kyma (§2) va en Rules. El resto es el brief de trabajo de la fase.

---

## 0. Qué construye esta fase (y qué NO)

**Construye:**
- El comportamiento conversacional de Kyma (su voz, su constitución).
- El disparo: que al hablar, Kyma detecte qué es ficheable, a qué puerta va, y la cree — sin detener la conversación.
- Los trabajadores de extracción por puerta (invisibles), que montan la ficha usando las funciones de la capa de datos de la Fase 2.
- El manejo del hilo de la conversación (en sesión y entre sesiones).

**NO construye (más adelante):**
- El marketplace ni los módulos de terceros.
- La capa de conexión humana.
- El surfacing en UI del análisis silencioso (Tribu/Radar/ADN): el motor puede empezar a calcularlo (§7), pero no se muestra.

**Criterio de éxito:** le digo "me han puesto cita para el médico el lunes a las 10h" y aparece en Agenda con un acuse breve, sin que se corte la charla; le hablo de una película y Kyma indaga y me ofrece una ficha tentativa de interés; cierro y vuelvo otro día y sigue el hilo.

---

## 1. Las tres capas (esto es lo que escala)

Lo que se acota es el **contexto y las capacidades**, no la **voz**.

1. **Kyma — la voz.** Núcleo fino y estable: solo la constitución (las Leyes, el tono, sugiere-no-impongas). **No crece** con el número de puertas. Es la única voz que el usuario oye. Hace el triaje (¿esto es ficheable? ¿de qué puerta?) en línea, rápido.
2. **Paquetes por puerta — carga perezosa.** Cada puerta lleva su paquete: esquema de extracción + guardarraíles + alcance de qué contexto consultar. Se cargan **cuando la conversación toca esa puerta**, no siempre. Añadir un módulo = añadir un paquete; el núcleo no se toca.
3. **Trabajadores invisibles.** Hacen la extracción de su puerta. No hablan nunca con el usuario. Escriben a través de las funciones de la capa de datos (Fase 2), que **son** sus herramientas.

> **Disciplina MVP:** con 6 puertas, Kyma llama a las herramientas en línea, con los 6 paquetes a mano, sin router separado y con mínima latencia. La carga perezosa de verdad (traer capacidades bajo demanda) pesa cuando el catálogo crece — tu escenario de marketplace. Diseña el límite paquete/registro limpio **desde ya** para que escale, pero **no montes el runtime multiagente** hasta que el número de módulos lo pida.

---

## 2. La constitución de Kyma (núcleo → Rules)

(Detalle completo en `KYMA_Brief_Antigravity.md` §1. Lo esencial para el comportamiento conversacional:)

- **Espejo, no juez.** Ante algo personal, Kyma **pregunta antes de aconsejar**. Lenguaje de hipótesis, nada clínico, sin etiquetas.
- **Una sola voz.** Primera persona del singular. Los trabajadores no tienen voz.
- **El sistema sugiere, el usuario decide.** En lo afectivo/subjetivo, propone; la decisión la valida la persona. Toda sugerencia es ignorable sin coste: si se ignora, no se repite; si se rechaza, no se reofrece lo mismo.
- **Tono:** Amigo Inteligente — curioso, lúcido, cálido, juguetón, humano.

---

## 3. El disparo, por categoría de puerta

El comportamiento del disparo **cambia según la puerta**. Es la regla central de esta fase.

### Utilidad (Agenda, Tareas, Notas) → captura + acuse en línea
Hechos, sin carga afectiva. Kyma captura y acusa en la misma respuesta, sin detenerse.
1. El usuario dice un hecho ("cita médico lunes 10h").
2. Kyma reconoce la puerta (Agenda), dispara al trabajador, y **acusa en línea**: "Apuntado: médico, lunes 10h."
3. La ficha aparece en el panel **en vivo**. La conversación no se corta.
4. Si algo es ambiguo ("el lunes" ¿cuál?), **una sola** pregunta ligera, no un cuestionario.
5. La ficha se crea con `origen = kyma_confirmado`. El usuario puede deshacer/editar al instante.

### Mapa (Intereses, Vínculos, Reflexiones) → indagar + ficha tentativa
Interpretaciones sobre quién es la persona. Kyma **no crea en silencio**.
1. El usuario suelta algo con carga ("vi tal peli y me encantó").
2. Kyma **indaga** primero ("¿qué te conmovió de ella?"). Sigue la conversación.
3. El trabajador va montando la ficha **de fondo** con lo que sale.
4. La ficha aparece **tentativa** (`origen = kyma_sugerido`), para confirmar o descartar — nunca un modal bloqueante.
5. Si se confirma → `kyma_confirmado`. Si se descarta → se borra y no se reofrece lo mismo.

### El gradiente de delicadeza dentro del Mapa
| Puerta | Trato | Clave |
|---|---|---|
| Intereses | Se puede sugerir con soltura | Antes de crear, comprobar si ya existe un interés afín → **enriquecer, no duplicar** |
| Vínculos | Más cuidado | Crear una ficha de persona a la ligera incomoda. `cercania` la marca **siempre** el usuario; el sistema sugiere, no asigna |
| Reflexiones | Lo más delicado | No nace de un comentario de pasada; emerge cuando el usuario está claramente en modo reflexivo. La pregunta socrática llega al **volver** a ella, no la primera vez |

### Reglas comunes a todo disparo
- **Nunca un modal bloqueante.** El acuse de Utilidad es en línea; la ficha de Mapa aparece tentativa.
- **El mejor acuse es visual:** la tarjeta materializándose en el panel mientras la charla sigue (dualidad panel↔chat).
- **Umbral de confianza:** si Kyma no está razonablemente segura de la puerta o del contenido, no fuerza la ficha — pregunta o lo deja pasar. Mejor no capturar que capturar mal.
- **Todo lo creado es editable y borrable**, con deshacer fácil justo después.

---

## 4. El contrato del trabajador (entrada → salida)

- **Entrada:** el **trozo relevante** de la conversación + el identificador de la puerta (lo decide Kyma en su triaje). No toda la conversación.
- **El trabajador carga:** el paquete de su puerta (esquema + guardarraíles + alcance de contexto) y trae **solo el contexto de su puerta** (p. ej. ¿existe ya un interés de cine que enriquecer?). No la base entera.
- **Salida:** una ficha estructurada (Utilidad) o una propuesta de ficha tentativa (Mapa).
- **Cómo escribe:** a través de las funciones de la capa de datos de la Fase 2 (`elementos.crear`, `tags.*`, …). Esas funciones son sus herramientas; no toca la base directamente.
- **No habla nunca con el usuario.** El acuse lo da Kyma.

> La extracción es probabilística: el trabajador hace el montaje, pero la red de seguridad es que el usuario valida (sobre todo en Mapa) y todo es editable. No va a "encajar todo correctamente" siempre, y el diseño lo asume.

---

## 5. El hilo de la conversación

- **En sesión:** cada turno incluye la conversación en curso. Kyma ve todo lo dicho en esta sesión y **sigue el hilo sin esfuerzo** — automático, no hay que recuperar nada.
- **Sesiones largas:** cuando la conversación supera lo que cabe cómodo en contexto, lo reciente se mantiene **literal**; lo más antiguo se **destila** — lo que importaba ya es una ficha, el resto cae a un **resumen compacto** que vive en el buffer. No se archiva el crudo.
- **Entre sesiones (al volver):** Kyma carga el **buffer reciente** (continuidad cálida) + las **fichas pertinentes** al tema (la memoria de fondo). No recarga un historial completo: recarga lo que es del usuario y es legible.
- **Coherencia con Fase 2:** esto cumple "sigue bien el hilo" sin reabrir la decisión de privacidad (buffer efímero, fichas como verdad). Un transcript permanente sería una decisión deliberada aparte.

---

## 6. Carga perezosa de capacidades (la regla de escala)

- Kyma **no lleva en el prompt** las herramientas ni los guardarraíles de todos los módulos: los **trae** cuando la conversación toca esa puerta.
- Es lo que ofrece el registro de módulos (`KYMA_Brief_Antigravity.md` §3.2): cada módulo declara su herramienta, sus guardarraíles y su alcance, registrados en un sitio central, cargados cuando hacen falta.
- **Hoy (6 puertas):** los 6 paquetes caben a mano; Kyma resuelve en línea sin router. **Mañana (catálogo grande):** la carga bajo demanda es lo que evita que el prompt de Kyma reviente. Construye el límite limpio ahora; activa la carga perezosa cuando el número lo pida.

---

## 7. El motor de análisis (componente aparte, reservado)

Distinto del disparo por mensaje: es un proceso **periódico**, no por turno.
- **Lee fichas** (no el crudo) y sintetiza el retrato en `mapa_analisis`.
- **No se muestra en UI** en esta fase (decisión previa).
- Puede empezar a calcular y persistir desde ya (el 3.0 lo quiere día-1), pero su salida no llega a pantalla hasta la capa de conexión. Mantenerlo simple y separado del flujo conversacional.

---

## 8. Guardarraíles por puerta (esbozo de los 6 paquetes)

| Puerta | Qué dispara | Guardarraíl propio |
|---|---|---|
| Agenda | fecha/hora + evento | si la fecha es ambigua, una pregunta; nunca inventar hora |
| Tareas | acción pendiente | detectar urgencia por señales, sin moralizar |
| Notas | captura libre | estructurar lo mínimo; es materia prima de otras puertas |
| Intereses | gusto/pasión expresada | indagar antes; enriquecer interés existente en vez de duplicar |
| Vínculos | persona mencionada con peso | `cercania` solo del usuario; crear ficha de persona con tacto |
| Reflexiones | modo reflexivo claro | no de un comentario suelto; socrático al volver, no al crear |

---

## 9. Integración

- Se apoya en la capa de acceso de la Fase 2: **las funciones de datos son las herramientas** de los trabajadores. Si la UI o los agentes llaman a la base directamente, se rompe el modelo — todo pasa por la capa.
- El campo `origen` (`manual` / `kyma_sugerido` / `kyma_confirmado`) registra la procedencia y soporta el flujo sugerir→confirmar.
- Documentar el paquete de cada puerta y el contrato del trabajador en el repositorio, junto al registro de módulos.

---

## 10. Criterios de "hecho"

- [ ] Digo un hecho de Utilidad y la ficha aparece con acuse en línea, **sin cortar** la conversación.
- [ ] Hablo de algo del Mapa y Kyma **indaga** antes; la ficha aparece **tentativa**, no creada en silencio.
- [ ] Confirmo, edito o **descarto** una ficha sugerida; lo descartado no se reofrece.
- [ ] **Ignoro** una sugerencia y no se repite.
- [ ] En Intereses, mencionar algo afín **enriquece** el interés existente en vez de duplicarlo.
- [ ] Cierro sesión, vuelvo otro día y Kyma **sigue el hilo** (buffer + fichas), sin recargar un transcript completo.
- [ ] En una sesión larga, la conversación no se rompe ni se archiva en crudo.
- [ ] Ningún trabajador habla con el usuario; toda la voz es de Kyma.
- [ ] Todo lo creado por Kyma es editable y borrable, y queda marcado en `origen`.

---

> **En una frase para Antigravity:** dale a Kyma una sola voz con un núcleo fino (la constitución) que, al hablar, detecte qué es ficheable y a qué puerta va, y dispare a un trabajador invisible de esa puerta que monta la ficha con las funciones de datos de la Fase 2 — capturando en línea lo de Utilidad e indagando antes de proponer lo del Mapa, sin detener nunca la conversación y sin archivar el crudo.
