"use client";

import { useState } from "react";
import { APIProvider, Map, Marker, type MapMouseEvent } from "@vis.gl/react-google-maps";

const LUXEMBOURG_CITY = { lat: 49.6116, lng: 6.1319 };

export function GarageMapPicker({
  initialLatitude,
  initialLongitude,
}: {
  initialLatitude: number | null;
  initialLongitude: number | null;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    initialLatitude !== null && initialLongitude !== null
      ? { lat: initialLatitude, lng: initialLongitude }
      : null
  );

  if (!apiKey) {
    // Still submit the stored pin: without these inputs, saving the form
    // would send no coordinates and the action would clear the garage's
    // existing location.
    return (
      <div className="flex flex-col gap-1">
        {position && (
          <>
            <input type="hidden" name="latitude" value={position.lat} />
            <input type="hidden" name="longitude" value={position.lng} />
          </>
        )}
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          Map picker unavailable (Google Maps isn&apos;t configured yet).
        </p>
        {position && (
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            Current pin: {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
          </p>
        )}
      </div>
    );
  }

  // Map's onClick is wrapped by the library (event.detail.latLng is a plain
  // literal); Marker's onDragEnd passes the native google.maps event
  // instead (event.latLng is a LatLng instance with lat()/lng() methods).
  function handleMapClick(event: MapMouseEvent) {
    if (event.detail.latLng) {
      setPosition(event.detail.latLng);
    }
  }

  function handleMarkerDragEnd(event: google.maps.MapMouseEvent) {
    if (event.latLng) {
      setPosition({ lat: event.latLng.lat(), lng: event.latLng.lng() });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="hidden"
        name="latitude"
        value={position?.lat ?? ""}
      />
      <input
        type="hidden"
        name="longitude"
        value={position?.lng ?? ""}
      />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Click the map to place a pin at your garage, or drag it into place.
      </p>
      <div className="h-72 w-full overflow-hidden rounded-xl border border-black/[.08] dark:border-white/[.145]">
        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={position ?? LUXEMBOURG_CITY}
            defaultZoom={position ? 15 : 12}
            gestureHandling="greedy"
            disableDefaultUI={false}
            onClick={handleMapClick}
          >
            {position && (
              <Marker
                position={position}
                draggable
                onDragEnd={handleMarkerDragEnd}
              />
            )}
          </Map>
        </APIProvider>
      </div>
    </div>
  );
}
