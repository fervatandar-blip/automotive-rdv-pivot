import "server-only";

// Server-side geocoding for workshop addresses (Google Geocoding API).
//
// Uses GOOGLE_MAPS_SERVER_KEY: a key restricted to the Geocoding API by API,
// not by HTTP referrer (server requests carry no referrer, so the browser
// key -- NEXT_PUBLIC_GOOGLE_MAPS_API_KEY -- is normally refused here). Falls
// back to the browser key in case it happens to be unrestricted.
//
// Never throws: no key, a network error, a timeout or "no result" all
// return null, and saving the profile goes on with whatever pin it had.

const ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";
const TIMEOUT_MS = 5000;

export type Coordinates = { latitude: number; longitude: number };

export function geocodingKey() {
  return process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null;
}

export async function geocodeAddress(
  { address, city, country }: { address: string | null; city: string | null; country?: string | null },
  fetchImpl: typeof fetch = fetch
): Promise<Coordinates | null> {
  const key = geocodingKey();
  const query = [address, city].map((part) => part?.trim()).filter(Boolean).join(", ");
  if (!key || !query) return null;

  const params = new URLSearchParams({ address: query, key, language: "fr" });
  // Workshops are registered in LU, BE, FR or DE (lib/business-registration.ts):
  // pinning the country stops "Rue de la Gare, Esch" landing in another one.
  if (country && /^[A-Z]{2}$/.test(country)) params.set("components", `country:${country}`);

  try {
    const response = await fetchImpl(`${ENDPOINT}?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn("[geocode] HTTP", response.status);
      return null;
    }
    const body = (await response.json()) as {
      status: string;
      error_message?: string;
      results?: { geometry?: { location?: { lat: number; lng: number } } }[];
    };
    if (body.status !== "OK") {
      // ZERO_RESULTS is a normal outcome (typo, incomplete address); the
      // others mean a key or quota problem someone should look at.
      if (body.status !== "ZERO_RESULTS") console.warn("[geocode]", body.status, body.error_message ?? "");
      return null;
    }
    const location = body.results?.[0]?.geometry?.location;
    if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return null;
    return { latitude: location.lat, longitude: location.lng };
  } catch (error) {
    console.warn("[geocode] request failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

const SAME_PIN_EPSILON = 1e-6;

function normalized(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Whether saving the location should geocode the address: when it changed
 * and the pin wasn't moved by hand, or when there's no pin at all. A pin the
 * user moved themselves always wins over the geocoder.
 */
export function shouldGeocode({
  stored,
  submitted,
}: {
  stored: { address: string | null; city: string | null; latitude: number | null; longitude: number | null };
  submitted: { address: string | null; city: string | null; latitude: number | null; longitude: number | null };
}) {
  if (!normalized(submitted.address) && !normalized(submitted.city)) return false;
  if (submitted.latitude === null || submitted.longitude === null) return true;

  const pinMoved =
    stored.latitude === null ||
    stored.longitude === null ||
    Math.abs(submitted.latitude - stored.latitude) > SAME_PIN_EPSILON ||
    Math.abs(submitted.longitude - stored.longitude) > SAME_PIN_EPSILON;
  if (pinMoved) return false;

  return (
    normalized(submitted.address) !== normalized(stored.address) ||
    normalized(submitted.city) !== normalized(stored.city)
  );
}
