# KYMA — Brief de construcción para Antigravity 2.0

> **Qué es esto:** el documento fundacional del proyecto. Antigravity lo lee como contexto raíz para generar su *Implementation Plan*. Apruébalo (o coméntalo) antes de que el agente escriba código.
>
> **Alcance de este brief:** MVP de la webapp — los estados *poblados* y *vacíos* de las pantallas destino. NO incluye onboarding/primera sesión, capa de conexión humana, marketplace de módulos, B2B ni pagos (ver §8).
>
> **Cómo cargarlo en Antigravity:** la §1 (las reglas no negociables) conviene copiarla también a **Rules** (la constitución persistente del agente), para que se respeten en cada cambio, no solo en el plan inicial. El resto es el brief de trabajo.

---

## 0. La frase que lo resume todo

> Un asistente personal (Kyma) que te ayuda con tu día a día y, mientras lo hace, construye contigo un panel visible de quién eres. Sin pedirte que lo rellenes. Sin opinar sobre ti. Sin vender tus datos. Tú gestionas tu perfil con comodidad en escritorio; vuelcas información sobre la marcha hablando con Kyma desde el móvil.

Kyma es **una sola entidad conversacional** que orquesta todo. Internamente puede apoyarse en especialistas (motor de análisis, etc.), pero **el usuario siempre habla con Kyma**, nunca con "otro agente".

---

## 1. Reglas no negociables (la constitución → copiar a Rules)

Estas reglas mandan sobre cualquier decisión de UI. Si una pantalla las contradice, la pantalla está mal.

1. **Espejo, no juez (regla de oro).** Cuando el usuario expresa algo personal, Kyma **pregunta antes de aconsejar**. El asistente es espejo primero, enciclopedia segundo. Nada de lenguaje clínico, diagnósticos ni etiquetas. Lenguaje de hipótesis: "Por lo que percibo...", "Quizás...".

2. **Soberanía del usuario.** Todo dato que el sistema entienda sobre la persona es **visible, editable y borrable** por ella. Esto es lo que diferencia a Kyma de la "memoria" opaca de un chatbot. Cada pantalla de detalle debe permitir ver/editar/borrar.

3. **Privacidad como producto, no pie de página.** Los datos del usuario son suyos, literalmente: exportables, borrables, nunca usados para entrenar modelos. Esto es el foso defensivo del producto; tiene que *sentirse* en la UI (p. ej. accesos claros a exportar/borrar, sin patrones oscuros).

4. **Cocina a fuego lento / anti-gamificación.** El perfil se construye despacio y por uso real, no rellenando formularios. **Prohibido**: barras de "completa tu perfil", checklists de progreso, badges, rachas, presión por "desbloquear". Las funciones nuevas son *puertas que se abren*, nunca *coleccionables que faltan*.

5. **Minimalismo evolutivo.** El lienzo empieza limpio, casi monocromático, y se enriquece con el viaje del usuario. El color y la personalidad visual son una **recompensa que emerge del uso**, no decoración inicial.

6. **Una sola voz.** Kyma es la única voz que el usuario oye. Tono "Amigo Inteligente": curioso, lúcido, cálido, juguetón, humano. Primera persona del singular, nunca plural.

7. **El sistema sugiere, el usuario decide.** En todo lo que tenga carga afectiva o subjetiva (importancia de una persona, abrir una puerta, asignar un tag), el sistema **observa y propone**; la decisión final la valida el usuario. **Toda sugerencia debe poder ignorarse sin coste**: si se ignora, no se repite; si se rechaza, se aprende.

8. **Panel y chat son dos vistas de la misma cosa.** No es "app de notas" + "app de chat" pegadas. Desde cualquier elemento del panel se abre el chat con ese contexto ya cargado, y lo que se conversa actualiza el panel.

---

## 2. Las "Puertas" (el concepto central de navegación)

La app se organiza en **Puertas**: espacios persistentes con propósito propio. (Nombre de cara al usuario: *Puertas*. Nombre interno/técnico: *módulos*.) Hay dos categorías:

- **Puertas de Utilidad** — justifican abrir la app cada día. Activas desde el primer momento.
- **Puertas del Mapa** — construyen el retrato del usuario. Visibles pero "veladas" hasta que hay material que las llene.

### Catálogo MVP (6 puertas)

