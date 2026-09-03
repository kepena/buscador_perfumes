-- ============================================================
--  06-escritura-restringida.sql
--  Buscador de Perfumes Pro — Kaiketek
--
--  QUE HACE
--    Deja de aceptar escrituras de "cualquiera con sesión iniciada" y las
--    limita a una lista de correos concreta.
--
--  POR QUE HIZO FALTA
--    Las políticas decían `for all to authenticated using (true)`. En
--    Supabase, `authenticated` significa literalmente cualquier persona con
--    un token válido, no "el administrador". Y la clave anónima del proyecto
--    está en db.js, a la vista de todos.
--
--    Con los registros por correo habilitados —como venían por defecto—
--    cualquiera podía llamar al endpoint público /auth/v1/signup, crearse
--    una cuenta, recibir un token y escribir en la base. Sin saber ninguna
--    contraseña, y sin que la app tuviera pantalla de registro: el endpoint
--    de Supabase responde aunque el sitio no lo use.
--
--    Los registros ya se apagaron en Authentication → Providers → Email.
--    Esto es la segunda capa: aunque mañana alguien vuelva a encenderlos por
--    error, la base sigue cerrada. La primera capa es una casilla que se
--    puede desmarcar sin querer; esta vive en la base de datos.
--
--  QUIEN PUEDE ESCRIBIR
--    Solo los correos de la lista de abajo. Para sumar a alguien, agrega su
--    correo en LOS DOS bloques y vuelve a ejecutar el archivo.
--
--    Ese correo tiene que existir como usuario en Authentication → Users,
--    y coincidir con EMAIL_ADMIN en db.js.
--
--  QUE NO CAMBIA
--    La lectura sigue siendo pública. El test la necesita para mostrar
--    precios y fotos a los visitantes.
--
--  COMO SE EJECUTA
--    supabase.com -> tu proyecto -> SQL Editor -> New query
--    Pega este archivo COMPLETO y dale Run.
--
--  ES SEGURO REPETIRLO
--    Borra la política anterior y la vuelve a crear igual.
-- ============================================================

-- ---------- 1) Precios, fotos y activaciones ----------
drop policy if exists "perfumes escritura admin" on public.perfume_overrides;

create policy "perfumes escritura admin" on public.perfume_overrides
  for all to authenticated
  using (
    (auth.jwt() ->> 'email') in (
      'jeronimo.pena.chaves@gmail.com'
    )
  )
  with check (
    (auth.jwt() ->> 'email') in (
      'jeronimo.pena.chaves@gmail.com'
    )
  );

-- ---------- 2) Parámetros de precio ----------
drop policy if exists "configuracion escritura admin" on public.configuracion;

create policy "configuracion escritura admin" on public.configuracion
  for all to authenticated
  using (
    (auth.jwt() ->> 'email') in (
      'jeronimo.pena.chaves@gmail.com'
    )
  )
  with check (
    (auth.jwt() ->> 'email') in (
      'jeronimo.pena.chaves@gmail.com'
    )
  );

-- ---------- 3) Comprobación ----------
-- Deben salir cuatro filas: la de lectura y la de escritura de cada tabla.
-- Las de escritura tienen que mostrar el correo en su condición; si dicen
-- solo "true", la restricción no quedó puesta.
select tablename,
       policyname,
       cmd,
       qual as condicion
  from pg_policies
 where schemaname = 'public'
   and tablename in ('perfume_overrides', 'configuracion')
 order by tablename, policyname;
