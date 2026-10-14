"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Place } from "@/lib/google-places";
import type { GeneratedItinerary } from "@/lib/gemini";
import ItineraryMapLoader from "../itinerary/[id]/itinerary-map-loader";

const situations = [
  "갑자기 비가 와요",
  "가려던 곳이 문을 닫았어요",
  "생각보다 시간이 부족해요",
  "예산을 줄이고 싶어요",
  "주변에서 다른 곳을 찾고 싶어요",
];

const activities = [
  "관광",
  "카페",
  "맛집",
  "쇼핑",
  "체험",
  "산책",
];

export default function CreatePage() {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const [remainingTime, setRemainingTime] = useState("3");
  const [budget, setBudget] = useState("");
  const [people, setPeople] = useState("2");
  const [situation, setSituation] = useState("");
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlaceKeys, setSelectedPlaceKeys] = useState<string[]>([]);
  const [activePlaceKey, setActivePlaceKey] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [itinerary, setItinerary] = useState<GeneratedItinerary | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [itineraryError, setItineraryError] = useState("");

  const toggleActivity = (activity: string) => {
    setSelectedActivities((current) =>
      current.includes(activity)
        ? current.filter((item) => item !== activity)
        : [...current, activity]
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSearching(true);
    setSearchError("");
    setPlaces([]);
      setSelectedPlaceKeys([]);
      setActivePlaceKey(null);
    setHasSearched(false);
    setItinerary(null);
    setTripId(null);
    setItineraryError("");

    try {
      const queries = selectedActivities
        .slice(0, 3)
        .map((activity) => `${destination.trim()} ${activity}`);
      const responses = await Promise.all(
        queries.map(async (query) => {
          const response = await fetch("/api/places", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
          });
          const data: { places?: Place[]; error?: string } = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "장소를 검색하지 못했습니다.");
          }

          return data.places ?? [];
        })
      );

      const uniquePlaces = new Map<string, Place>();
      responses.flat().forEach((place) => {
        uniquePlaces.set(`${place.name}|${place.address}`, place);
      });
      setPlaces(Array.from(uniquePlaces.values()));
      setSelectedPlaceKeys([]);
      setHasSearched(true);
    } catch (error) {
      setSearchError(
        error instanceof Error
          ? error.message
          : "장소 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setIsSearching(false);
    }
  };

  const placeKey = (place: Place) => `${place.name}|${place.address}`;
  const mappedPlaces = places.map((place) => ({
    ...place,
    id: place.id || encodeURIComponent(placeKey(place)),
    duration: 0,
    reason: "",
  }));
  const togglePlace = (place: Place) => {
    const key = placeKey(place);
    setSelectedPlaceKeys((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
  };

  const handleGenerateItinerary = async () => {
    setIsGenerating(true);
    setItineraryError("");
    setItinerary(null);
    setTripId(null);

    try {
      const response = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          remainingTime,
          budget,
          people,
          situation,
          activities: selectedActivities,
          places: selectedPlaceKeys.length
            ? places.filter((place) => selectedPlaceKeys.includes(placeKey(place)))
            : places,
        }),
      });
      const data: GeneratedItinerary & { tripId?: string; error?: string } =
        await response.json();

      if (!response.ok || !data.tripId || !Array.isArray(data.items)) {
        throw new Error(data.error || "AI 일정 생성에 실패했습니다.");
      }

      setItinerary({ title: data.title, summary: data.summary, items: data.items });
      setTripId(data.tripId);
      router.push(`/itinerary/${data.tripId}`);
    } catch (error) {
      setItineraryError(
        error instanceof Error
          ? error.message
          : "AI 일정 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="createPage">
      <div className="createContainer">
        <a href="/" className="backLink">
          ← PLANLESS
        </a>

        <div className="pageHeader">
          <p className="step">STEP 01</p>
          <h1>현재 여행 상황을 알려주세요.</h1>
          <p>
            지금 상황에 맞춰 새로운 여행 일정을 만들어드릴게요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="conditionForm">
          <div className="formGroup">
            <label htmlFor="destination">여행 지역</label>
            <input
              id="destination"
              type="text"
              placeholder="예: 제주 애월"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              required
            />
          </div>

          <div className="formRow">
            <div className="formGroup">
              <label htmlFor="remainingTime">남은 시간</label>
              <div className="inputWithUnit">
                <input
                  id="remainingTime"
                  type="number"
                  min="1"
                  max="24"
                  value={remainingTime}
                  onChange={(event) => setRemainingTime(event.target.value)}
                  required
                />
                <span>시간</span>
              </div>
            </div>

            <div className="formGroup">
              <label htmlFor="budget">예산</label>
              <div className="inputWithUnit">
                <input
                  id="budget"
                  type="number"
                  min="0"
                  placeholder="50000"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  required
                />
                <span>원</span>
              </div>
            </div>
          </div>

          <div className="formGroup">
            <label htmlFor="people">인원</label>
            <div className="inputWithUnit">
              <input
                id="people"
                type="number"
                min="1"
                max="20"
                value={people}
                onChange={(event) => setPeople(event.target.value)}
                required
              />
              <span>명</span>
            </div>
          </div>

          <div className="formGroup">
            <span className="fieldLabel">현재 상황</span>

            <div className="optionGrid">
              {situations.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={`optionButton ${
                    situation === item ? "selected" : ""
                  }`}
                  aria-pressed={situation === item}
                  onClick={() => setSituation(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="formGroup">
            <span className="fieldLabel">원하는 활동</span>

            <div className="optionGrid">
              {activities.map((activity) => (
                <button
                  type="button"
                  key={activity}
                  className={`optionButton ${
                    selectedActivities.includes(activity) ? "selected" : ""
                  }`}
                  aria-pressed={selectedActivities.includes(activity)}
                  onClick={() => toggleActivity(activity)}
                >
                  {activity}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="generateButton"
            disabled={!situation || selectedActivities.length === 0 || isSearching}
          >
            {isSearching ? "장소를 찾고 있어요..." : "장소 검색하기 →"}
          </button>
        </form>

        {isSearching && (
          <p className="searchStatus" role="status" aria-live="polite">
            주변 장소를 찾고 있어요...
          </p>
        )}

        {searchError && (
          <p className="searchError" role="alert">
            {searchError}
          </p>
        )}

        {hasSearched && (
          <section className="resultsSection" aria-live="polite">
            <div className="resultsHeading"><div><p className="step">STEP 02</p><h2>장소를 살펴보세요</h2></div>
              {places.length > 0 && <p>선택한 장소가 있으면 해당 후보를 우선 사용해요.</p>}</div>
            {places.length === 0 ? (
              <p className="emptyResults">조건에 맞는 장소를 찾지 못했어요.</p>
            ) : (
              <div className="searchResultsLayout">
                <div className="searchResultsMap">
                  <ItineraryMapLoader items={mappedPlaces} nearbyPlaces={[]} currentPosition={null}
                    activeKey={activePlaceKey} onSelect={setActivePlaceKey} />
                </div>
                <ul className="placeList searchPlaceList">
                  {places.map((place) => {
                    const key = placeKey(place);
                    const mapKey = `itinerary:${place.id || encodeURIComponent(key)}`;
                    const selected = selectedPlaceKeys.includes(key);
                    return <li className={`placeItem ${activePlaceKey === mapKey ? "activePlace" : ""}`} key={key}>
                      <button type="button" className="placeFocusButton" onClick={() => setActivePlaceKey(mapKey)}>
                        <span><strong>{place.name}</strong><small>{place.address}</small></span>
                        <span className="placeFocusHint">지도에서 보기</span>
                      </button>
                      <p className="placeMeta">
                        {place.rating !== undefined ? `평점 ${place.rating}` : "평점 정보 없음"}
                        {place.userRatingCount !== undefined && ` · 리뷰 ${place.userRatingCount.toLocaleString()}개`}
                      </p>
                      <div className="placeCardActions">
                        {place.googleMapsUri && <a href={place.googleMapsUri} target="_blank" rel="noreferrer">Google Maps ↗</a>}
                        <button type="button" className={`candidateButton ${selected ? "selected" : ""}`}
                          aria-pressed={selected} onClick={() => togglePlace(place)}>
                          {selected ? "후보 선택됨" : "후보로 선택"}
                        </button>
                      </div>
                    </li>;
                  })}
                </ul>
              </div>
            )}
            {places.length > 0 && (
              <button
                type="button"
                className="generateButton itineraryButton"
                onClick={handleGenerateItinerary}
                disabled={isGenerating}
              >
                {isGenerating ? "AI가 여행 일정을 만들고 있어요..." : "AI 일정 만들기 →"}
              </button>
            )}
          </section>
        )}

        {isGenerating && (
          <p className="searchStatus" role="status" aria-live="polite">
            AI가 여행 일정을 만들고 있어요...
          </p>
        )}

        {itineraryError && (
          <p className="searchError" role="alert">
            {itineraryError}
          </p>
        )}

        {itinerary && (
          <section className="resultsSection itinerarySection" aria-live="polite">
            <p className="step">PLANLESS ITINERARY</p>
            <h2>{itinerary.title}</h2>
            <p className="itinerarySummary">{itinerary.summary}</p>
            <p className="savedNotice" role="status">여행 기록 저장 완료</p>
            {tripId && (
              <Link className="startButton savedLink" href={`/itinerary/${tripId}`}>
                여행 기록 보기 →
              </Link>
            )}
            <ol className="placeList itineraryList">
              {itinerary.items.map((item, index) => (
                <li className="placeItem itineraryItem" key={`${item.name}|${item.address}`}>
                  <p className="step">{String(index + 1).padStart(2, "0")}</p>
                  <h3>{item.name}</h3>
                  <p>{item.address}</p>
                  <p className="placeMeta">예상 체류 시간 {item.duration}분</p>
                  <p className="itineraryReason">{item.reason}</p>
                  {item.googleMapsUri && (
                    <a href={item.googleMapsUri} target="_blank" rel="noreferrer">
                      Google Maps에서 보기 ↗
                    </a>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </main>
  );
}
