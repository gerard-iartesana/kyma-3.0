# Changelog - Kyma v3.0

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [SemVer](https://semver.org/spec/v2.0.0.html).

---

## [3.0.0-fase2] - 2026-06-26

### Añadido
- **Esquema Supabase SQL:** Creación de tablas (`profiles`, `elementos`, `tags`, `elemento_tags`, `mapa_analisis`, `conversacion_buffer`) con claves externas en cascada y seguridad de nivel de fila (RLS).
- **Google OAuth Login:** Integración con Supabase Auth utilizando Google como proveedor único de inicio de sesión.
- **Soberanía y Derecho al Olvido:**
  - Botón discreto de exportación individual en cada ficha de panel a formato Markdown (`.md`) con metadatos estructurados.
  - Volcado completo de datos en un único archivo markdown concatenado, accesible desde preferencias.
  - Función RPC `delete_user_account` que borra al usuario de `auth.users` y elimina en cascada todas las filas del usuario en la base de datos pública.
- **Trigger de Perfil Automático:** Función trigger `handle_new_user` que crea el perfil del usuario inmediatamente después del registro con Google Auth.
- **Pantalla de Bienvenida:** Interfaz de acceso premium y minimalista en estilo dark glassmorphism.

### Cambiado
- **Capa Única de Acceso a Datos (`src/lib/db/client.ts`):** Sustitución del simulador local (`localStorage`) por llamadas asíncronas directas al cliente Supabase.
- **Componentes React Asíncronos:** Adaptación de `page.tsx`, `ItemDetailModal.tsx` y `KymaChat.tsx` para consumir promesas asíncronas en lugar de retornos síncronos.
- **Sincronización Automática de Tags:** Implementación de la extracción y sincronización automática de etiquetas en la base de datos a partir del cuerpo de la tarjeta.

### Seguridad
- **Row Level Security (RLS):** Activada en todas las tablas de Supabase, asegurando que un usuario no pueda leer, insertar, actualizar ni borrar datos que pertenezcan a otro usuario.
- **Variables de Entorno:** Exclusión de claves de Supabase del repositorio Git mediante `.env.local`.
