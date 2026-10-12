const GOOGLE_PLACES_API_URL =
  "https://places.googleapis.com/v1/places:searchText";
const GOOGLE_PLACES_NEARBY_API_URL =
  "https://places.googleapis.com/v1/places:searchNearby";

export type Place = {
  id?: string;
  name: string;
  address: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  latitude?: number;
  longitude?: number;
};

export type Coordinates = { latitude: number; longitude: number };
export type NearbySearchCategory = "tourist_attraction" | "indoor" | "cafe" | "restaurant";

const nearbyTypes: Record<NearbySearchCategory, string[]> = {
  tourist_attraction: ["tourist_attraction"],
  indoor: ["museum", "art_gallery", "aquarium", "movie_theater", "shopping_mall"],
  cafe: ["cafe"],
  restaurant: ["restaurant"],
};

function mapPlace(place: {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  location?: { latitude?: number; longitude?: number };
}): Place | null {
  const name = place.displayName?.text?.trim();
  const address = place.formattedAddress?.trim();
  if (!name || !address) return null;
  return {
    id: place.id,
    name,
    address,
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    googleMapsUri: place.googleMapsUri,
    latitude: place.location?.latitude,
    longitude: place.location?.longitude,
  };
}

export async function searchPlaces(
  query: string,
  maxResultCount = 10
): Promise<Place[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY가 설정되지 않았습니다.");
  }

  const response = await fetch(GOOGLE_PLACES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri",
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "ko",
      maxResultCount,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Places API 오류: ${errorText}`);
  }

  const data = await response.json();

  return (data.places ?? []).flatMap((place: Parameters<typeof mapPlace>[0]) => {
    const mapped = mapPlace(place);
    return mapped ? [mapped] : [];
  });
}

export async function searchNearbyPlaces(
  coordinates: Coordinates,
  radius: number,
  category: NearbySearchCategory,
  maxResultCount = 20
): Promise<Place[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY가 설정되지 않았습니다.");

  const response = await fetch(GOOGLE_PLACES_NEARBY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri",
    },
    body: JSON.stringify({
      includedTypes: nearbyTypes[category],
      maxResultCount,
      languageCode: "ko",
      locationRestriction: {
        circle: {
          center: coordinates,
          radius,
        },
      },
      rankPreference: "DISTANCE",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Places Nearby Search 오류: ${errorText}`);
  }
  const data = await response.json();
  return (data.places ?? []).flatMap((place: Parameters<typeof mapPlace>[0]) => {
    const mapped = mapPlace(place);
    return mapped ? [mapped] : [];
  });
}