| Puerta | Categoría | Propósito en una línea |
|---|---|---|
| 🗓️ **Agenda** | Utilidad | Calendario y eventos. Kyma contextualiza ("Cena con Marta" → ¿qué significa?). |
| ✅ **Tareas** | Utilidad | To-dos, recordatorios, lista de la compra. Detecta patrones sin moralizar. |
| 📝 **Notas** | Utilidad | Captura rápida sin clasificar. Materia prima de la que emergen las puertas profundas. |
| 🌍 **Intereses** | Mapa | Mapa de pasiones: el "qué" y el "cómo" de lo que le gusta. |
| 👥 **Personas** | Mapa | Memoria afectiva de quién importa (no una agenda de contactos). |
| 🪞 **Reflexiones** | Mapa | Diario interior. Aquí brilla el motor socrático. |

### Visibilidad inicial
- Las 3 de Utilidad: **activas y usables desde el día 1**.
- Las 3 del Mapa: **visibles pero veladas**. El usuario las ve (entiende que existen) pero comprende que aún no contienen nada porque no ha habido conversación que las llene. **Deben comunicar potencial, no sentirse como funciones tras un paywall.** Son promesas, no muros.

> **Importante para el diseño:** este catálogo está pensado para *crecer* en el futuro (nuevas puertas). Diséñalo como un sistema extensible (registro de módulos, §3), aunque en MVP solo existan estas 6. No hardcodees las 6 en la navegación.

---

## 3. Arquitectura (patrones a seguir)

Adaptación del método "iARTESANA" (separación cascarón/datos, registro de módulos, capa única de acceso, hook de agente). **Diferencia clave a respetar:** iARTESANA es B2B multi-tenant (un proyecto Supabase por cliente, matriz de roles). **Kyma NO es eso.** Kyma es consumer: **un solo producto, muchos usuarios, una base de datos, RLS por usuario** ("cada usuario es dueño de sus filas y solo ve las suyas"). No montes matriz de roles admin/editor/viewer; el modelo es "el usuario es dueño de sus propios datos".

### 3.1. Dos capas de naturaleza opuesta
- **El cascarón** (navegación, layout, estado de UI, componentes atómicos, tematización): estándar, replicable, barato. Idéntico aunque cambien las puertas.
- **El modelo de datos**: el esquema es *el producto*. Diséñalo con cuidado desde el principio.

### 3.2. Registro de módulos como contrato
La navegación no se escribe a fuego. Cada Puerta se declara en un **registro tipado de módulos**: id, título, icono, vista, y (cuando un módulo real lo necesite) las herramientas que aporta al asistente y los indicadores que da al panel. Esto es lo que hace el sistema extensible.

### 3.3. Capa única de acceso a datos (regla más importante del cascarón)
Los componentes de UI **nunca** llaman a la base de datos directamente. Toda operación pasa por funciones tipadas en una única capa de acceso (`lib/db/client`). El componente invoca la función y recibe datos limpios.
**Por qué importa:** es lo que hace que el motor de análisis y el asistente sean *enchufables* sin reescribir la UI. Innegociable.

### 3.4. Hook del asistente reservado desde el día 1
Deja preparada la capa del asistente (carpeta tipo `copilot/`) aunque no esté toda la lógica activa. Las funciones de la capa de datos son las candidatas a "herramientas" que Kyma usará para leer/escribir en el panel.

### 3.5. Modelo de datos — forma conceptual (no esquema final)
> Esto es dirección, no el `DATA_MODEL.md` definitivo. Antigravity debe proponer el esquema y documentarlo antes de construir.

- **El usuario es dueño de todo lo suyo** (RLS por usuario en todas las tablas).
- **Elemento como unidad transversal:** un mismo registro puede vivir en varias puertas a la vez (un "concierto de X" es Agenda + Intereses sin duplicarse). Esto se resuelve con tags (§4.3), no replicando filas.
- **Capa de análisis silenciosa:** existen cálculos del retrato (lo que el Kyma original llamaba Tribu/Radar/ADN) que **se calculan y persisten desde el día 1 pero NO se muestran en MVP**. Vuelven a la UI cuando llegue la capa de conexión (fuera de alcance ahora). Diseña el esquema para que quepan.

---

## 4. Sistemas transversales (funcionan en todas las puertas)

### 4.1. Peso (jerarquía)
Campo único `peso` (1–3 internamente) en todo elemento. La **UI expone la granularidad que cada puerta necesita**, con etiquetas concretas, no abstractas (nada de "alta/media/baja"):

| Puerta | Concepto | Niveles |
|---|---|---|
| Tareas | Urgencia | Urgente / Normal |
| Notas | Destacado | Destacada / Normal |
| Reflexiones | Destacado | Destacada / Normal |
| Intereses | Pasión | Pasión / Curiosidad |
| Personas (cercanía) | Cercanía afectiva | Núcleo / Cercana / Órbita |

