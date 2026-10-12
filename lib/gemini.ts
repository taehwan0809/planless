import { ApiError, GoogleGenAI } from "@google/genai";
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

export type ReplanContext = {
  changeReason: string;
  details: string;
  previousConditions: {
    situation: string;
    remainingTime: number;
    budget: number;
    activities: string[];
  };
  previousItems: Array<ItineraryItem & { id: string }>;
  replacePlaceNames: string[];
  preferredPlaceNames: string[];
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

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
const RETRYABLE_GEMINI_STATUSES = new Set([429, 500, 502, 503, 504]);

function getGeminiStatus(error: unknown): number | null {
  if (error instanceof ApiError) return error.status;
  if (!error || typeof error !== "object") return null;
  const value = (error as { status?: unknown; statusCode?: unknown }).status ??
    (error as { statusCode?: unknown }).statusCode;
  return typeof value === "number" ? value : null;
}

async function generateWithRetry(ai: GoogleGenAI, prompt: string) {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: itinerarySchema,
        },
      });
    } catch (error) {
      const status = getGeminiStatus(error);
      if (!status || !RETRYABLE_GEMINI_STATUSES.has(status) || attempt === maxAttempts - 1) {
        if (status === 401 || status === 403 || status === 404) {
          throw new Error("Gemini API 키 또는 모델 설정을 확인해주세요.");
        }
        if (status && RETRYABLE_GEMINI_STATUSES.has(status)) {
          throw new Error("Gemini 서비스가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.");
        }
        throw new Error("Gemini 일정 생성 요청을 처리하지 못했습니다.");
      }
      const delayMs = 400 * (2 ** attempt) + Math.floor(Math.random() * 200);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("Gemini 일정 생성에 실패했습니다.");
}

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
  places: Place[],
  replanContext?: ReplanContext
): Promise<GeneratedItinerary> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { retryOptions: { attempts: 1 } },
  });
  const basePrompt = `너는 여행 일정을 구성하는 도우미다. 반드시 아래 places 배열에 있는 장소만 선택하라.
places에 없는 장소를 만들거나 장소명을 바꾸지 마라. placeName은 제공된 장소명과 완전히 동일해야 한다.
사용자 조건과 예산을 고려하고, remainingTime 안에 끝나도록 각 장소의 체류 시간을 분 단위로 정하라.
비가 오는 상황이면 실내 장소를 우선하고, 시간이 부족하면 장소 수를 줄여라.
좌표가 주어지면 서로 가까운 장소를 우선해 이동 부담을 낮춰라. 실제 이동 거리와 시간은 계산되지 않았으므로 수치로 단정하지 마라.
장소별 reason은 조건과 관련된 짧은 한국어 문장으로 작성하라.
응답은 지정된 JSON 형식만 사용하라.

여행 조건:
${JSON.stringify(conditions)}

places:
${JSON.stringify(places)}`;
  const replanPrompt = replanContext
    ? `

기존 일정 재구성 지시:
변경 사유: ${replanContext.changeReason}
추가 설명: ${replanContext.details || "없음"}
변경 전 여행 조건: ${JSON.stringify(replanContext.previousConditions)}
기존 일정: ${JSON.stringify(replanContext.previousItems)}
사용자가 교체 대상으로 지정한 장소: ${JSON.stringify(replanContext.replacePlaceNames)}
사용자가 현재 위치 주변에서 직접 고른 후보: ${JSON.stringify(replanContext.preferredPlaceNames)}
가능하면 사용자가 직접 고른 주변 후보를 새 일정에 포함하라.
교체 대상으로 지정되지 않은 기존 장소는 변경 사유와 충돌하지 않는 한 일정에 유지하라. 관계없는 장소까지 전부 바꾸지 마라.
교체 대상으로 지정된 장소는 새 일정에 포함하지 마라.
비가 오는 경우 실내 장소를 우선하라. 남은 시간이 부족하면 전체 체류 시간 합계가 남은 시간 이내가 되도록 장소 수나 체류 시간을 줄여라.
새 장소는 위 places 배열의 Google Places 결과에 있는 장소만 사용하라.`
    : "";
  const prompt = basePrompt + replanPrompt;

  const response = await generateWithRetry(ai, prompt);

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
