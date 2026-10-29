/**
 * Plate and VIN normalization, shared by the vehicle form (what gets
 * stored), the garage client directory (what gets searched) and the DB
 * (vehicles.plate_search / vin, migration 0036) so all three agree.
 */

/** ISO 3779: 17 characters, digits and capitals except I, O, Q. */
export const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

/**
 * "lu-12 34" -> "LU1234". Mirrors the plate_search generated column:
 * upper-case, letters and digits only.
 */
export function normalizePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Upper-cases and strips spaces/dashes people paste in with a VIN. */
export function normalizeVin(value: string) {
  return value.toUpperCase().replace(/[\s-]/g, "");
}

/**
 * Normalized form of a directory search term, for matching against
 * plate_search and vin. Empty when the term has no letters or digits.
 */
export function normalizeVehicleSearch(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
