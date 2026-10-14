"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { ItineraryMapProps } from "./itinerary-map-loader";

function isValidCoordinates(latitude: unknown, longitude: unknown): latitude is number {
  return typeof latitude === "number" && Number.isFinite(latitude) &&
    latitude >= -90 && latitude <= 90 &&
    typeof longitude === "number" && Number.isFinite(longitude) &&
    longitude >= -180 && longitude <= 180;
}

function numberedIcon(number: number) {
  return L.divIcon({
    className: "planless-marker-wrap",
    html: `<span class="planless-marker">${number}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

const nearbyIcon = L.divIcon({
  className: "planless-marker-wrap",
  html: '<span class="planless-marker planless-marker-nearby">+</span>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const currentLocationIcon = L.divIcon({
  className: "planless-marker-wrap",
  html: '<span class="planless-current-marker"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function MapFocus({ items, nearbyPlaces, currentPosition, activeKey }: ItineraryMapProps) {
  const map = useMap();
  useEffect(() => {
    const refreshSize = () => map.invalidateSize({ pan: false });
    const frame = window.requestAnimationFrame(refreshSize);
    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(refreshSize)
      : null;
    resizeObserver?.observe(map.getContainer());

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
    };
  }, [map]);

  useEffect(() => {
    if (activeKey?.startsWith("itinerary:")) {
      const item = items.find((place) => `itinerary:${place.id}` === activeKey);
      if (item && isValidCoordinates(item.latitude, item.longitude)) {
        map.flyTo([item.latitude!, item.longitude!], Math.max(map.getZoom(), 14), { duration: 0.45 });
        return;
      }
    }
    if (currentPosition && isValidCoordinates(currentPosition.latitude, currentPosition.longitude)) {
      map.flyTo([currentPosition.latitude, currentPosition.longitude], Math.max(map.getZoom(), 14), { duration: 0.45 });
      return;
    }
    if (activeKey?.startsWith("nearby:")) {
      const place = nearbyPlaces.find((candidate) => `nearby:${candidate.id}` === activeKey);
      if (place && isValidCoordinates(place.latitude, place.longitude)) {
        map.flyTo([place.latitude!, place.longitude!], Math.max(map.getZoom(), 14), { duration: 0.45 });
        return;
      }
    }
    const valid = items.filter((item) =>
      isValidCoordinates(item.latitude, item.longitude)
    );
    if (valid.length > 1) {
      map.fitBounds(valid.map((item) => [item.latitude!, item.longitude!] as [number, number]), { padding: [32, 32] });
    } else if (valid[0]) {
      map.setView([valid[0].latitude!, valid[0].longitude!], 13);
    }
  }, [activeKey, currentPosition, items, map, nearbyPlaces]);
  return null;
}

export default function ItineraryMap({
  items,
  nearbyPlaces,
  currentPosition,
  activeKey,
  onSelect,
}: ItineraryMapProps) {
  const firstLocated = items.find((item) => isValidCoordinates(item.latitude, item.longitude));
  const hasCurrentPosition = currentPosition &&
    isValidCoordinates(currentPosition.latitude, currentPosition.longitude);
  const center: [number, number] = hasCurrentPosition
    ? [currentPosition!.latitude, currentPosition!.longitude]
    : firstLocated
      ? [firstLocated.latitude!, firstLocated.longitude!]
      : [36.5, 127.8];

  return (
    <div className="itineraryMapCanvas">
      <MapContainer
        center={center}
        zoom={firstLocated || hasCurrentPosition ? 13 : 7}
        scrollWheelZoom
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
        />
        <MapFocus items={items} nearbyPlaces={nearbyPlaces} currentPosition={currentPosition}
          activeKey={activeKey} onSelect={onSelect} />
        {items.map((item, index) => (
          isValidCoordinates(item.latitude, item.longitude) ? (
            <Marker key={`itinerary:${item.id}`} position={[item.latitude!, item.longitude!]}
              icon={numberedIcon(index + 1)} eventHandlers={{ click: () => onSelect(`itinerary:${item.id}`) }}>
              <Popup>
                <strong>{index + 1}. {item.name}</strong><br />
                {item.address}
                {item.duration > 0 && <><br />예상 체류 {item.duration}분</>}
              </Popup>
            </Marker>
          ) : null
        ))}
        {nearbyPlaces.map((place) => (
          isValidCoordinates(place.latitude, place.longitude) ? (
            <Marker key={`nearby:${place.id}`} position={[place.latitude!, place.longitude!]}
              icon={nearbyIcon} eventHandlers={{ click: () => onSelect(`nearby:${place.id}`) }}>
              <Popup>
                <strong>{place.name}</strong><br />
                {place.address}<br />
                {place.rating !== undefined ? `평점 ${place.rating}` : "평점 정보 없음"}
              </Popup>
            </Marker>
          ) : null
        ))}
        {hasCurrentPosition && currentPosition && (
          <Marker position={[currentPosition.latitude, currentPosition.longitude]} icon={currentLocationIcon}>
            <Popup>현재 위치</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
