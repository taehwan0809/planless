const GOOGLE_PLACES_API_URL =
  "https://places.googleapis.com/v1/places:searchText";

export type Place = {
  name: string;
  address: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
};

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
        "places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri",
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

  return (data.places ?? []).flatMap(
    (place: {
      displayName?: { text?: string };
      formattedAddress?: string;
      rating?: number;
      userRatingCount?: number;
      googleMapsUri?: string;
    }) => {
      const name = place.displayName?.text?.trim();
      const address = place.formattedAddress?.trim();

      if (!name || !address) {
        return [];
      }

      return [{
        name,
        address,
        rating: place.rating,
        userRatingCount: place.userRatingCount,
        googleMapsUri: place.googleMapsUri,
      }];
    }
  );
}
