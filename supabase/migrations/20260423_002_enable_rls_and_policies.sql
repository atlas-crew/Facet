-- Enable row-level security on all public tables + add policies per doc-29 §1.
--
-- Defense-in-depth: the Fly-deployed proxy enforces authorization in JS via
-- service role (which bypasses RLS). These policies are the backstop if the
-- proxy ever has a bug, or if a publishable/anon key path is ever wired
-- accidentally. Per the Supabase skill's "RLS by default in exposed schemas"
-- rule — public.* must have RLS on every table.
--
-- Policy design notes:
--   - actors.user_id is TEXT storing auth.uid()::text (confirmed by the
--     "users resolved from Supabase JWT" comment in the initial migration)
--   - UPDATE policies require a matching SELECT policy — UPDATE silently
--     returns 0 rows otherwise (Supabase RLS gotcha)
--   - webhook_event_receipts has RLS enabled with no policies: deny-all for
--     non-service-role. Only the Stripe webhook handler writes here, via
--     service role. INFO-level lint is expected and intentional.

BEGIN;

ALTER TABLE public.actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_event_receipts ENABLE ROW LEVEL SECURITY;

-- actors: read self only. Writes happen via the first-login bootstrap trigger
-- (next migration) which runs as service role.
CREATE POLICY actors_self_read ON public.actors
  FOR SELECT
  USING (user_id = auth.uid()::text);

-- workspaces: readable by members; writable by owners.
CREATE POLICY workspaces_member_read ON public.workspaces
  FOR SELECT
  USING (
    (tenant_id, workspace_id) IN (
      SELECT tenant_id, workspace_id
      FROM public.workspace_memberships
      WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY workspaces_owner_write ON public.workspaces
  FOR ALL
  USING (
    (tenant_id, workspace_id) IN (
      SELECT tenant_id, workspace_id
      FROM public.workspace_memberships
      WHERE user_id = auth.uid()::text AND role = 'owner'
    )
  );

-- workspace_memberships: self-read; owners can read all memberships on
-- their workspaces. Writes are bootstrap-trigger only for v1.
CREATE POLICY memberships_self_read ON public.workspace_memberships
  FOR SELECT
  USING (
    user_id = auth.uid()::text
    OR (tenant_id, workspace_id) IN (
      SELECT tenant_id, workspace_id
      FROM public.workspace_memberships
      WHERE user_id = auth.uid()::text AND role = 'owner'
    )
  );

-- workspace_snapshots: members read; owners write.
CREATE POLICY snapshots_member_read ON public.workspace_snapshots
  FOR SELECT
  USING (
    (tenant_id, workspace_id) IN (
      SELECT tenant_id, workspace_id
      FROM public.workspace_memberships
      WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY snapshots_owner_write ON public.workspace_snapshots
  FOR ALL
  USING (
    (tenant_id, workspace_id) IN (
      SELECT tenant_id, workspace_id
      FROM public.workspace_memberships
      WHERE user_id = auth.uid()::text AND role = 'owner'
    )
  );

-- billing_accounts: account members can read; never write from client.
-- Stripe webhook handler runs as service role for writes and bypasses RLS.
CREATE POLICY billing_member_read ON public.billing_accounts
  FOR SELECT
  USING (
    (tenant_id, account_id) IN (
      SELECT w.tenant_id, w.account_id
      FROM public.workspaces w
      JOIN public.workspace_memberships m USING (tenant_id, workspace_id)
      WHERE m.user_id = auth.uid()::text
    )
  );

-- webhook_event_receipts: no policies → deny-all for non-service-role.
-- Service role bypasses RLS. Stripe webhook handler is the only writer.

COMMIT;
