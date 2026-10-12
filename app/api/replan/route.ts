import { NextRequest, NextResponse } from "next/server";
import { generateItinerary, type ReplanContext, type TripConditions } from "@/lib/gemini";
import { searchPlaces, type Place } from "@/lib/google-places";
import { createSupabaseClient } from "@/lib/supabase";

const validReasons = [
  "갑자기 비가 와요", "방문하려던 장소가 문을 닫았어요", "예상보다 시간이 부족해요",
  "시간이 더 남았어요", "예산이 변경됐어요", "다른 종류의 활동을 하고 싶어요",
];
const validActivities = ["관광", "카페", "맛집", "쇼핑", "체험", "산책"];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type TripRecord = {
  id: string; destination: string; remaining_time: number; budget: number; people: number;
  situation: string; activities: string[]; title: string; summary: string;
};
type ItineraryRecord = {
  id: string; place_name: string; address: string; rating: number | null;
  user_rating_count: number | null; duration: number; reason: string;
  google_maps_uri: string | null; order_index: number;
};
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 &&
    value.every((item) => typeof item === "string" && item.trim().length > 0);
}
function safeError(error: unknown, message: string) {
  console.error(message, error);
  return NextResponse.json({ error: message }, { status: 500 });
}
async function rollbackNewTrip(supabase: ReturnType<typeof createSupabaseClient>, id: string) {
  try {
    const { error } = await supabase.from("trips").delete().eq("id", id);
    if (error) console.error("Replanned trip rollback error:", error);
  } catch (error) {
    console.error("Replanned trip rollback error:", error);
  }
}

