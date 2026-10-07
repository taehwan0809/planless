import { GoogleGenAI } from "@google/genai";
import type { Place } from "@/lib/google-places";

export type TripConditions = {
  destination: string;
  remainingTime: number;
  budget: number;
  people: number;
  situation: string;
  activities: string[];
};

export type ItineraryItem = Place & {
  duration: number;
  reason: string;
};

export type GeneratedItinerary = {
  title: string;
  summary: string;
  items: ItineraryItem[];
};

type GeminiItinerary = {
  title?: unknown;
  summary?: unknown;
  items?: unknown;
};

const itinerarySchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    summary: { type: "STRING" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          placeName: { type: "STRING" },
          duration: { type: "INTEGER" },
          reason: { type: "STRING" },
        },
        required: ["placeName", "duration", "reason"],
      },
    },
  },
  required: ["title", "summary", "items"],
} as const;

function parseJsonResponse(text: string): GeminiItinerary {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed: unknown = JSON.parse(cleaned);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Gemini 응답 형식이 올바르지 않습니다.");
  }

  return parsed as GeminiItinerary;
}

export async function generateItinerary(
  conditions: TripConditions,
  places: Place[]
): Promise<GeneratedItinerary> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `너는 여행 일정을 구성하는 도우미다. 반드시 아래 places 배열에 있는 장소만 선택하라.
places에 없는 장소를 만들거나 장소명을 바꾸지 마라. placeName은 제공된 장소명과 완전히 동일해야 한다.
사용자 조건과 예산을 고려하고, remainingTime 안에 끝나도록 각 장소의 체류 시간을 분 단위로 정하라.
비가 오는 상황이면 실내 장소를 우선하고, 시간이 부족하면 장소 수를 줄여라.
장소별 reason은 조건과 관련된 짧은 한국어 문장으로 작성하라.
응답은 지정된 JSON 형식만 사용하라.

여행 조건:
${JSON.stringify(conditions)}

places:
${JSON.stringify(places)}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: itinerarySchema,
    },
  });

  if (!response.text) {
    throw new Error("Gemini가 일정 결과를 반환하지 않았습니다.");
  }

  let generated: GeminiItinerary;
  try {
    generated = parseJsonResponse(response.text);
  } catch {
    throw new Error("Gemini 응답을 JSON으로 읽을 수 없습니다.");
  }

  if (
    typeof generated.title !== "string" ||
    typeof generated.summary !== "string" ||
    !Array.isArray(generated.items) ||
    generated.items.length === 0
  ) {
    throw new Error("Gemini 일정 결과에 필요한 정보가 없습니다.");
  }

  const validPlaces = new Map(places.map((place) => [place.name, place]));
  const usedNames = new Set<string>();
  const items: ItineraryItem[] = generated.items.map((value) => {
    if (!value || typeof value !== "object") {
      throw new Error("Gemini 일정 항목 형식이 올바르지 않습니다.");
    }

    const item = value as Record<string, unknown>;
    const placeName = item.placeName;
    const place = typeof placeName === "string" ? validPlaces.get(placeName) : undefined;

    if (!place) {
      throw new Error("Google Places 검색 결과에 없는 장소가 포함되어 일정을 취소했습니다.");
    }
    if (usedNames.has(place.name)) {
      throw new Error("일정에 중복 장소가 포함되어 일정을 취소했습니다.");
    }
    if (
      typeof item.duration !== "number" ||
      !Number.isInteger(item.duration) ||
      item.duration < 10 ||
      item.duration > conditions.remainingTime * 60
    ) {
      throw new Error("일정 체류 시간이 올바르지 않아 일정을 취소했습니다.");
    }
    if (typeof item.reason !== "string" || !item.reason.trim()) {
      throw new Error("일정 선택 이유가 없어 일정을 취소했습니다.");
    }

    usedNames.add(place.name);
    return {
      ...place,
      duration: item.duration,
      reason: item.reason,
    };
  });

  if (items.length > 8) {
    throw new Error("일정 장소 수가 너무 많아 결과를 사용할 수 없습니다.");
  }

  const totalDuration = items.reduce((total, item) => total + item.duration, 0);
  if (totalDuration > conditions.remainingTime * 60) {
    throw new Error("전체 체류 시간이 남은 시간을 초과해 일정을 취소했습니다.");
  }

  return {
    title: generated.title.trim(),
    summary: generated.summary.trim(),
    items,
  };
}
