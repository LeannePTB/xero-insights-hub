/**
 * One-line plain-English purpose for every SECURITY DEFINER function in `public`
 * and `app_private`. The register (docs/security/definer-register.md) is generated
 * from the live catalogue; the database cannot state a purpose, so the purposes
 * live here and `bun run scripts/definer-register.ts --check` FAILS when a live
 * definer function has no entry, or when an entry names a function that no longer
 * exists. A new definer function therefore cannot ship unguarded and unexplained.
 *
 * Keys are `schema.name` — overloads share one purpose.
 */
export const DEFINER_PURPOSES: Record<string, string> = {
  // ── app_private: the access rules themselves (invariant 6). Never called from
  //    TypeScript; called by RLS policies and by the public wrappers.
  "app_private.assert_xero_connection_firm_match":
    "Trigger guard: a client may only be linked to a Xero file belonging to its own organisation.",
  "app_private.client_for_tenant": "Which client a Xero file belongs to, for system contexts.",
  "app_private.client_xero_files_used": "How many Xero files a client already uses, for the plan limit.",
  "app_private.effective_widgets_for_client": "The dashboard cards a client may see at a given plan level.",
  "app_private.enforce_client_limit": "Trigger: refuses a new client past the organisation's plan limit.",
  "app_private.enforce_xero_org_limit": "Trigger: refuses a new Xero file link past the plan limit.",
  "app_private.enforce_xero_org_limit_on_move": "Trigger: same limit check when a Xero file is moved between clients.",
  "app_private.firm_ids_for_tenant": "Which organisations a Xero file belongs to.",
  "app_private.firm_limits": "The client and Xero file limits for an organisation's plan.",
  "app_private.firm_subscription_lapsed": "Whether an organisation's subscription has lapsed.",
  "app_private.firm_support_access_active": "Whether this person holds a live, unexpired support grant for this organisation.",
  "app_private.get_tier_widgets": "The card list configured for one client at one plan level.",
  "app_private.get_user_firm_id": "The organisation a person belongs to.",
  "app_private.get_user_tier": "The plan level that applies to a person for a Xero file.",
  "app_private.has_client_access": "Whether a person has been granted viewer access to a client.",
  "app_private.has_firm_access": "Whether a person may reach an organisation (membership or live support grant).",
  "app_private.has_role": "Whether a person holds a given platform role.",
  "app_private.has_tenant_access": "Whether a person may reach a Xero file.",
  "app_private.is_advisor": "Whether a person is an advisor.",
  "app_private.is_firm_owner": "Whether a person owns an organisation.",
  "app_private.is_org_owner": "Whether a person owns an organisation (membership row form).",
  "app_private.is_super_admin": "Whether a person is a platform super admin.",
  "app_private.me_is_super_admin": "Whether the calling person is a platform super admin.",
  "app_private.platform_staff_can_access_firm": "Whether platform staff hold a live support grant for this organisation.",
  "app_private.practice_firm_id": "The identifier of Positive Traction's own organisation.",
  "app_private.shares_firm_with": "Whether two people belong to the same organisation.",
  "app_private.tier_ceiling_widgets": "The most cards any client on a plan level may see.",
  "app_private.user_can_access_tenant": "Whether a person may read a Xero file's data.",
  "app_private.user_can_manage_client": "Whether a person may manage a client's settings.",
  "app_private.user_can_read_client": "Whether a person may read a client.",
  "app_private.user_can_write_client": "Whether a person may change a client's data.",

  // ── public: caller-scoped authorisation helpers used by server functions.
  "public.assert_advisor": "Stops the call unless the caller is an advisor.",
  "public.assert_client_write_access": "Stops the call unless the caller may change this client's data.",
  "public.assert_super_admin": "Stops the call unless the caller is a platform super admin.",
  "public.assert_tenant_belongs_to_client": "Stops the call unless the named Xero file really belongs to the named client.",
  "public.assert_widget_access": "Stops the call unless the caller's plan allows this dashboard card for this Xero file.",
  "public.me_has_role": "Whether the caller holds a given platform role.",
  "public.me_is_super_admin": "Whether the caller is a platform super admin.",
  "public.my_client_access": "The client viewer grants the caller holds.",
  "public.my_firm_ids": "The organisations the caller may reach.",
  "public.my_firm_memberships": "The caller's organisation memberships and roles.",
  "public.my_roles": "The caller's platform roles.",
  "public.user_can_access_client": "Legacy alias: whether a person may reach a client (superseded by the read/write pair).",
  "public.user_can_access_firm": "Legacy alias: whether a person may reach an organisation (superseded by the read/write pair).",
  "public.user_can_access_tenant": "Whether the caller may read a Xero file.",
  "public.user_can_read_client": "Whether the caller may read a client.",
  "public.user_can_write_client": "Whether a person may change a client's data.",
  "public.user_can_write_client_scenario": "Whether the caller may change a client's scenario settings.",
  "public.user_can_write_firm": "Whether a person may change an organisation's data.",
  "public.user_can_disconnect_xero_connection": "Whether the caller may disconnect a particular Xero connection.",
  "public.client_for_access": "The client a viewer grant refers to.",
  "public.client_for_tenant": "The client a Xero file belongs to, refusing an ambiguous file.",
  "public.firm_access_path": "Which access path (membership or support grant) lets a person reach an organisation.",

  // ── public: clients, viewers and entitlement.
  "public.client_access_tiers": "The plan levels a client's viewers hold.",
  "public.client_allowed_widgets": "The dashboard cards a client may see.",
  "public.client_can_use_widget": "Whether a client's plan allows one dashboard card.",
  "public.client_entitlement": "A client's plan level and what it includes.",
  "public.client_removal_impact": "What would be lost if a client were removed.",
  "public.client_viewers": "The people who hold viewer access to a client.",
  "public.client_xero_files_used": "How many Xero files a client uses.",
  "public.grant_client_access": "Gives a person viewer access to a client, audited.",
  "public.revoke_client_access": "Takes away a person's viewer access to a client, audited.",
  "public.set_client_access_tier": "Changes the plan level of one viewer grant, audited.",
  "public.remove_client": "Removes a client and its links, audited.",
  "public.effective_tier_for_tenant": "The plan level that applies to the caller for a Xero file.",

  // ── public: organisation, plan and billing administration (Path C).
  "public.admin_advisor_user_ids": "The user ids of all advisors, for platform administration.",
  "public.admin_firm_members": "The members of one organisation, for platform administration.",
  "public.admin_grant_advisor": "Makes a person an advisor, audited.",
  "public.admin_list_advisors": "Lists advisors with their verified email, for platform administration.",
  "public.admin_remove_advisor": "Removes a person's advisor role, keeping at least one, audited.",
  "public.admin_set_self_firm_membership": "Lets a super admin join or leave Positive Traction's own organisation, audited.",
  "public.admin_set_super_admin": "Grants or removes the super admin role, never the last one, audited.",
  "public.change_firm_plan": "Changes an organisation's plan, audited.",
  "public.firm_allowed_widgets": "The dashboard cards an organisation's plan allows.",
  "public.firm_can_use_widget": "Whether an organisation's plan allows one dashboard card.",
  "public.firm_has_consolidation": "Whether an organisation's plan includes consolidation.",
  "public.firm_member_invites": "The pending team member invitations for an organisation.",
  "public.firm_plan_limits": "An organisation's client and Xero file limits.",
  "public.firm_subscription_state": "An organisation's subscription status and period.",
  "public.firm_support_grants": "The support grants recorded against an organisation.",
  "public.firm_support_viewer_state": "Whether the caller currently holds a support grant for an organisation.",
  "public.firm_support_access_audit": "Trigger: records every support grant change in the audit log.",
  "public.organisation_members": "The members of an organisation with their verified email.",
  "public.plan_level_usage_count": "How many organisations or clients sit on one plan level.",
  "public.transfer_organisation_ownership": "Moves ownership of an organisation to another member, audited.",
  "public.set_firm_always_free": "Marks Positive Traction's own organisation as never billed, audited.",
  "public.set_firm_default_widgets": "Sets an organisation's default dashboard cards.",
  "public.set_all_client_tiers": "Sets the plan level for every client in an organisation, audited.",
  "public.set_client_comp": "Marks a client as complimentary with a reason, audited.",
  "public.set_client_dashboard_tier": "Changes one client's plan level, audited.",
  "public.set_client_trial": "Puts a client on a trial for a number of days, audited.",
  "public.set_client_tier_widgets": "Sets which cards are excluded for a client at a plan level.",
  "public.set_client_widget_enabled": "Turns one dashboard card on or off for a client.",
  "public.set_org_widget_enabled": "Turns one dashboard card on or off for an organisation.",
  "public.set_platform_tier_widgets": "Sets the platform-wide card list for a plan level.",
  "public.set_tier_enabled": "Turns a plan level on or off platform-wide.",
  "public.reset_org_tier_widgets": "Resets an organisation's card list for a plan level to the default.",
  "public.set_profile_display_name_admin": "Lets a super admin correct someone's display name, audited.",
  "public.revoke_firm_member_invite": "Cancels a pending team member invitation, audited.",

  // ── public: reports, uploads and client data.
  "public.delete_client_report": "Deletes a stored client report with a reason, audited.",
  "public.delete_statement_upload": "Deletes an uploaded statement and its lines.",
  "public.enforce_unreconciled_line_viewer_columns":
    "Trigger: a client viewer may only change the comment column on an unreconciled line.",

  // ── public: security posture, presence and audit.
  "public.security_posture": "The security posture checks shown on the Security card.",
  "public.read_audit_posture": "Whether reads of client figures are being recorded as they should be.",
  "public.get_mfa_posture_counts": "How many people have a verified second factor.",
  "public.online_users": "Who is signed in right now, for super admins.",
  "public.record_access_test_run": "Records the result of an access test run (for the approved live smoke suite).",
  "public.audit_table_change": "Trigger: records inserts, updates and deletes on audited tables.",
  "public.audit_user_roles_change": "Trigger: records every change to platform roles.",
  "public.purge_expired_security_logs": "Deletes audit and sign-in rows past their retention period.",
  "public.check_rate_limit": "Counts attempts in a time window so a public route can refuse abuse.",
  "public.handle_new_user": "Trigger: creates a profile row when a new person signs up.",

  // ── public: Xero connections and snapshots (system contexts).
  "public.claim_xero_snapshot_run": "Claims a snapshot run so two workers cannot run it at once.",
  "public.upsert_xero_snapshot": "Stores a Xero report snapshot for a client.",
  "public.prune_xero_snapshot_runs": "Removes old and abandoned snapshot runs.",
  "public.log_xero_api_error": "Records a Xero API failure as telemetry.",
  "public.xero_missing_scopes": "Which Xero permissions a connection is missing.",
  "public.xero_required_scopes": "The Xero permissions the app requires.",
  "public.xero_tenant_already_linked": "Whether a Xero file is already linked in an organisation.",
  "public.enforce_client_max_xero_orgs": "Trigger: keeps a client within its own Xero file cap.",
  "public.enforce_client_xero_org_allowance": "Trigger: keeps an organisation within its plan's Xero file allowance.",

  // ── public: email queue (system contexts only).
  "public.enqueue_email": "Puts an email on the sending queue.",
  "public.read_email_batch": "Takes the next batch of queued emails for sending.",
  "public.delete_email": "Removes a sent email from the queue.",
  "public.move_to_dlq": "Moves an email that cannot be sent to the dead-letter queue.",
  "public.email_queue_dispatch": "Sends the next batch of queued emails.",
  "public.email_queue_wake": "Wakes the email queue after a pause.",

  // ── app_private: standing viewer grant (path D, read-only).
  "app_private.has_standing_client_access": "Whether a person holds a standing viewer grant covering this client's organisation. READ paths only.",
  "app_private.has_client_read_access": "Whether a person may READ this client: a specific viewer grant or a standing grant. Never used by a write path.",
  "app_private.is_practice_member_of": "Whether a practice-team person is an active member of this particular organisation.",
  "app_private.can_manage_client_viewers": "Whether the caller may grant or revoke viewer access in this organisation: its owner, or an active practice-team member of it.",
  "app_private.viewer_tier": "The dashboard level a viewer sees for a client: specific grant first, then standing grant, capped by the client's own entitlement.",

  // ── Viewer management and viewer invites (Batch 3). Every one asserts aal2
  // and authorises through app_private.can_manage_client_viewers.
  "app_private.can_manage_viewers_for_client": "Whether the caller may manage viewer access for one client: its organisation's owner, or an active practice-team member of that organisation.",
  "public.me_can_manage_client_viewers": "Caller-scoped: may I manage viewer access for this client? UI gate only; every write re-checks.",
  "public.me_can_manage_firm_viewers": "Caller-scoped: may I manage viewer access in this organisation? UI gate only; every write re-checks.",
  "public.grant_firm_viewer_access": "Give one person read-only access to every client in an organisation (standing grant). Audited.",
  "public.set_firm_viewer_tier": "Change the dashboard level on a standing viewer grant. Audited.",
  "public.revoke_firm_viewer_access": "Remove a standing viewer grant in full, leaving specific per-client grants intact. Audited.",
  "public.firm_viewers": "List the standing viewer grants of one organisation, with the verified sign-in email.",
  "public.firm_viewer_invites": "List the pending viewer invitations of one organisation. Never returns the token.",
  "public.revoke_viewer_invite": "Cancel a pending viewer invitation. Audited.",
  "public.apply_viewer_invite": "System context (service role only): apply an accepted viewer invitation — role, grants, acceptance stamp and audit row in one transaction, re-validating the client ids against the organisation.",
};

/**
 * Scheduled (pg_cron) callers. The dump role has no USAGE on schema `cron`, so the
 * register cannot read them from the catalogue; these were read once with an
 * administrative connection (`select jobname, command from cron.job`) on 12 Sep 2026 and
 * are listed here so a scheduled-only function is not reported as having no caller.
 * Verified: `purge-expired-security-logs` runs `select public.purge_expired_security_logs();`
 * daily at 03:17; `xero-snapshot-refresh-daily` posts to the public snapshot-refresh route.
 */
export const SCHEDULED_CALLERS: Record<string, string> = {
  "public.purge_expired_security_logs": "purge-expired-security-logs (daily 03:17)",
  "public.admin_practice_team": "The Traction Advisory practice team list, for platform admins only.",
  "public.admin_add_practice_member": "Adds one of our own staff to the practice team; platform admins only, audited.",
  "public.admin_remove_practice_member": "Removes someone from the practice team; platform admins only, audited.",
};