export async function POST(request: NextRequest) {
  let input: Record<string, unknown>;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "재구성 요청 형식이 올바르지 않습니다." }, { status: 400 });
    }
    input = body as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "재구성 요청을 읽을 수 없습니다." }, { status: 400 });
  }

  const tripId = input.tripId;
  const reason = input.reason;
  const details = typeof input.details === "string" ? input.details.trim().slice(0, 500) : "";
  const remainingTime = Number(input.remainingTime);
  const budget = Number(input.budget);
  const activities = input.activities;
  const replacePlaceIds = input.replacePlaceIds;
  if (typeof tripId !== "string" || !uuidPattern.test(tripId)) {
    return NextResponse.json({ error: "기존 일정 ID가 올바르지 않습니다." }, { status: 400 });
  }
  if (typeof reason !== "string" || !validReasons.includes(reason)) {
    return NextResponse.json({ error: "변경 사유를 선택해주세요." }, { status: 400 });
  }
  if (
    !Number.isInteger(remainingTime) || remainingTime < 1 || remainingTime > 24 ||
    !Number.isInteger(budget) || budget < 0 || !isStringArray(activities) ||
    activities.length > validActivities.length ||
    !activities.every((activity) => validActivities.includes(activity)) ||
    !Array.isArray(replacePlaceIds) ||
    !replacePlaceIds.every((id) => typeof id === "string" && uuidPattern.test(id))
  ) {
    return NextResponse.json({ error: "남은 시간, 예산, 활동을 확인해주세요." }, { status: 400 });
  }
  if (reason === "방문하려던 장소가 문을 닫았어요" && replacePlaceIds.length === 0) {
    return NextResponse.json({ error: "문을 닫은 기존 장소를 교체 대상으로 선택해주세요." }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createSupabaseClient();
  } catch {
    return NextResponse.json({ error: "Supabase 연결 설정을 확인해주세요." }, { status: 500 });
  }
  let trip: TripRecord;
  let oldItems: ItineraryRecord[];
  try {
    const { data: tripData, error: tripError } = await supabase.from("trips")
      .select("id, destination, remaining_time, budget, people, situation, activities, title, summary")
      .eq("id", tripId).maybeSingle();
    if (tripError) return safeError(tripError, "기존 여행 기록을 불러오지 못했습니다.");
    if (!tripData) return NextResponse.json({ error: "기존 일정을 찾을 수 없습니다." }, { status: 404 });
    trip = tripData as TripRecord;
    const { data: itemData, error: itemError } = await supabase.from("itineraries")
      .select("id, place_name, address, rating, user_rating_count, duration, reason, google_maps_uri, order_index")
      .eq("trip_id", tripId).order("order_index", { ascending: true });
    if (itemError) return safeError(itemError, "기존 일정 장소를 불러오지 못했습니다.");
    oldItems = (itemData ?? []) as ItineraryRecord[];
  } catch (error) {
    return safeError(error, "Supabase에서 기존 일정을 조회하지 못했습니다.");
  }
  if (oldItems.length === 0) {
    return NextResponse.json({ error: "기존 일정에 재구성할 장소가 없습니다." }, { status: 422 });
  }
  const replaceIds = new Set(replacePlaceIds as string[]);
  const replaceItems = oldItems.filter((item) => replaceIds.has(item.id));
  if (replaceItems.length !== replaceIds.size) {
    return NextResponse.json({ error: "교체 대상으로 선택한 장소가 기존 일정과 일치하지 않습니다." }, { status: 400 });
  }

  const conditions: TripConditions = {
    destination: trip.destination, remainingTime, budget, people: trip.people,
    situation: details ? `${reason}: ${details}` : reason, activities,
  };
  const queries = reason === "갑자기 비가 와요"
    ? [`${trip.destination} 실내 관광`, ...activities.slice(0, 2).map((activity) => `${trip.destination} ${activity}`)]
    : activities.slice(0, 3).map((activity) => `${trip.destination} ${activity}`);
  const uniqueQueries = [...new Set(queries)].slice(0, 3);
  let searchResults: Place[];
  try {
    const results = await Promise.all(uniqueQueries.map((query) => searchPlaces(query)));
    const unique = new Map<string, Place>();
    results.flat().forEach((place) => unique.set(`${place.name}|${place.address}`, place));
    searchResults = [...unique.values()];
  } catch (error) {
    return safeError(error, "Google Places에서 대체 장소를 검색하지 못했습니다.");
  }
  if (searchResults.length === 0) {
    return NextResponse.json({
      error: "대체 장소를 찾지 못했습니다. 검색 지역이나 원하는 활동을 바꿔 다시 시도해주세요. 기존 일정은 그대로 보존되어 있습니다.",
    }, { status: 422 });
  }

  const previousItems = oldItems.map((item) => ({
    id: item.id, name: item.place_name, address: item.address,
    rating: item.rating ?? undefined, userRatingCount: item.user_rating_count ?? undefined,
    googleMapsUri: item.google_maps_uri ?? undefined, duration: item.duration, reason: item.reason,
  }));
  const excludedNames = new Set(replaceItems.map((item) => item.place_name));
  const candidateMap = new Map<string, Place>();
  previousItems.forEach((item) => {
    if (!excludedNames.has(item.name)) candidateMap.set(`${item.name}|${item.address}`, item);
  });
  searchResults.forEach((place) => {
    if (!excludedNames.has(place.name)) {
      candidateMap.set(`${place.name}|${place.address}`, place);
    }
  });
  const candidates = [...candidateMap.values()];
  const alternatives = searchResults.filter((place) => !excludedNames.has(place.name));
  if (replaceItems.length > 0 && alternatives.length === 0) {
    return NextResponse.json({ error: "대체할 장소를 찾지 못했습니다. 검색 지역이나 원하는 활동을 바꿔 다시 시도해주세요. 기존 일정은 그대로 보존되어 있습니다." }, { status: 422 });
  }
  if (candidates.length === 0) {
    return NextResponse.json({ error: "대체 장소 검색 결과가 없습니다. 기존 일정은 그대로 보존되어 있습니다." }, { status: 422 });
  }

  const replanContext: ReplanContext = {
    changeReason: reason, details, previousItems,
    previousConditions: {
      situation: trip.situation,
      remainingTime: trip.remaining_time,
      budget: trip.budget,
      activities: trip.activities,
    },
    replacePlaceNames: replaceItems.map((item) => item.place_name),
  };
  let itinerary;
  try {
    itinerary = await generateItinerary(conditions, candidates, replanContext);
  } catch (error) {
    return safeError(error, error instanceof Error ? error.message : "Gemini가 새 일정을 만들지 못했습니다.");
  }

  let newTrip: { id: string };
  try {
    const { data, error } = await supabase.from("trips").insert({
      destination: trip.destination, remaining_time: remainingTime, budget,
      people: trip.people, situation: conditions.situation, activities,
      title: itinerary.title, summary: itinerary.summary,
    }).select("id").single();
    if (error || !data) return safeError(error, "새 여행 기록을 저장하지 못했습니다.");
    newTrip = data as { id: string };
  } catch (error) {
    return safeError(error, "새 여행 기록을 저장하지 못했습니다.");
  }

  const itineraryRows = itinerary.items.map((item, index) => ({
    trip_id: newTrip.id, place_name: item.name, address: item.address,
    rating: item.rating ?? null, user_rating_count: item.userRatingCount ?? null,
    duration: item.duration, reason: item.reason,
    google_maps_uri: item.googleMapsUri ?? null, order_index: index,
  }));
  try {
    const { error } = await supabase.from("itineraries").insert(itineraryRows);
    if (error) {
      console.error("Replanned itinerary insert error:", error);
      await rollbackNewTrip(supabase, newTrip.id);
      return NextResponse.json({ error: "새 일정 저장에 실패했습니다. 기존 일정은 변경되지 않았습니다." }, { status: 500 });
    }
  } catch (error) {
    console.error("Replanned itinerary insert error:", error);
    await rollbackNewTrip(supabase, newTrip.id);
    return NextResponse.json({ error: "새 일정 저장 중 오류가 발생했습니다. 기존 일정은 변경되지 않았습니다." }, { status: 500 });
  }
  return NextResponse.json({ tripId: newTrip.id, ...itinerary });
}
