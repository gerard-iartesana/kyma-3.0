# KYMA — Brief Fase 2: capa de datos, autenticación y persistencia

> **Contexto:** complementa a `KYMA_Brief_Antigravity.md` (producto y pantallas). Aquí se construye el cimiento que da persistencia, para poder crear y editar fichas a mano y probar que todo se guarda — antes de montar los agentes.
>
> **Cómo cargarlo en Antigravity:** brief de trabajo de esta fase. Las reglas de soberanía y privacidad (§1) conviene tenerlas también en Rules.

---

## 0. Qué construye esta fase (y qué NO)

**Construye:**
- Login con cuenta de Google (Supabase Auth).
- El esquema de la base de datos de las fichas, con RLS por usuario.
- La capa única de acceso a datos (la UI ya puede crear, leer, editar y borrar fichas a mano).
- Exportación por bloque y borrado, como derechos de soberanía.
- Repositorio en GitHub y despliegue en Vercel.

**NO construye (es la fase siguiente):**
- Los agentes / la extracción automática (el disparador). El campo de procedencia (`origen`) queda listo para ellos, pero en esta fase **todas las fichas se crean a mano**.
- El motor de análisis silencioso (Tribu/Radar/ADN). Se deja sitio en el esquema; nada lo rellena aún.

**Criterio de éxito de la fase:** entro con Google, creo una ficha a mano en cualquier puerta, la edito, la borro, recargo y sigue ahí; no puedo ver datos de otro usuario; puedo exportar una ficha a `.md`; está desplegado en Vercel.

---

## 1. Principios que mandan sobre el esquema

1. **El usuario es dueño de sus filas.** RLS en todas las tablas: cada usuario solo ve y toca lo suyo. Esto no es higiene, es el producto.
2. **Las fichas son la verdad persistente.** Lo que perdura es el panel (las fichas), no la conversación. Todo dato es visible, editable, borrable y exportable.
3. **El esquema deja el enchufe del agente puesto.** La UI nunca habla con la base de datos directamente: pasa por una única capa de acceso. Eso es lo que hará que los agentes sean enchufables sin reescribir nada.
4. **Modelo consumer, no multi-tenant.** Un solo proyecto Supabase, muchos usuarios, aislados por RLS. NO una matriz de roles admin/editor/viewer (eso era el patrón B2B de iArtesana; aquí no aplica).

---

## 2. Autenticación

- **Supabase Auth con proveedor Google** (OAuth). Sin contraseñas propias.
- Al primer inicio de sesión, crear automáticamente la fila en `profiles` (trigger sobre el alta en `auth.users`).
- Sesión persistente en el cliente. La identidad del usuario (`auth.uid()`) es la clave de todo el RLS.

---

## 3. Modelo de datos — las fichas

### 3.1. Decisión de arquitectura: tabla unificada de fichas

Las fichas son visualmente un sistema único de tarjetas que sirve para todas las puertas (así está diseñada la UI). El esquema lo refleja: **una tabla `elementos`** con los campos transversales comunes + un `datos` flexible para lo que cada tipo necesita, y los **tags** como mecanismo que permite que una ficha viva en varias puertas a la vez.

Esto evita los dos extremos: ni una tabla por puerta (cajones estancos, se pierden las conexiones cruzadas), ni todo en jsonb sin estructura (se pierde fiabilidad). Los campos que de verdad importan transversalmente son columnas; lo específico de cada tipo va en `datos`.

### 3.2. Tablas

