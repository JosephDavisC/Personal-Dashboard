-- Demo data for a fresh install. Every person, company and value here is invented.
-- Dates are relative to NOW(), so the demo always looks current.
-- Safe to re-run: it does nothing once any task exists.
-- Run with: pnpm db:seed   (or the "seed" service in docker compose)

DO $$
DECLARE
  tz   text := 'America/New_York';   -- keep in sync with SITE.timezone in src/config/site.ts
  d    date := (NOW() AT TIME ZONE tz)::date;
  site_a text := gen_random_uuid()::text;
  site_b text := gen_random_uuid()::text;
  site_c text := gen_random_uuid()::text;
  topic_a text := gen_random_uuid()::text;
  topic_b text := gen_random_uuid()::text;
  racket text := gen_random_uuid()::text;
  i int;
BEGIN
  IF EXISTS (SELECT 1 FROM "Task") THEN
    RAISE NOTICE 'Seed skipped: database already has data';
    RETURN;
  END IF;

  -- ===== Tasks =====
  INSERT INTO "Task" (id, title, description, status, priority, "dueDate", category, "order", "completedAt", "statusChangedAt", "updatedAt") VALUES
    (gen_random_uuid()::text, 'Renew passport', 'Photos are in the desk drawer. Form DS-82.', 'TODO', 'HIGH', NOW() + interval '3 days', 'personal', 0, NULL, NULL, NOW()),
    (gen_random_uuid()::text, 'Finish quarterly budget review', NULL, 'TODO', 'MEDIUM', NOW() + interval '6 days', 'work', 1, NULL, NULL, NOW()),
    (gen_random_uuid()::text, 'Book dentist appointment', NULL, 'TODO', 'LOW', NULL, 'personal', 2, NULL, NULL, NOW()),
    (gen_random_uuid()::text, 'Read chapter 4 of the data structures book', NULL, 'TODO', 'MEDIUM', NOW() + interval '1 day', 'school', 3, NULL, NULL, NOW()),
    (gen_random_uuid()::text, 'Draft portfolio case study', 'Outline, screenshots, results section.', 'IN_PROGRESS', 'HIGH', NOW() + interval '2 days', 'personal', 0, NULL, NOW() - interval '1 day', NOW()),
    (gen_random_uuid()::text, 'Plan weekend trip', NULL, 'IN_PROGRESS', 'LOW', NULL, 'personal', 1, NULL, NOW() - interval '2 days', NOW()),
    (gen_random_uuid()::text, 'Submit expense report', NULL, 'DONE', 'MEDIUM', NOW() - interval '1 day', 'work', 0, NOW() - interval '1 day', NOW() - interval '1 day', NOW()),
    (gen_random_uuid()::text, 'Update resume', NULL, 'DONE', 'HIGH', NULL, 'personal', 1, NOW() - interval '3 days', NOW() - interval '3 days', NOW());

  -- ===== Shifts (last three weeks plus the coming week) =====
  -- Pay matches HOURLY_WAGE = 20 and PAY_DEDUCTION_RATE = 0.1 in src/config/shifts.ts
  FOR i IN -20..6 LOOP
    IF extract(dow FROM d + i) IN (1, 3, 5) THEN
      INSERT INTO "Shift" (id, date, "startTime", "endTime", location, label, hours, "grossPay", "netPay", "updatedAt")
      VALUES (gen_random_uuid()::text,
              ((d + i)::timestamp) AT TIME ZONE tz,
              ((d + i) + time '11:00') AT TIME ZONE tz,
              ((d + i) + time '15:30') AT TIME ZONE tz,
              'CAFE', 'Cafe - Lunch', 4.5, 90, 81, NOW());
    END IF;
    IF extract(dow FROM d + i) = 6 THEN
      INSERT INTO "Shift" (id, date, "startTime", "endTime", location, label, hours, "grossPay", "netPay", "updatedAt")
      VALUES (gen_random_uuid()::text,
              ((d + i)::timestamp) AT TIME ZONE tz,
              ((d + i) + time '09:00') AT TIME ZONE tz,
              ((d + i) + time '14:00') AT TIME ZONE tz,
              'EVENTS', 'Event setup', 5, 100, 90, NOW());
    END IF;
    IF extract(dow FROM d + i) = 2 THEN
      INSERT INTO "Shift" (id, date, "startTime", "endTime", location, label, hours, "grossPay", "netPay", "updatedAt")
      VALUES (gen_random_uuid()::text,
              ((d + i)::timestamp) AT TIME ZONE tz,
              ((d + i) + time '17:00') AT TIME ZONE tz,
              ((d + i) + time '20:00') AT TIME ZONE tz,
              'FRONT_DESK', 'Front desk - Evening', 3, 60, 54, NOW());
    END IF;
  END LOOP;

  -- ===== Job applications =====
  INSERT INTO "JobApplication" (id, title, company, status, "dateApplied", "nextSteps", salary, location, "jobUrl", notes, "followUpDate", "assessmentType", "updatedAt") VALUES
    (gen_random_uuid()::text, 'Data Analyst Intern', 'Northwind Analytics', 'INTERVIEW', NOW() - interval '12 days', 'Panel interview Thursday', '$28-$32/hr', 'HYBRID', 'https://example.com/jobs/1', NULL, NOW() + interval '2 days', 'TAKE_HOME', NOW()),
    (gen_random_uuid()::text, 'Software Engineer Intern', 'Contoso Cloud', 'PHONE_SCREEN', NOW() - interval '9 days', 'Recruiter call scheduled', '$40/hr', 'ON_SITE', 'https://example.com/jobs/2', NULL, NOW() + interval '1 day', 'CODING', NOW()),
    (gen_random_uuid()::text, 'Product Analyst', 'Fabrikam Labs', 'APPLIED', NOW() - interval '4 days', NULL, NULL, 'REMOTE', 'https://example.com/jobs/3', NULL, NOW() + interval '10 days', 'NONE', NOW()),
    (gen_random_uuid()::text, 'UX Research Assistant', 'Tailspin Studio', 'APPLIED', NOW() - interval '20 days', 'Follow up with recruiter', NULL, 'HYBRID', 'https://example.com/jobs/4', NULL, NOW() - interval '1 day', 'NONE', NOW()),
    (gen_random_uuid()::text, 'Business Intelligence Intern', 'Litware Inc', 'REJECTED', NOW() - interval '30 days', NULL, '$25/hr', 'ON_SITE', NULL, NULL, NULL, 'NONE', NOW()),
    (gen_random_uuid()::text, 'Machine Learning Intern', 'Adventure Works AI', 'OFFER', NOW() - interval '40 days', 'Decide by end of month', '$45/hr', 'HYBRID', NULL, 'Great team, relocation covered.', NULL, 'SYSTEM_DESIGN', NOW());

  -- ===== Diary =====
  INSERT INTO "DiaryEntry" (id, date, content, mood, tags, "updatedAt") VALUES
    (gen_random_uuid()::text, ((d - 1)::timestamp) AT TIME ZONE tz, '**Personal Diary**' || chr(10) || 'Quiet day. Worked the lunch shift, then finally finished the expense report I had been putting off.', 'good', ARRAY['work'], NOW()),
    (gen_random_uuid()::text, ((d - 2)::timestamp) AT TIME ZONE tz, '**Personal Diary**' || chr(10) || 'Tennis in the evening with Sam. Serve felt better after the lesson last week.', 'happy', ARRAY['social'], NOW()),
    (gen_random_uuid()::text, ((d - 4)::timestamp) AT TIME ZONE tz, '**Personal Diary**' || chr(10) || 'Long day of interviews prep. Tired but it is coming together.', 'tired', ARRAY['school', 'personal'], NOW()),
    (gen_random_uuid()::text, ((d - 6)::timestamp) AT TIME ZONE tz, '**Personal Diary**' || chr(10) || 'Tried the new ramen place downtown with friends. Worth the wait.', 'excited', ARRAY['food', 'social'], NOW());

  -- ===== Quick links =====
  INSERT INTO "Link" (id, label, url, icon, "order", pinned, "updatedAt") VALUES
    (gen_random_uuid()::text, 'Email', 'https://mail.google.com', 'mail', 0, true, NOW()),
    (gen_random_uuid()::text, 'GitHub', 'https://github.com', 'github', 1, true, NOW()),
    (gen_random_uuid()::text, 'Docs', 'https://docs.google.com', 'file-text', 2, false, NOW());

  -- ===== Contacts =====
  INSERT INTO "Contact" (id, name, email, phone, company, title, notes, tags, "updatedAt") VALUES
    (gen_random_uuid()::text, 'Sam Lee', 'sam.lee@example.com', '555-0101', NULL, NULL, 'Tennis partner, Tuesdays.', ARRAY['friend', 'tennis'], NOW()),
    (gen_random_uuid()::text, 'Jordan Patel', 'jordan@example.com', NULL, 'Northwind Analytics', 'Recruiter', 'Met at the career fair.', ARRAY['recruiting'], NOW()),
    (gen_random_uuid()::text, 'Riley Chen', 'riley.chen@example.com', '555-0123', 'Contoso Cloud', 'Software Engineer', NULL, ARRAY['work'], NOW());

  -- ===== Important topics =====
  INSERT INTO "ImportantTopic" (id, title, icon, color, category, pinned, "updatedAt") VALUES
    (topic_a, 'Travel', 'plane', '#60A5FA', 'personal', true, NOW()),
    (topic_b, 'Job search', 'briefcase', '#34D399', 'work', false, NOW());
  INSERT INTO "ImportantItem" (id, "topicId", type, label, url, content, "updatedAt") VALUES
    (gen_random_uuid()::text, topic_a, 'note', 'Packing list', NULL, 'Charger, adapter, passport, rain jacket.', NOW()),
    (gen_random_uuid()::text, topic_b, 'link', 'Resume template', 'https://example.com/resume', NULL, NOW());

  -- ===== Site monitoring (30 days of hourly history) =====
  INSERT INTO "MonitoredSite" (id, label, url, "order", "updatedAt") VALUES
    (site_a, 'Example', 'https://example.com', 0, NOW()),
    (site_b, 'Wikipedia', 'https://www.wikipedia.org', 1, NOW()),
    (site_c, 'GitHub', 'https://github.com', 2, NOW());
  INSERT INTO "SitePing" (id, "siteId", status, "responseTime", "isUp", "checkedAt")
  SELECT gen_random_uuid()::text, s.id,
         CASE WHEN random() < 0.995 THEN 200 ELSE 503 END,
         (120 + random() * 180)::int, true, g
  FROM generate_series(NOW() - interval '30 days', NOW(), interval '1 hour') g
  CROSS JOIN (VALUES (site_a), (site_b), (site_c)) AS s(id);
  UPDATE "SitePing" SET "isUp" = false WHERE status = 503;

  -- ===== Tennis =====
  INSERT INTO "TennisRacket" (id, name, brand, model, "headSize", weight, pattern, "currentString", tension, "lastStrung", "updatedAt") VALUES
    (racket, 'Match racket', 'Wilson', 'Blade 98', 98, 305, '16x19', 'Poly Tour Pro 125', '52 lbs', NOW() - interval '18 days', NOW());
  INSERT INTO "TennisSession" (id, type, date, duration, location, "racketId", notes, "playedWith", "updatedAt") VALUES
    (gen_random_uuid()::text, 'PRACTICE', NOW() - interval '2 days', 1.5, 'City courts', racket, 'Worked on serve toss.', 'Sam', NOW()),
    (gen_random_uuid()::text, 'LESSON', NOW() - interval '9 days', 1, 'City courts', racket, 'Backhand footwork.', NULL, NOW());
END $$;
