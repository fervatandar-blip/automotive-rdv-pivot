-- Closes two exploitable SECURITY DEFINER RPCs and trims anon EXECUTE on the
-- rest, per the Supabase security advisor (lints 0028/0029).
--
-- Root cause: Postgres grants EXECUTE on every new function to PUBLIC, and
-- Supabase's default privileges also grant it to anon/authenticated. Every
-- earlier migration only ever added `grant ... to authenticated` and never
-- revoked the implicit grants, so all of these were reachable anonymously at
-- /rest/v1/rpc/<name> with nothing but the public anon key.
--
-- 1. find_invitable_profile_by_email -- had NO caller check. Anyone (anon
--    included) could look up any email and get back that account's profile
--    id and role: account enumeration, plus a direct way to find which
--    emails are super_admin. Its only caller (app/actions/staff.ts
--    inviteMechanic) is already gated by requireGarageOwner, so it now goes
--    through the service-role client and this function is revoked from
--    every API-facing role. An in-function "caller owns a garage" check was
--    deliberately not used instead: garage-owner accounts are self-serve via
--    /garage/signup, so that check would gate nothing.
--
-- 2. increment_invoice_number -- had NO caller check. Anyone could bump any
--    garage's counter (garage ids are public via the discovery pages),
--    burning invoice numbers and leaving gaps in a sequence that EU/LU
--    invoicing rules expect to be continuous. Now requires the caller to be
--    a member of that garage, matching its callers in
--    app/actions/appointments.ts (completeAppointment /
--    retryInvoiceGeneration, both behind requireGarageMember).
--
-- 3. handle_new_user -- a trigger function; never meant to be an RPC.
--
-- 4. The remaining appointment/role RPCs already guard on auth.uid() or
--    is_super_admin() internally, so anon calls are no-ops today. Revoked
--    from anon anyway so a future edit that drops a guard can't silently
--    reopen anonymous access.
--
-- Intentionally NOT revoked from anon:
--   - get_booked_ranges: called by lib/availability.ts on the public
--     /garages/[id] booking page, which anonymous visitors can open. It
--     returns only start/end times, no client or appointment identifiers.
--   - is_super_admin, is_garage_member, can_view_related_profile: called
--     from inside RLS policies (including SELECT policies on publicly
--     readable tables like services/availability). Revoking anon EXECUTE
--     would make anonymous reads of those tables fail with "permission
--     denied for function", breaking the public discovery pages.

-- 1. find_invitable_profile_by_email: service role only.
revoke execute on function find_invitable_profile_by_email(text) from public, anon, authenticated;
grant execute on function find_invitable_profile_by_email(text) to service_role;

-- 2. increment_invoice_number: garage members only, and pin search_path.
create or replace function increment_invoice_number(target_garage_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_number integer;
begin
  if not is_garage_member(target_garage_id) then
    raise exception 'Not a member of this garage.';
  end if;

  update garages
  set next_invoice_number = next_invoice_number + 1
  where id = target_garage_id
  returning next_invoice_number - 1 into claimed_number;

  return claimed_number;
end;
$$;

revoke execute on function increment_invoice_number(uuid) from public, anon;
grant execute on function increment_invoice_number(uuid) to authenticated, service_role;

-- 3. handle_new_user: trigger-only.
revoke execute on function handle_new_user() from public, anon, authenticated;

-- 4. Authenticated-only RPCs.
revoke execute on function admin_set_profile_role(uuid, text) from public, anon;
revoke execute on function assign_appointment_mechanic(uuid, uuid) from public, anon;
revoke execute on function cancel_appointment_as_client(uuid) from public, anon;
revoke execute on function cancel_appointment_as_garage(uuid) from public, anon;
revoke execute on function complete_appointment(uuid) from public, anon;
revoke execute on function confirm_appointment(uuid) from public, anon;
revoke execute on function reschedule_appointment(uuid, timestamptz, timestamptz) from public, anon;
revoke execute on function set_appointment_checkout_session(uuid, text) from public, anon;
revoke execute on function update_appointment_repair_stage(uuid, text) from public, anon;

grant execute on function admin_set_profile_role(uuid, text) to authenticated, service_role;
grant execute on function assign_appointment_mechanic(uuid, uuid) to authenticated, service_role;
grant execute on function cancel_appointment_as_client(uuid) to authenticated, service_role;
grant execute on function cancel_appointment_as_garage(uuid) to authenticated, service_role;
grant execute on function complete_appointment(uuid) to authenticated, service_role;
grant execute on function confirm_appointment(uuid) to authenticated, service_role;
grant execute on function reschedule_appointment(uuid, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function set_appointment_checkout_session(uuid, text) to authenticated, service_role;
grant execute on function update_appointment_repair_stage(uuid, text) to authenticated, service_role;
