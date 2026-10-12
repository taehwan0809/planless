"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { ItineraryMapProps } from "./itinerary-map-loader";

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
    if (activeKey?.startsWith("itinerary:")) {
      const item = items.find((place) => `itinerary:${place.id}` === activeKey);
      if (typeof item?.latitude === "number" && typeof item.longitude === "number") {
        map.flyTo([item.latitude, item.longitude], Math.max(map.getZoom(), 14), { duration: 0.45 });
        return;
      }
    }
    if (activeKey?.startsWith("nearby:")) {
      const place = nearbyPlaces.find((candidate) => `nearby:${candidate.id}` === activeKey);
      if (typeof place?.latitude === "number" && typeof place.longitude === "number") {
        map.flyTo([place.latitude, place.longitude], Math.max(map.getZoom(), 14), { duration: 0.45 });
        return;
      }
    }
    if (currentPosition) {
      map.flyTo([currentPosition.latitude, currentPosition.longitude], Math.max(map.getZoom(), 14), { duration: 0.45 });
      return;
    }
    const valid = items.filter((item) =>
      typeof item.latitude === "number" && typeof item.longitude === "number"
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
  const firstLocated = items.find((item) =>
    typeof item.latitude === "number" && typeof item.longitude === "number"
  );
  const center: [number, number] = currentPosition
    ? [currentPosition.latitude, currentPosition.longitude]
    : firstLocated
      ? [firstLocated.latitude!, firstLocated.longitude!]
      : [36.5, 127.8];

  return (
    <div className="itineraryMapCanvas">
      <MapContainer center={center} zoom={firstLocated || currentPosition ? 13 : 7} scrollWheelZoom>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
        />
        <MapFocus items={items} nearbyPlaces={nearbyPlaces} currentPosition={currentPosition}
          activeKey={activeKey} onSelect={onSelect} />
        {items.map((item, index) => (
          typeof item.latitude === "number" && typeof item.longitude === "number" ? (
            <Marker key={`itinerary:${item.id}`} position={[item.latitude, item.longitude]}
              icon={numberedIcon(index + 1)} eventHandlers={{ click: () => onSelect(`itinerary:${item.id}`) }}>
              <Popup>
                <strong>{index + 1}. {item.name}</strong><br />
                {item.address}<br />
                예상 체류 {item.duration}분
              </Popup>
            </Marker>
          ) : null
        ))}
        {nearbyPlaces.map((place) => (
          typeof place.latitude === "number" && typeof place.longitude === "number" ? (
            <Marker key={`nearby:${place.id}`} position={[place.latitude, place.longitude]}
              icon={nearbyIcon} eventHandlers={{ click: () => onSelect(`nearby:${place.id}`) }}>
              <Popup>
                <strong>{place.name}</strong><br />
                {place.address}<br />
                {place.rating !== undefined ? `평점 ${place.rating}` : "평점 정보 없음"}
              </Popup>
            </Marker>
          ) : null
        ))}
        {currentPosition && (
          <Marker position={[currentPosition.latitude, currentPosition.longitude]} icon={currentLocationIcon}>
            <Popup>현재 위치</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
