// Links out to a maps app for a garage's location. Google's universal
// "Maps URLs" (api=1) need no API key and open the Google Maps app on
// Android/iOS when installed, the website otherwise -- one link that works
// on every device, unlike maps.apple.com (useless on Android/Windows).

export type MapPlace = {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

/**
 * The most precise destination we have: the stored map pin, else the
 * written address. Null when there is nothing to point at.
 */
function destination(place: MapPlace): string | null {
  if (
    typeof place.latitude === "number" &&
    typeof place.longitude === "number" &&
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude)
  ) {
    return `${place.latitude},${place.longitude}`;
  }
  const text = [place.name, place.address, place.city]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  // A garage name alone is too vague to route to.
  return place.address?.trim() || place.city?.trim() ? text : null;
}

/** Turn-by-turn directions from the user's current location. */
export function directionsUrl(place: MapPlace): string | null {
  const target = destination(place);
  return target
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}`
    : null;
}

/** The place itself on a map (for the address/city link). */
export function mapSearchUrl(place: MapPlace): string | null {
  const target = destination(place);
  return target
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}`
    : null;
}
