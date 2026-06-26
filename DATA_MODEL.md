# Modelo de Datos - Kyma v3.0 (Fase 2)

Este documento describe el esquema de base de datos relacional implementado en Supabase para Kyma 3.0, explicando cómo se representan las entidades, las relaciones y cómo se exponen al cliente frontend de forma segura y unificada.

---

## 1. Esquema de Base de Datos (Supabase / PostgreSQL)

Para evitar cajones estancos y facilitar relaciones transversales entre elementos (por ejemplo, que un evento de la Agenda pueda relacionarse con un interés o un vínculo), se ha optado por un **diseño de tabla unificada** (`elementos`) combinado con un **sistema relacional de etiquetas** (`tags`, `elemento_tags`).

### 1.1. Tablas y Tipos

#### `profiles` (Información del Usuario)
Vinculado directamente a `auth.users` mediante un trigger automático tras el registro con Google Auth.
- `id` (uuid, PK, referencias `auth.users.id` ON DELETE CASCADE)
- `email` (text): Email procedente de la cuenta de Google.
- `full_name` (text): Nombre completo.
- `avatar_url` (text): Enlace a la foto de perfil de Google.
- `pronombres` (text, null): Opcional.
- `preferencias` (jsonb, NOT NULL): Configuración de tema, idioma y nivel de prominencia de la exportación.
- `created_at` / `updated_at` (timestamptz)

#### `elementos` (Fichas del Panel)
Tabla principal que almacena todos los elementos (eventos, tareas, notas, intereses, reflexiones, personas).
- `id` (uuid, PK)
- `user_id` (uuid, referencias `profiles.id` ON DELETE CASCADE)
- `tipo` (enum: `evento`, `tarea`, `nota`, `interes`, `vinculo`, `reflexion`)
- `titulo` (text)
- `cuerpo` (text, null)
- `peso` (smallint, 1-3): Define la jerarquía visual de la tarjeta (Curiosidad/Normal/Órbita, Cercana/Destacado, Urgente/Pasión/Núcleo).
- `datos` (jsonb, default `{}`): Especificaciones propias de cada tipo de ficha.
- `origen` (enum: `manual`, `kyma_sugerido`, `kyma_confirmado`)
- `estado` (enum: `activo`, `archivado`)
- `created_at` / `updated_at` (timestamptz)

#### `tags` (Etiquetas/Vocabulario)
Vocabulario del usuario, único por combinación de usuario y nombre.
- `id` (uuid, PK)
- `user_id` (uuid, referencias `profiles.id` ON DELETE CASCADE)
- `nombre` (text): Nombre de la etiqueta, siempre en minúscula y empezando con `#` (ej. `#marta`).
- `tipo` (enum: `sistemico`, `tematico`, `handle`, `estado`)
- *Restricción:* UNIQUE(`user_id`, `nombre`)

#### `elemento_tags` (Tabla Intermedia de Relación)
Asocia elementos con etiquetas de forma N:M.
- `elemento_id` (uuid, referencias `elementos.id` ON DELETE CASCADE)
- `tag_id` (uuid, referencias `tags.id` ON DELETE CASCADE)
- *Restricción:* PK(`elemento_id`, `tag_id`)

#### `conversacion_buffer` (Historial Reciente del Chat)
Mantiene la conversación en un buffer de ventana corta para continuidad del asistente, sin persistir transcripciones eternas.
- `user_id` (uuid, PK, referencias `profiles.id` ON DELETE CASCADE)
- `mensajes` (jsonb, default `[]`): Array de objetos de mensaje.
- `updated_at` (timestamptz)

#### `mapa_analisis` (Reserva para Motor de Análisis)
Tabla temporal reservada para el cálculo futuro de Tribu, Radar y ADN.
- `user_id` (uuid, PK, referencias `profiles.id` ON DELETE CASCADE)
- `datos` (jsonb, default `{}`)
- `updated_at` (timestamptz)

---

## 2. Forma de `datos` (JSONB) por tipo de Elemento

Los detalles específicos de cada tipo de ficha se persisten en el campo semiestructurado `datos`:

| Tipo (`tipo`) | Estructura JSON en `datos` | Campos del Frontend | Notas / Reglas |
| :--- | :--- | :--- | :--- |
| **`evento`** | `{"fecha": "YYYY-MM-DD", "hora": "HH:MM"}` | `eventDate`, `eventTime` | Pendiente o agendado en Agenda. |
| **`tarea`** | `{"hecha": boolean}` | `completed` | Completitud de tareas en Tareas. |
| **`nota`** | `{}` | - | Notas libres. |
| **`interes`** | `{"nivel": "pasion" \| "curiosidad"}` | - | Determinante para la gravedad en el mapa. |
| **`vinculo`** | `{"cercania": "nucleo" \| "cercana" \| "orbita", "frecuencia_score": number}` | `cercania`, `frecuencia` | Frecuencia de 0 a 100%. |
| **`reflexion`** | `{}` | - | Reflexiones personales. |

---

## 3. Seguridad y Privacidad (RLS)

La seguridad está gobernada directamente en la base de datos de Supabase mediante **Row Level Security (RLS)** utilizando el identificador seguro del usuario autenticado (`auth.uid()`).

- **Profiles:** El usuario solo puede consultar, actualizar o borrar su propia fila.
- **Elementos:** RLS restringe las consultas para que `user_id = auth.uid()`.
- **Tags:** Restringidos por `user_id = auth.uid()`.
- **Elemento-Tags:** Solo se permite si el elemento asociado pertenece al usuario (`elementos.user_id = auth.uid()`).
- **Buffer de Conversación:** Solo accesible si `user_id = auth.uid()`.

---

## 4. Derecho al Olvido (Soberanía)

El sistema implementa el **Derecho al Olvido** mediante un borrado en cascada automático a nivel de base de datos.
Al eliminar la cuenta mediante la función RPC `delete_user_account()`, se borra la fila en `auth.users`. Las restricciones de clave externa (`ON DELETE CASCADE`) eliminan de forma atómica e irreversible:
1. El perfil (`profiles`)
2. Todas las fichas (`elementos`) y sus relaciones (`elemento_tags`)
3. Todas las etiquetas (`tags`)
4. El buffer de conversación (`conversacion_buffer`)
5. Los análisis asociados (`mapa_analisis`)