**Anti-inflación:** límite suave en el nivel más alto donde aplique (p. ej. avisar si "Núcleo" en Personas supera ~8-10 personas), para forzar la decisión real.

### 4.2. Doble dimensión en Personas (única puerta con dos ejes)
- **Cercanía afectiva** (Núcleo / Cercana / Órbita): la marca el usuario. Soberanía pura — el sistema puede *sugerir*, nunca asignar sin confirmación.
- **Frecuencia de contacto:** la calcula el sistema (menciones, eventos compartidos). Es objetiva, dinámica y **decae con el tiempo** si dejas de mencionar a alguien.

Las dos dimensiones combinadas permiten reconocer patrones (pareja diaria, gran amigo lejano, conocido frecuente…). Esto abre posibilidades visuales ricas (§5).

### 4.3. Tags (la red que conecta puertas)
Cada elemento lleva tags. Las puertas son, conceptualmente, *vistas filtradas por tag*.
- **Sistémicos:** automáticos según la naturaleza del elemento (`#persona`, `#evento`, `#reflexion`).
- **Temáticos:** sistema o usuario (`#filosofia`, `#cine`).
- **Identitarios (handles):** cada persona/interés tiene un handle único (`#pablo`, `#cine-noir`) referenciable desde cualquier puerta, estilo wiki.
- **De estado:** opcionales (`#pendiente`, `#destacado`).

**Dos niveles, sin tutorial:**
- *Básico (todos):* tags automáticos; el usuario los ve, borra los que no encajen, añade los suyos desde un selector.
- *Avanzado (orgánico):* la sintaxis `#tag` en texto libre se reconoce y enlaza. Quien escribe "Cena con #pablo hablando de #filosofia" *descubre* que la app lo entiende. **Invisible si no lo usas.**

### 4.4. Botón "preguntar a Kyma"
Todo elemento del panel tiene un botón directo que abre el chat con ese elemento ya cargado de contexto.
**Comportamiento por defecto: Kyma abre con una pregunta socrática (modo espejo).**
> Usuario clica la nota "vi La Llegada anoche" → Kyma: *"La Llegada — ¿qué te ha quedado dando vueltas hoy de ella?"*

Si el usuario pide información ("recomiéndame parecidas"), Kyma cambia a modo curador. **El orden importa: pregunta primero, información después.** El botón debe sentirse como *invitación opcional*, no como un CTA agresivo.

---

## 5. Sistema de diseño visual

### 5.1. Principio: minimalismo evolutivo
Interfaz inicial serena y casi monocromática (calma para la introspección). Gana "pinceladas de color" a medida que el perfil se construye. El diseño no se impone: se desbloquea con el uso.

### 5.2. Temas
Claro y oscuro, ambos disponibles. **Oscuro recomendado** (experiencia más íntima, menor fatiga). Base de grises neutros elegantes.

### 5.3. Tipografía
- **Titulares y nombres:** serif moderna y editorial (Playfair Display / Garamond). Le da el carácter atemporal de un buen libro.
- **Cuerpo, UI, botones, menús:** sans-serif humanista, limpia y muy legible (Inter / Nunito / Lato).

### 5.4. El color como lenguaje (no como decoración)
Los colores vivos se **reservan para visualizar datos** del perfil y aportar personalidad, no para teñir la interfaz. Sobre fondo neutro, el dato canta.

### 5.5. Iconografía y forma
Iconos abstractos, geométricos, de línea fina, coherentes con el logo (una **ola** estilizada dentro de un **círculo**). Visualizaciones de datos limpias donde forma y color informen sin texto excesivo.

### 5.6. Evitar lo genérico
No quiero una plantilla de dashboard SaaS. Cada decisión visual debe servir a la calma, el foco y la sensación de "lienzo personal". Si una pantalla parece intercambiable con cualquier app de productividad, está mal resuelta.

---

## 6. Las dos superficies: escritorio primero, móvil como compañero

> Se diseña **escritorio primero como orden de construcción** (la superficie más rica), pero el móvil **no es una reducción**: es una superficie de primera con un trabajo propio. La retención diaria vive en el móvil.

### 6.1. Escritorio — el "observatorio" / centro de mando
Donde el usuario **ve y gestiona todo su Mapa con comodidad**: panel completo, todas las puertas a la vista, edición rica, vistas de relaciones, exportar/borrar (Ley Primera en plenitud). Layout amplio, multi-panel: navegación de puertas + contenido + chat de Kyma coexistiendo.

