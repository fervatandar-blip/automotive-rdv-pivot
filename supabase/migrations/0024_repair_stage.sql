-- Repair-stage tracker: separate from `status`, which only tracks the
-- booking lifecycle (pending/confirmed/pending_payment/cancelled/
-- completed). This tracks where the physical repair actually is,
-- visible to both garage staff and the client.

alter table appointments add column repair_stage text
  check (repair_stage in ('received', 'diagnosis', 'in_repair', 'quality_check', 'ready_for_pickup'));
