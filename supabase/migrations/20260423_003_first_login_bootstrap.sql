-- First-login bootstrap per doc-29 §2.
--
-- Problem: the initial hosted schema creates no trigger on auth.users. A new
-- GitHub OAuth user authenticates, receives a JWT, and the client calls
-- GET /api/persistence/workspaces — but the proxy throws
-- PersistenceAuthError(403, 'Hosted user is not provisioned for Facet.')
-- because postgresWorkspaceStore.getActor(auth.uid()) returns null.
--
-- Solution: a SECURITY DEFINER trigger fires on auth.users insert and creates
-- actor + tenant + default workspace + owner membership atomically. Lives in
-- the internal.* schema which is not exposed via PostgREST.
--
-- billing_accounts row is NOT created here — that arrives via Stripe webhook
-- on first paid checkout. Free-tier users never get a billing_accounts row.
--
-- SECURITY DEFINER bypasses RLS, which is required because the anon/
-- authenticated roles cannot INSERT into public.actors / public.workspaces /
-- public.workspace_memberships under the policies established by the previous
-- migration. The function owner (supabase admin) has full access.
--
-- SET search_path prevents search-path hijacking attacks — always qualify
-- SECURITY DEFINER functions with explicit schema paths.

BEGIN;

CREATE SCHEMA IF NOT EXISTS internal;
REVOKE ALL ON SCHEMA internal FROM anon, authenticated;

CREATE OR REPLACE FUNCTION internal.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_tenant_id TEXT := gen_random_uuid()::text;
  new_account_id TEXT := gen_random_uuid()::text;
  new_workspace_id TEXT := 'default';
BEGIN
  INSERT INTO public.actors (user_id, tenant_id, account_id, email)
    VALUES (NEW.id::text, new_tenant_id, new_account_id, COALESCE(NEW.email, ''));

  INSERT INTO public.workspaces (tenant_id, account_id, workspace_id, name)
    VALUES (new_tenant_id, new_account_id, new_workspace_id, 'Default workspace');

  INSERT INTO public.workspace_memberships (user_id, tenant_id, workspace_id, role, is_default)
    VALUES (NEW.id::text, new_tenant_id, new_workspace_id, 'owner', true);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION internal.handle_new_user();

COMMIT;
