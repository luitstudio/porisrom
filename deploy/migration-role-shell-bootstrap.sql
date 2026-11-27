-- Run manually as the controlled migration executor before migrations on a
-- fresh database. These are restricted shells only: runtime login credentials
-- and all effective grants remain the reviewed post-migration provisioning
-- responsibility in backup-admission-role-provision.sql.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'porisrom_admission_runtime') THEN
    CREATE ROLE porisrom_admission_runtime NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'porisrom_backend_runtime') THEN
    CREATE ROLE porisrom_backend_runtime NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'porisrom_verifier_runtime') THEN
    CREATE ROLE porisrom_verifier_runtime NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'porisrom_finalizer_runtime') THEN
    CREATE ROLE porisrom_finalizer_runtime NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'porisrom_dispatcher_runtime') THEN
    CREATE ROLE porisrom_dispatcher_runtime NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END $$;