### 6.2. Móvil — el "cuaderno" / volcado conversacional
Donde el usuario **vuelca información sobre la marcha hablando con Kyma**, que va "tomando notas" y rellenando la base de datos. Prioridad absoluta: **captura rápida + conversación**. Consulta ligera del panel, sí; gestión pesada, no (esa es del escritorio). El chat con Kyma es el centro de gravedad en móvil.

### 6.3. Regla de adaptación
No "comprimir el escritorio". Re-priorizar por trabajo: en móvil, lo primero que el usuario ve y toca es **capturar / hablar con Kyma**; el panel completo es secundario y navegable, no la portada. Toda acción de captura debe estar a un toque.

---

## 7. Mapa de pantallas a construir (alcance MVP)

Para cada puerta hay que diseñar **dos estados que importan más que ninguno**: el **poblado** y el **vacío/velado** (este último es lo que el usuario ve el 80% del tiempo las primeras semanas).

1. **El Panel (home).** Vista de conjunto de las puertas. Utilidad activa, Mapa velado pero presente. En escritorio, conviviendo con el chat; en móvil, accesible pero no portada.
2. **Agenda** — poblada (eventos con contexto) + vacía.
3. **Tareas** — poblada (con peso Urgente/Normal) + vacía.
4. **Notas** — poblada (captura suelta, tags emergentes) + vacía.
5. **Intereses** — poblada (pasiones con peso Pasión/Curiosidad) + velada.
6. **Personas** — poblada (doble dimensión: cercanía + frecuencia, con su lenguaje visual) + velada.
7. **Reflexiones** — poblada (entradas, modo socrático al *volver* a una) + velada.
8. **Chat con Kyma** — vista conversacional completa; y su integración con el panel (dualidad).
9. **Vista de detalle de un elemento** — ver / editar / borrar (Ley Primera), con sus tags y peso, y el botón "preguntar a Kyma".
10. **Estados transversales** — carga y error, visibles y cuidados, en todas las vistas.

---

## 8. Fuera de alcance (NO construir ahora)

Para proteger el foco MVP, queda explícitamente fuera:
- **Capa de conexión humana** (matching, Tribus/Radar visibles, Pacto de Visibilidad, Tarjeta de Conexión). Es v2.
- **Marketplace / catálogo de módulos de terceros.** El sistema se diseña extensible, pero no se construye tienda. Es v2/v3.
- **Onboarding / flujo de primera sesión.** Bloqueado por una decisión de producto aún abierta (cómo se "abren" las puertas). Se diseña después, sobre las pantallas pobladas ya validadas.
- **B2B / vertical de empresas.** Producto distinto. No tocar.
- **Pagos / suscripción / tiers.** No en este MVP.
- **Tribus, Radar, DISC, Sombras en la UI.** Se calculan en silencio (§3.5) pero no se muestran.

---

## 9. Stack

- **Frontend:** Next.js (App Router), construido con Antigravity.
- **Base de datos:** Supabase (el panel visible es, literalmente, una vista de Postgres). RLS **por usuario**, obligatorio.
- **Despliegue:** Vercel. **Repositorio:** GitHub.
- **Tipos generados desde el esquema** (no escritos a mano).

---

## 10. Criterios de "hecho" (cómo sé que está bien)

- [ ] Todos los **estados vacíos/velados** están diseñados y comunican potencial sin parecer paywalls.
- [ ] Panel y chat **se sienten una sola cosa**; desde cualquier elemento se abre Kyma con contexto.
- [ ] Todo dato es **visible, editable y borrable** por el usuario.
- [ ] **Cero** patrones de gamificación (sin barras de progreso, rachas, badges, presión de desbloqueo).
- [ ] Kyma abre **con pregunta** por defecto; información solo si se pide.
- [ ] Toda sugerencia del asistente **se puede ignorar sin coste** y no se repite si se ignora.
- [ ] La navegación de puertas usa el **registro de módulos** (extensible), no 6 entradas hardcodeadas.
- [ ] La capa de UI **nunca** llama a la base de datos directamente.
- [ ] **Móvil** prioriza captura + conversación; **escritorio** prioriza gestión rica del Mapa.
- [ ] El esquema deja sitio para la **capa de análisis silenciosa** y para la futura capa de conexión.

---

> **En una frase para Antigravity:** construye el cascarón de una webapp serena y extensible (Next.js + Supabase, RLS por usuario) organizada en "Puertas", donde panel y un asistente de una sola voz son dos vistas de lo mismo, donde el usuario es dueño absoluto de sus datos, y donde nada empuja, gamifica ni juzga. Escritorio primero como centro de mando; móvil como cuaderno de volcado conversacional.
