# Supabase Setup for Pastoral

Este proyecto usa Supabase para:
- almacenar usuarios pendientes y aprobados en `user_profiles`
- manejar el estado de conexión con `pjl_store`
- enviar verificación de correo para nuevas cuentas

## Pasos necesarios

1. En Supabase, abre el SQL editor.
2. Ejecuta el contenido del archivo `supabase-schema.sql`.
   - Esto crea las tablas necesarias: `user_profiles` y `pjl_store`.
   - Tambien crea las policies para que la app pueda leer y guardar cambios.

3. En local, crea `.env.local` usando `.env.example` como referencia:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

4. En Vercel, configura las mismas variables de entorno en tu proyecto:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

5. Guarda las variables y fuerza un redeploy del proyecto.

6. Para publicar cambios de codigo en Vercel:
   ```bash
   git status
   git add .
   git commit -m "Actualiza sitio pastoral"
   git push origin main
   ```

7. Para sincronizar datos editados desde el panel Admin, verifica que `/api/supabase/status` responda `ok: true` en local y en Vercel.

## Qué hace cada tabla

- `user_profiles` almacena solicitudes de acceso y usuarios del panel.
- `pjl_store` almacena los datos remotos que usa la app para su configuración en vivo.

## Cómo funciona el proceso de registro

- El usuario solicita acceso en el panel.
- Supabase crea la cuenta con `status = pendiente`.
- El administrador ve la solicitud en `Solicitudes pendientes`.
- El administrador puede:
  - reenviar el correo de verificación,
  - aprobar la cuenta,
  - eliminar el usuario.

## Eliminación desde el panel de admin

- Al eliminar un usuario desde el Admin, el sistema elimina:
  - el registro de `user_profiles` en Supabase,
  - la cuenta de autenticación en Supabase si `SUPABASE_SERVICE_ROLE_KEY` está configurado.

## Nota

Si no tienes `SUPABASE_SERVICE_ROLE_KEY`, el perfil se elimina de la tabla, pero la cuenta de auth no se puede borrar.
