-- Pilot phase: no online payment. A client's booking is a confirmed
-- appointment, paid at the garage (cash or card).
--
-- 1. appointments.payment_mode records what the client was told: 'on_site'
--    for every booking from now on, 'online' for the ones that went through
--    Stripe Checkout before this change (kept for their refund path, see
--    refundIfPaid in app/actions/appointments.ts). The backfill only touches
--    payment_mode, which doesn't fire appointments_assign_mechanic (0037
--    fires on start_time/end_time/assigned_mechanic_id/status only).
--
-- 2. Clients lose direct INSERT on appointments. Until now a client's own
--    session inserted a 'pending_payment' row and Stripe's webhook moved it
--    on. A confirmed, unpaid booking is a stronger claim on a mechanic's
--    time, so it is no longer something the public REST API accepts from a
--    client session: bookAppointment validates the slot, service, garage
--    and vehicle server-side and writes with the service role. Garage
--    members keep their own insert policy (walk-ins, 0038).
--
--    DEPLOY ORDER: ship the code first, then apply this. The code that is
--    live before this change still inserts as the client and would fail
--    once the policy is gone; the new code never names payment_mode, so it
--    works before and after the column exists (rows booked in between get
--    the 'on_site' default when the column is added).
--
-- Re-enabling online payment later means re-creating a client insert path
-- (or keeping bookings server-side) and writing 'online' here.

alter table appointments
  add column payment_mode text not null default 'on_site'
    check (payment_mode in ('on_site', 'online'));

update appointments
set payment_mode = 'online'
where stripe_checkout_session_id is not null;

drop policy "Clients can create a pending-payment appointment for themselves" on appointments;
