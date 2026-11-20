// "Book Service" on a vehicle card starts the booking flow with that
// vehicle pre-selected: /garages?vehicle=<id> -> /garages/<id>?vehicle=<id>
// -> the confirm step's vehicle picker. The id only ever pre-selects an
// option among the signed-in client's own vehicles (bookAppointment
// re-checks ownership), so an unknown id is harmless -- but it is echoed
// into links, so anything that isn't a UUID is dropped.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseBookingVehicle(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

/** `href` with `vehicle=<id>` added (before any #fragment); unchanged when id is null. */
export function withBookingVehicle(href: string, vehicleId: string | null): string {
  if (!vehicleId) return href;
  const hashIndex = href.indexOf("#");
  const path = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : href.slice(hashIndex);
  return `${path}${path.includes("?") ? "&" : "?"}vehicle=${vehicleId}${hash}`;
}