#### `profiles` — la persona
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` |
| `email` | text | de Google |
| `full_name` | text | de Google |
| `avatar_url` | text | de Google |
| `pronombres` | text, null | mínimo, opcional |
| `preferencias` | jsonb | tema, idioma, prominencia de exportación, etc. |
| `created_at` / `updated_at` | timestamptz | |

#### `elementos` — la ficha (el corazón)
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK→profiles, NOT NULL | el dueño |
| `tipo` | enum | `evento` · `tarea` · `nota` · `interes` · `vinculo` · `reflexion` |
| `titulo` | text | el título de la tarjeta |
| `cuerpo` | text, null | descripción / contenido |
| `peso` | smallint, default 1 | check 1–3 (jerarquía transversal) |
| `datos` | jsonb, default `{}` | campos específicos por tipo (ver 3.3) |
| `origen` | enum, default `manual` | `manual` · `kyma_sugerido` · `kyma_confirmado` (procedencia; en esta fase siempre `manual`) |
| `estado` | enum, default `activo` | `activo` · `archivado` |
| `created_at` / `updated_at` | timestamptz | |

#### `tags` — el vocabulario del usuario
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `nombre` | text | p. ej. `pablo`, `filosofia` |
| `tipo` | enum | `sistemico` · `tematico` · `handle` · `estado` |
| | | unique(`user_id`, `nombre`) |

#### `elemento_tags` — la red que cruza puertas
| Campo | Tipo | Notas |
|---|---|---|
| `elemento_id` | uuid FK | |
| `tag_id` | uuid FK | |
| | | PK(`elemento_id`, `tag_id`) |

> Conceptualmente, **cada puerta es una vista filtrada por tipo/tag**, no una tabla aparte. "Concierto de X" puede ser `evento` (Agenda) y llevar el tag de un interés (Intereses) sin duplicarse.

#### `mapa_analisis` — la capa silenciosa (reservada)
| Campo | Tipo | Notas |
|---|---|---|
| `user_id` | uuid PK FK | una fila por usuario |
| `datos` | jsonb | Tribu/Radar/ADN — se calculan en el futuro |
| `updated_at` | timestamptz | |

> Crear la tabla vacía ahora (el 3.0 quiere que esta capa exista desde el día 1), pero **nada la escribe en esta fase**. Llega con el motor de análisis.

### 3.3. Forma de `datos` por tipo (documentar en `DATA_MODEL.md`)

- `evento` → `{ fecha, hora, ubicacion }`
- `tarea` → `{ hecha: bool, urgente: bool }`
- `nota` → `{ destacada: bool }`
- `interes` → `{ nivel: "pasion" | "curiosidad" }`
- `reflexion` → `{ destacada: bool }`
- `vinculo` → `{ cercania: "nucleo" | "cercana" | "orbita", frecuencia_score: number, ultima_mencion: timestamp }`

**Vínculos es el único con doble dimensión:** `cercania` la marca el usuario (soberanía); `frecuencia_score` la calcula el sistema y decae con el tiempo. En esta fase solo se persiste `cercania` (manual); el cálculo de frecuencia y su decaimiento llegan con los agentes — dejar el campo previsto.

---

## 4. La conversación: buffer efímero, no archivo

**Decisión:** no se guarda la conversación en crudo de forma permanente. La verdad persistente son las fichas.

- `conversacion_buffer`: una fila por usuario (`user_id` PK) con `mensajes` (jsonb, ventana reciente) y `updated_at`. Es un **buffer corto y borrable** para dar continuidad, no un transcript eterno.
- **"Limpiar historial"** vacía este buffer. Las fichas ya extraídas y validadas **permanecen** (son del usuario).
- Diseñar esta política ahora aunque el chat con extracción sea de la fase siguiente, para no acabar archivando un log permanente por defecto.

---

## 5. Soberanía: exportación y borrado

- **Exportar es un derecho, siempre disponible**, no una función que se activa. Lo que se configura en preferencias es la **prominencia** del botón (discreto en el detalle por defecto; ascendible a botón siempre visible por bloque).
- **Exportar por bloque:** cualquier ficha o puerta → `.md` o `.txt`, para llevártelo donde quieras.
- **Exportar todo:** un volcado global de los datos del usuario.
- **Borrado:** borrar una ficha (fácil, con deshacer inmediato) y borrar la cuenta entera con todos sus datos (derecho al olvido, sin fricción ni patrones oscuros).

---

## 6. Seguridad: RLS por usuario

Cada tabla con datos del usuario lleva RLS y el mismo patrón: el usuario es dueño total de sus filas. Patrón ilustrativo (a adaptar y generar como migración):

```sql
alter table elementos enable row level security;

create policy "dueño total sobre sus elementos"
  on elementos for all
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );
```

Mismo principio en `profiles`, `tags`, `elemento_tags` (vía el `user_id` del elemento o tag), `mapa_analisis` y `conversacion_buffer`. **Verificar explícitamente** que un usuario no puede leer ni una fila de otro.

---

## 7. La capa única de acceso a datos (el enchufe del agente)

- Los componentes de UI **nunca** importan el cliente de Supabase ni hacen llamadas crudas.
- Toda operación pasa por funciones tipadas en una única capa (`lib/db/client`): `elementos.crear`, `elementos.listarPorTipo`, `elementos.actualizar`, `elementos.borrar`, `tags.*`, etc.
- **Por qué es innegociable:** estas mismas funciones serán las herramientas que los agentes usen en la fase siguiente. Si la UI llama directo a la base, los agentes no son enchufables sin reescribir todo.

---

## 8. Stack y despliegue

- **Frontend:** Next.js (App Router). **Base de datos / Auth:** Supabase. **Repo:** GitHub. **Despliegue:** Vercel.
- **Variables de entorno** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) en el panel de Vercel. **Nunca** hardcodeadas, nunca commiteadas (`.env.local` fuera del repo).
- **Tipos generados** desde el esquema (`supabase gen types`), no escritos a mano.
- Documentar el modelo en `DATA_MODEL.md` y los cambios en `CHANGELOG.md` (método iArtesana).

---

## 9. Criterios de "hecho" de esta fase

- [ ] Entro con Google y se crea mi `profiles` automáticamente.
- [ ] Creo una ficha a mano en cada tipo de puerta; se guarda con su `peso`, `tags` y `datos`.
- [ ] Edito y borro fichas; los cambios persisten al recargar.
- [ ] RLS verificado: con otra cuenta, **no veo ni una fila ajena**.
- [ ] Exporto una ficha a `.md`; puedo borrar mi cuenta entera.
- [ ] "Limpiar historial" vacía el buffer y **conserva** las fichas.
- [ ] La UI no hace ni una llamada directa a Supabase: todo pasa por la capa de acceso.
- [ ] Desplegado en Vercel, con variables de entorno fuera del repo.

---

> **En una frase para Antigravity:** monta la capa de datos de Kyma en Supabase (Auth con Google, una tabla unificada `elementos` + `tags` con RLS por usuario, capa única de acceso, exportación y borrado como derechos), de modo que se puedan crear y editar fichas a mano y comprobar que persisten — dejando el enchufe puesto para los agentes de la fase siguiente, sin construirlos todavía.
