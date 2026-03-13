# Supabase Migrations

This directory is the canonical home for Wave 1 database migrations.

Rules:
- add forward-only SQL migrations here
- apply locally first, then staging, then production
- never rewrite an already-applied migration in place
- use compensating migrations for rollback behavior

Wave 1 expected ownership:
- tenants
- users
- workspaces
- workspace memberships
- durable workspace persistence records
- billing customer and subscription references
- entitlement state
- webhook event receipts
