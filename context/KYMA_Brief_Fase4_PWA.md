# KYMA — Brief Fase 4: instalable desde el navegador (PWA)

> **Contexto:** se apoya en la webapp ya construida (Next.js + Supabase + Vercel, diseño oscuro editorial, móvil = cuaderno de captura). Aquí se convierte en una PWA: instalable en PC y móvil **desde el navegador**, sin App Store ni Play Store, con sensación de app nativa.
>
> **Cómo cargarlo en Antigravity:** brief de trabajo de esta fase. Las dos reglas de filosofía (§3 y §5) conviene reflejarlas en Rules.

---

## 0. Qué construye esta fase (y qué NO)

**Construye:**
- Instalación desde el navegador en escritorio (Chrome/Edge) y móvil (Android, iOS Safari).
- Apertura en modo standalone (sin barra del navegador; se siente una app).
- Funcionamiento offline del cascarón y captura offline con sincronización al reconectar.
- Aviso de actualización suave.

**NO construye:**
- Empaquetado para tiendas (no es el objetivo: se instala desde el navegador).
- Push de reenganche (decisión deliberada, §5).
- Una segunda base de código nativa: es la misma webapp, mejorada.

**Criterio de éxito:** instalo Kyma en el PC y en el móvil desde el navegador, se abre como app sin barra, veo mis fichas y capturo notas sin conexión, y al volver la red se sincroniza — sin que nada me hostigue para instalar ni me bombardee a notificaciones.

---

## 1. Por qué PWA y no tienda

Instalable desde el navegador, una sola base de código, control total, sin intermediarios que aprueben o cobren. Y encaja con la soberanía de Kyma: la persona instala su espacio directamente, sin pasar por la puerta de nadie. La misma URL desplegada en Vercel es, a la vez, la web y la app.

---

## 2. Lo imprescindible para ser instalable (el núcleo)

| Pieza | Qué hace |
|---|---|
| **Web App Manifest** | Declara nombre, iconos, colores y modo de visualización. Es lo que el navegador lee para ofrecer "Instalar". |
| **Service Worker** | Habilita la instalación y el offline; gestiona la caché. |
| **HTTPS** | Requisito de PWA. Vercel lo da de serie. |
| **Iconos y splash** | Set completo, incluidos iconos *maskable*, en la paleta oscura editorial de Kyma. |

**Campos del manifest (a concretar):**
- `name`: "Kyma" · `short_name`: "Kyma"
- `display`: `standalone` (sin barra del navegador)
- `start_url` y `scope`: la raíz de la app
- `theme_color` / `background_color`: los grises oscuros de la identidad (el splash debe sentirse Kyma, no un blanco genérico)
- `icons`: varios tamaños + versión *maskable* (para que el icono se vea bien recortado en Android)
- `lang`: `es` · `orientation`: `portrait` en móvil

---

## 3. La experiencia de instalación (regla de filosofía)

**No hostigar.** Ofrecer instalar de forma **discreta y contextual**, después de que la persona le haya sacado valor — no un pop-up nada más entrar. Descartable, sin insistir. Empujar la instalación agresivamente contradice el "slow".

| Plataforma | Cómo |
|---|---|
| **Escritorio (Chrome/Edge)** | Una invitación suave propia ("Instalar Kyma") + el prompt nativo del navegador. |
| **Android** | Capturar el evento de instalación del navegador y ofrecerlo con tacto, en el momento oportuno; no al primer segundo. |
| **iOS / Safari** | No hay instalación automática. Mostrar un **hint discreto** —solo a usuarios de Safari en iOS— de cómo añadir a la pantalla de inicio. Una vez, descartable. |

---

## 4. Offline y local-first (el "ideal", por capas)

**Capa 1 — núcleo (imprescindible):** el cascarón funciona offline (app shell cacheado) y se pueden **ver las fichas ya cargadas** sin conexión.

