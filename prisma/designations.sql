-- Designations used to be a fixed Postgres enum; they're now rows admins manage in the app.
-- Run BEFORE `prisma db push` (the npm scripts do). Idempotent: a no-op once migrated, and safe on a fresh database.
-- Existing members keep their designation: the old enum names ("PRESIDENT", "CORE_MEMBER"…) become the row ids.

DO $$ BEGIN
  CREATE TYPE "DesignationTier" AS ENUM ('OFFICE', 'CORE', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DesignationOption" (
  "id"    TEXT PRIMARY KEY,
  "label" TEXT NOT NULL,
  "tier"  "DesignationTier" NOT NULL,
  "rank"  INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "DesignationOption_label_key" ON "DesignationOption" ("label");

INSERT INTO "DesignationOption" ("id", "label", "tier", "rank") VALUES
  ('PRESIDENT',       'President',       'OFFICE', 10),
  ('VICE_PRESIDENT',  'Vice President',  'OFFICE', 20),
  ('SECRETARY',       'Secretary',       'OFFICE', 30),
  ('JOINT_SECRETARY', 'Joint Secretary', 'OFFICE', 40),
  ('TREASURER',       'Treasurer',       'OFFICE', 50),
  ('CORE_MEMBER',     'Core Member',     'CORE',   60),
  ('MEMBER',          'Member',          'MEMBER', 70)
ON CONFLICT DO NOTHING;

ALTER TABLE "DesignationOption" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Member') THEN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Designation') THEN
      ALTER TABLE "Member" ALTER COLUMN "designation" DROP DEFAULT;
      ALTER TABLE "Member" ALTER COLUMN "designation" TYPE TEXT USING "designation"::text;
      ALTER TABLE "Member" ALTER COLUMN "designation" SET DEFAULT 'MEMBER';
      DROP TYPE "Designation";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Member_designation_fkey') THEN
      ALTER TABLE "Member" ADD CONSTRAINT "Member_designation_fkey"
        FOREIGN KEY ("designation") REFERENCES "DesignationOption" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
