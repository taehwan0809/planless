"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import type { ItineraryItem } from "@/lib/gemini";
import type { Coordinates, NearbySearchCategory, Place } from "@/lib/google-places";
import ItineraryMapLoader from "./itinerary-map-loader";
import { activityOptions, decodeActivities, decodeSituations, encodeActivities, encodeSituations, situationOptions } from "@/lib/trip-preferences";

type ExistingPlace = ItineraryItem & { id: string };
type NearbyCategory = NearbySearchCategory;
type ReplanFormProps = {
  tripId: string;
  situation: string;
  remainingTime: number;
  budget: number;
  activities: string[];
  items: ExistingPlace[];
};

const reasons = [
  "갑자기 비가 와요",
  "방문하려던 장소가 문을 닫았어요",
  "예상보다 시간이 부족해요",
  "시간이 더 남았어요",
  "예산이 변경됐어요",
  "다른 종류의 활동을 하고 싶어요",
];
const replanActivityOptions = activityOptions;

export default function ReplanForm({ tripId, situation, remainingTime, budget, activities, items }: ReplanFormProps) {
  const router = useRouter();
  const initialPreferences = decodeActivities(activities);
  const initialSituation = decodeSituations(situation);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [replacePlaceIds, setReplacePlaceIds] = useState<string[]>([]);
  const [updatedTime, setUpdatedTime] = useState(String(remainingTime));
  const [updatedBudget, setUpdatedBudget] = useState(String(budget));
  const [selectedActivities, setSelectedActivities] = useState([...initialPreferences.required, ...initialPreferences.preferred]);
  const [mustDoActivities, setMustDoActivities] = useState(initialPreferences.required);
  const [activityRequest, setActivityRequest] = useState(initialPreferences.request);
  const [selectedSituations, setSelectedSituations] = useState(initialSituation.selected);
  const [situationDetails, setSituationDetails] = useState(initialSituation.details);
  const [currentPosition, setCurrentPosition] = useState<Coordinates | null>(null);
  const [nearbyCategory, setNearbyCategory] = useState<NearbyCategory>("tourist_attraction");
  const [nearbyRadius, setNearbyRadius] = useState(1500);
  const [nearbyPlaces, setNearbyPlaces] = useState<Place[]>([]);
  const [selectedNearbyIds, setSelectedNearbyIds] = useState<string[]>([]);
  const [activeMapKey, setActiveMapKey] = useState<string | null>(null);
  const [locationError, setLocationError] = useState("");
  const [nearbyError, setNearbyError] = useState("");
  const [isSearchingNearby, setIsSearchingNearby] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const availableActivityOptions = [...new Set([...replanActivityOptions, ...selectedActivities])];

  const toggleValue = (value: string, values: string[], setter: (next: string[]) => void) => {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };
  const toggleActivity = (activity: string) => {
    const removing = selectedActivities.includes(activity);
    setSelectedActivities((current) => removing ? current.filter((item) => item !== activity) : [...current, activity]);
    if (removing) setMustDoActivities((current) => current.filter((item) => item !== activity));
  };
  const toggleSituation = (value: string) => {
    setSelectedSituations((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const requestLocation = () => {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("이 브라우저에서는 현재 위치를 사용할 수 없습니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setActiveMapKey(null);
      },
      () => setLocationError("현재 위치를 가져오지 못했습니다. 권한을 허용하거나 위치 없이 일정을 다시 만들어주세요."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleNearbySearch = async () => {
    if (!currentPosition) {
      setNearbyError("먼저 현재 위치를 가져와주세요.");
      return;
    }
    setIsSearchingNearby(true);
    setNearbyError("");
    setSelectedNearbyIds([]);
    try {
      const response = await fetch("/api/places/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: currentPosition,
          category: nearbyCategory,
          radius: nearbyRadius,
        }),
      });
      const data: { places?: Place[]; error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || "주변 장소를 검색하지 못했습니다.");
      setNearbyPlaces(data.places ?? []);
      setActiveMapKey(data.places?.[0]?.id ? `nearby:${data.places[0].id}` : null);
      if (!data.places?.length) setNearbyError("이 반경에서 장소를 찾지 못했습니다. 검색 반경을 넓혀보세요.");
    } catch (searchError) {
      setNearbyError(searchError instanceof Error ? searchError.message : "주변 장소 검색에 실패했습니다.");
      setNearbyPlaces([]);
    } finally {
      setIsSearchingNearby(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/replan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId, reason, details, replacePlaceIds,
          remainingTime: updatedTime, budget: updatedBudget,
          activities: encodeActivities(mustDoActivities, selectedActivities, activityRequest),
          situation: encodeSituations(selectedSituations, situationDetails) || "특별한 상황 없음",
          currentLocation: currentPosition,
          nearbyCategory,
          nearbyRadius,
          nearbyPlaceIds: selectedNearbyIds,
        }),
      });
      const data: { tripId?: string; error?: string } = await response.json();
      if (response.status === 401) {
        router.replace(`/auth/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (!response.ok || !data.tripId) {
        throw new Error(data.error || "일정 재구성에 실패했습니다.");
      }
      router.push(`/itinerary/${data.tripId}`);
    } catch (submitError) {
      setError(submitError instanceof Error
        ? submitError.message
        : "일정 재구성 중 오류가 발생했습니다. 기존 일정은 보존되어 있습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <section className="itineraryMapSection" aria-labelledby="map-heading">
      <h2 id="map-heading">여행 지도</h2>
      <p className="replanDescription">여행 장소와 주변 후보를 함께 확인하세요. 현재 위치는 지도 이동과 주변 검색에만 쓰이며 저장되지 않습니다.</p>
      <div className="locationToolbar">
        <button className="optionButton" type="button" onClick={requestLocation}>
          {currentPosition ? "현재 위치 새로고침" : "내 위치 사용"}
        </button>
        <button className="optionButton" type="button" disabled={!currentPosition}
          onClick={() => setActiveMapKey(null)}>
          현재 위치로 지도 이동
        </button>
      </div>
      {locationError && <p className="locationNotice" role="status">{locationError}</p>}
      <div className="nearbySearchControls">
        <label className="nearbyControl">
          장소 종류
          <select value={nearbyCategory} onChange={(event) => setNearbyCategory(event.target.value as NearbyCategory)}>
            <option value="tourist_attraction">관광지</option>
            <option value="indoor">실내 관광지</option>
            <option value="cafe">카페</option>
            <option value="restaurant">식당</option>
          </select>
        </label>
        <label className="nearbyControl">
          검색 반경
          <select value={nearbyRadius} onChange={(event) => setNearbyRadius(Number(event.target.value))}>
            <option value={500}>500m</option>
            <option value={1500}>1.5km</option>
            <option value={3000}>3km</option>
            <option value={5000}>5km</option>
          </select>
        </label>
        <button className="generateButton" type="button"
          disabled={!currentPosition || isSearchingNearby} onClick={handleNearbySearch}>
          {isSearchingNearby ? "주변 장소 검색 중..." : "현재 위치 주변 검색"}
        </button>
      </div>
      {nearbyError && <p className="replanError" role="alert">{nearbyError}</p>}
      <div className="itineraryWorkspace">
      <div className="mapPane">
        <ItineraryMapLoader items={items} nearbyPlaces={nearbyPlaces} currentPosition={currentPosition}
          activeKey={activeMapKey} onSelect={setActiveMapKey} />
        <div className="itineraryMapLegend" aria-label="지도 마커 안내">
          <span><i className="mapLegendNumber">1</i> 일정 순서</span>
          <span><i className="mapLegendNearby">+</i> 주변 장소 후보</span>
          <span><i className="mapLegendCurrent" /> 내 위치</span>
        </div>
      </div>
      <div className="itineraryPlacePanels">
      <h3 className="mapListHeading">현재 일정</h3>
      <ol className="placeList itineraryList mapPlaceList">
        {items.map((item, index) => (
          <li className={`placeItem itineraryItem ${activeMapKey === `itinerary:${item.id}` ? "activePlace" : ""}`} key={item.id}>
            <button type="button" className="mapPlaceSelect"
              aria-pressed={activeMapKey === `itinerary:${item.id}`}
              onClick={() => setActiveMapKey(`itinerary:${item.id}`)}>
              <span className="mapListNumber">{String(index + 1).padStart(2, "0")}</span>
              <span><strong>{item.name}</strong><small>{item.address}</small>
                <small>예상 체류 {item.duration}분</small></span>
            </button>
            {item.googleMapsUri && <a href={item.googleMapsUri} target="_blank" rel="noreferrer">Google Maps에서 길찾기 ↗</a>}
          </li>
        ))}
      </ol>
      {nearbyPlaces.length > 0 && (
        <>
          <h3 className="mapListHeading">현재 위치 주변 장소</h3>
          <ul className="placeList nearbyPlaceList">
            {nearbyPlaces.map((place) => (
              <li className={`placeItem ${activeMapKey === `nearby:${place.id}` ? "activePlace" : ""}`} key={place.id ?? `${place.name}|${place.address}`}>
                <button type="button" className="mapPlaceSelect"
                  aria-pressed={activeMapKey === `nearby:${place.id}`}
                  onClick={() => setActiveMapKey(`nearby:${place.id}`)}>
                  <span className="mapListNumber mapListNumberNearby">+</span>
                  <span><strong>{place.name}</strong><small>{place.address}</small>
                    <small>{place.rating !== undefined ? `평점 ${place.rating}` : "평점 정보 없음"}</small></span>
                </button>
                {place.googleMapsUri && <a href={place.googleMapsUri} target="_blank" rel="noreferrer">Google Maps에서 보기 ↗</a>}
                <label className="nearbyCandidateToggle">
                  <input type="checkbox" checked={!!place.id && selectedNearbyIds.includes(place.id)}
                    disabled={!place.id}
                    onChange={() => place.id && toggleValue(place.id, selectedNearbyIds, setSelectedNearbyIds)} />
                  재구성 후보에 포함
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      </div>
      </div>
    </section>

    <section className="replanPanel" aria-labelledby="replan-heading">
      <p className="step">PLAN B</p>
      <h2 id="replan-heading">여행 중 문제가 생겼나요?</h2>
      <p className="replanDescription">변경 사유와 바꿀 장소를 알려주면 기존 일정에서 필요한 부분만 다시 구성합니다.</p>
      <form className="replanForm" onSubmit={handleSubmit}>
        <div className="formGroup">
          <span className="fieldLabel">현재 상황 (모두 선택 가능)</span>
          <div className="preferenceChipGrid">
            {situationOptions.map((item) => <button type="button" key={item}
              className={`preferenceChip ${selectedSituations.includes(item) ? "selected" : ""}`}
              aria-pressed={selectedSituations.includes(item)} onClick={() => toggleSituation(item)}>{item}</button>)}
          </div>
          <label htmlFor="replan-situation-details" className="fieldLabel">상황 직접 입력 (선택)</label>
          <textarea id="replan-situation-details" rows={3} maxLength={500} value={situationDetails}
            onChange={(event) => setSituationDetails(event.target.value)}
            placeholder="현재 겪는 상황을 AI가 참고할 수 있도록 적어주세요." />
        </div>
        <div className="formGroup">
          <label htmlFor="replan-reason">변경 사유</label>
          <select id="replan-reason" value={reason} onChange={(event) => setReason(event.target.value)} required>
            <option value="">변경 사유를 선택하세요</option>
            {reasons.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="formGroup">
          <label>교체할 기존 장소 (선택)</label>
          <div className="replanPlaceOptions">
            {items.map((item) => (
              <label className="replanPlaceOption" key={item.id}>
                <input type="checkbox" checked={replacePlaceIds.includes(item.id)}
                  onChange={() => toggleValue(item.id, replacePlaceIds, setReplacePlaceIds)} />
                <span>{item.name} · {item.address}</span>
              </label>
            ))}
          </div>
          <small>문을 닫은 장소가 있다면 해당 장소를 선택해주세요.</small>
        </div>
        <div className="formGroup">
          <label htmlFor="replan-details">추가 설명 (선택)</label>
          <textarea id="replan-details" value={details} maxLength={500}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="예: 실내 장소 위주로, 이동이 짧은 곳으로 바꿔주세요." />
        </div>
        <div className="formRow">
          <div className="formGroup">
            <label htmlFor="replan-time">남은 시간</label>
            <div className="inputWithUnit">
              <input id="replan-time" type="number" min="1" max="24" required value={updatedTime}
                onChange={(event) => setUpdatedTime(event.target.value)} />
              <span>시간</span>
            </div>
          </div>
          <div className="formGroup">
            <label htmlFor="replan-budget">예산</label>
            <div className="inputWithUnit">
              <input id="replan-budget" type="number" min="0" required value={updatedBudget}
                onChange={(event) => setUpdatedBudget(event.target.value)} />
              <span>원</span>
            </div>
          </div>
        </div>
        <div className="formGroup">
          <span className="fieldLabel">원하는 활동 (선택)</span>
          <p className="fieldHint">선택하지 않으면 현재 상황과 장소를 바탕으로 추천합니다.</p>
          <div className="preferenceChipGrid">
            {availableActivityOptions.map((activity) => (
              <button type="button" key={activity}
                className={`preferenceChip ${selectedActivities.includes(activity) ? "selected" : ""}`}
                aria-pressed={selectedActivities.includes(activity)} onClick={() => toggleActivity(activity)}>
                {activity}{selectedActivities.includes(activity) && <small>{mustDoActivities.includes(activity) ? "꼭" : "가능하면"}</small>}
              </button>
            ))}
          </div>
          {selectedActivities.length > 0 && <div className="priorityEditor" aria-label="활동 우선순위">
            <span className="fieldHint">선택한 활동의 우선순위</span>
            {selectedActivities.map((activity) => <label key={activity}><span>{activity}</span>
              <select aria-label={`${activity} 우선순위`} value={mustDoActivities.includes(activity) ? "must" : "prefer"}
                onChange={(event) => setMustDoActivities((current) => event.target.value === "must"
                  ? [...current.filter((item) => item !== activity), activity]
                  : current.filter((item) => item !== activity))}>
                <option value="must">꼭 하고 싶어요</option><option value="prefer">가능하면 하고 싶어요</option>
              </select>
            </label>)}
          </div>}
          <label htmlFor="replan-activity-request" className="fieldLabel">원하는 활동 직접 입력 (선택)</label>
          <textarea id="replan-activity-request" rows={3} maxLength={700} value={activityRequest}
            onChange={(event) => setActivityRequest(event.target.value)}
            placeholder="구체적인 취향이나 여러 요청을 적어주세요." />
        </div>
        <button className="generateButton" type="submit"
          disabled={isSubmitting || !reason}>
          {isSubmitting ? "새 일정을 구성하고 있어요..." : "일정 다시 만들기 →"}
        </button>
      </form>
      {isSubmitting && <p className="replanStatus" role="status" aria-live="polite">
        주변 장소를 검색하고 AI가 일정을 재구성하고 있어요. 기존 기록은 그대로 유지됩니다.
      </p>}
      {error && <p className="replanError" role="alert">{error}</p>}
    </section>
    </>
  );
}