**Capa 2 — ideal:** **captura offline**. Crear notas y fichas sin red, encoladas localmente, **sincronizadas al reconectar**. Esto encaja de lleno con el móvil como cuaderno de volcado: que la falta de cobertura nunca te impida apuntar algo.

**Límite honesto:** el chat con Kyma **necesita red** (llama a un modelo). Offline puedes capturar y consultar lo cacheado, **no conversar**. Decirlo claro en la UI: un estado "sin conexión — tus capturas se guardan y se enviarán al volver", sin que parezca un error.

**Estrategia de caché:**
- App shell → *cache-first* (carga instantánea).
- Datos del usuario → *network-first* con *fallback* a caché (frescura cuando hay red, disponibilidad cuando no).
- Escrituras sin red → **cola local** que se vacía al reconectar (sincronización diferida).

---

## 5. Notificaciones (regla de filosofía)

Una PWA "completa" llevaría push, el mayor motor de reenganche. **Para Kyma, no.**

- **Cero push de engagement:** nada de rachas, "vuelve", recordatorios de "no has escrito hoy". Es el bucle anti-slow que el producto rechaza.
- **Solo recordatorios de utilidad que el usuario pide explícitamente** (p. ej. el recordatorio de una tarea que él mismo fijó). Opt-in, controlables, silenciables. Nunca retención.
- **Recomendación MVP:** no implementar push en absoluto en esta fase. Añadir recordatorios opt-in solo si una puerta de Utilidad lo necesita de verdad.

---

## 6. Actualizaciones

- Versionar el service worker.
- Cuando hay versión nueva, **aviso suave** ("hay una versión nueva de Kyma, recarga para actualizar"), sin forzar ni interrumpir. Que el usuario decida cuándo.

---

## 7. Privacidad y almacenamiento local

- Lo que se cachee localmente **sigue siendo del usuario** — coherente con la soberanía.
- **Cuidado con el desalojo de almacenamiento** (iOS borra el storage de PWAs poco usadas): el caché local **no es la copia de verdad**. La verdad sigue en Supabase, que es del usuario. El offline es comodidad, no la fuente única.
- Ofrecer **"borrar datos locales"** (limpiar caché y cola pendiente) además del borrado en servidor de las fases anteriores.

---

## 8. Stack e integración

- La misma webapp Next.js (App Router) + Supabase, desplegada en Vercel (HTTPS y cabeceras correctas ya disponibles).
- Añadir manifest + service worker + set de iconos. No es una app aparte.
- Generar los iconos en todos los tamaños y la versión *maskable*, con la paleta de Kyma.
- **Probar instalación real** en los tres entornos: Chrome de escritorio, Android, iOS Safari. No fiarse solo de la teoría.

---

## 9. Criterios de "hecho"

- [ ] Instalo Kyma en PC desde Chrome/Edge; se abre en **standalone**, sin barra del navegador.
- [ ] Instalo en **Android** desde el navegador.
- [ ] Añado a inicio en **iOS Safari** siguiendo un hint discreto.
- [ ] El **splash y el icono** se sienten Kyma (paleta oscura), no un genérico.
- [ ] **Offline:** veo mis fichas cacheadas y **capturo notas**; al volver la red, se **sincronizan**.
- [ ] El estado "sin conexión" se comunica con calma, no como error; queda claro que el chat necesita red.
- [ ] **No hay push de engagement**; si hay recordatorios, son opt-in y silenciables.
- [ ] Una **versión nueva** avisa de forma suave, sin forzar.
- [ ] Existe **"borrar datos locales"**; la verdad sigue en Supabase.
- [ ] La invitación a instalar es **discreta y descartable**, nunca repetitiva.

---

> **En una frase para Antigravity:** convierte la webapp de Kyma en una PWA instalable desde el navegador en PC y móvil (manifest + service worker + iconos en la paleta oscura, modo standalone), con el cascarón y la captura funcionando offline y sincronizando al reconectar — sin push de reenganche y con una invitación a instalar discreta, fiel al "slow" y a la soberanía del producto.
