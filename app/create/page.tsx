"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Place } from "@/lib/google-places";
import type { GeneratedItinerary } from "@/lib/gemini";
import ItineraryMapLoader from "../itinerary/[id]/itinerary-map-loader";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import AccountControl from "@/components/account-control";
import { activityOptions, encodeActivities, encodeSituations, situationOptions } from "@/lib/trip-preferences";

export default function CreatePage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState("");
  const [destination, setDestination] = useState("");
  const [remainingTime, setRemainingTime] = useState("3");
  const [budget, setBudget] = useState("");
  const [people, setPeople] = useState("2");
  const [selectedSituations, setSelectedSituations] = useState<string[]>([]);
  const [situationDetails, setSituationDetails] = useState("");
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [mustDoActivities, setMustDoActivities] = useState<string[]>([]);
  const [activityRequest, setActivityRequest] = useState("");
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

  useEffect(() => {
    let active = true;
    createSupabaseBrowserClient().auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.user) {
        router.replace("/auth/login?next=%2Fcreate");
      } else {
        setIsCheckingAuth(false);
      }
    }).catch((error: unknown) => {
      if (!active) return;
      setAuthError(error instanceof Error ? error.message : "로그인 상태를 확인하지 못했습니다.");
      setIsCheckingAuth(false);
    });
    return () => { active = false; };
  }, [router]);

  const toggleActivity = (activity: string) => {
    const removing = selectedActivities.includes(activity);
    setSelectedActivities((current) => removing
      ? current.filter((item) => item !== activity)
      : [...current, activity]);
    if (removing) setMustDoActivities((current) => current.filter((item) => item !== activity));
  };

  const toggleSituation = (situation: string) => {
    setSelectedSituations((current) => current.includes(situation)
      ? current.filter((item) => item !== situation)
      : [...current, situation]);
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
      const activityTerms = [...mustDoActivities, ...selectedActivities]
        .filter((activity, index, all) => all.indexOf(activity) === index);
      const queryTerms = activityTerms.slice(0, 2);
      if (activityRequest.trim() && queryTerms.length < 2) queryTerms.push(activityRequest.trim().slice(0, 64));
      const queries = (queryTerms.length ? queryTerms : ["관광 명소", "추천 장소"])
        .slice(0, 3).map((term) => `${destination.trim()} ${term}`);
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
          situation: encodeSituations(selectedSituations, situationDetails) || "특별한 상황 없음",
          activities: encodeActivities(mustDoActivities, selectedActivities, activityRequest),
          places: selectedPlaceKeys.length
            ? places.filter((place) => selectedPlaceKeys.includes(placeKey(place)))
            : places,
        }),
      });
      const data: GeneratedItinerary & { tripId?: string; error?: string } =
        await response.json();

      if (response.status === 401) {
        router.replace("/auth/login?next=%2Fcreate");
        return;
      }

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
    isCheckingAuth ? <main className="createPage"><p className="authLoading" role="status">로그인 상태를 확인하고 있어요...</p></main> : authError ?
      <main className="createPage"><section className="detailMessage" role="alert"><h1>로그인이 필요합니다.</h1><p>{authError}</p><Link href="/auth/login?next=%2Fcreate">로그인 화면으로</Link></section></main> :
    <main className="createPage">
      <div className="createContainer">
        <a href="/" className="backLink">
          ← PLANLESS
        </a>
        <div className="createAccount"><AccountControl /></div>

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
            <p className="fieldHint">해당하는 상황을 모두 골라주세요. 선택하지 않아도 일정은 만들 수 있어요.</p>
            <div className="preferenceChipGrid">
              {situationOptions.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={`preferenceChip ${selectedSituations.includes(item) ? "selected" : ""}`}
                  aria-pressed={selectedSituations.includes(item)}
                  onClick={() => toggleSituation(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <label htmlFor="situation-details" className="fieldLabel">직접 설명 (선택)</label>
            <textarea id="situation-details" rows={3} maxLength={500} value={situationDetails}
              onChange={(event) => setSituationDetails(event.target.value)}
              placeholder="예: 비가 오고 일행이 지쳐서 가까운 실내 장소에서 쉬고 싶어요." />
          </div>

          <div className="formGroup">
            <span className="fieldLabel">원하는 활동</span>
            <p className="fieldHint">활동이 없어도 괜찮아요. 시간과 장소를 바탕으로 추천합니다.</p>
            <div className="preferenceChipGrid">
              {activityOptions.map((activity) => (
                <button
                  type="button"
                  key={activity}
                  className={`preferenceChip ${selectedActivities.includes(activity) ? "selected" : ""}`}
                  aria-pressed={selectedActivities.includes(activity)}
                  onClick={() => toggleActivity(activity)}
                >
                  {activity}{selectedActivities.includes(activity) && <small>{mustDoActivities.includes(activity) ? "꼭" : "가능하면"}</small>}
                </button>
              ))}
            </div>
            {selectedActivities.length > 0 && <div className="priorityEditor" aria-label="활동 우선순위">
              <span className="fieldHint">선택한 활동의 우선순위</span>
              {selectedActivities.map((activity) => <label key={activity}>
                <span>{activity}</span><select aria-label={`${activity} 우선순위`}
                  value={mustDoActivities.includes(activity) ? "must" : "prefer"}
                  onChange={(event) => setMustDoActivities((current) => event.target.value === "must"
                    ? [...current.filter((item) => item !== activity), activity]
                    : current.filter((item) => item !== activity))}>
                  <option value="must">꼭 하고 싶어요</option><option value="prefer">가능하면 하고 싶어요</option>
                </select>
              </label>)}
            </div>}
            <label htmlFor="activity-request" className="fieldLabel">원하는 여행 방식 직접 입력 (선택)</label>
            <textarea id="activity-request" rows={4} maxLength={700} value={activityRequest}
              onChange={(event) => setActivityRequest(event.target.value)}
              placeholder="예: 바다를 보면서 사진을 찍고 조용한 오션뷰 카페에서 쉬고 싶어요." />
          </div>

          <button
            type="submit"
            className="generateButton"
            disabled={isSearching}
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
