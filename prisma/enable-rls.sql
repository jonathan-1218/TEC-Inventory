-- Supabase exposes the public schema through its Data API (anon/authenticated keys).
-- The app talks to Postgres directly as the table owner, which bypasses RLS, so enabling
-- RLS with no policies locks these tables to the app only. Safe to run repeatedly.
ALTER TABLE "Component" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Member" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Team" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProgressUpdate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectComponent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Issuance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Mentor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClubSettings" ENABLE ROW LEVEL SECURITY;
