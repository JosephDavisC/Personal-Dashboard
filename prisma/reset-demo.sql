-- Wipes every table (keeps the migration history) so seed.sql can reload the
-- demo data. Used by the demo-reset service in docker-compose.demo.yml.
-- NEVER run this against a database with real data.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('TRUNCATE TABLE %I CASCADE', r.tablename);
  END LOOP;
END $$;
