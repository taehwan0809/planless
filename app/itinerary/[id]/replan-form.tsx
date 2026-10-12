"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import type { ItineraryItem } from "@/lib/gemini";

type ExistingPlace = ItineraryItem & { id: string };
type ReplanFormProps = {
  tripId: string;
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
const activityOptions = ["관광", "카페", "맛집", "쇼핑", "체험", "산책"];

export default function ReplanForm({ tripId, remainingTime, budget, activities, items }: ReplanFormProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [replacePlaceIds, setReplacePlaceIds] = useState<string[]>([]);
  const [updatedTime, setUpdatedTime] = useState(String(remainingTime));
  const [updatedBudget, setUpdatedBudget] = useState(String(budget));
  const [selectedActivities, setSelectedActivities] = useState(activities);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const toggleValue = (value: string, values: string[], setter: (next: string[]) => void) => {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
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
          remainingTime: updatedTime, budget: updatedBudget, activities: selectedActivities,
        }),
      });
      const data: { tripId?: string; error?: string } = await response.json();
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
    <section className="replanPanel" aria-labelledby="replan-heading">
      <h2 id="replan-heading">일정 다시 만들기</h2>
      <p className="replanDescription">변경 사유와 바꿀 장소를 알려주면 기존 일정에서 필요한 부분만 다시 구성합니다.</p>
      <form className="replanForm" onSubmit={handleSubmit}>
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
          <label>원하는 활동</label>
          <div className="optionGrid">
            {activityOptions.map((activity) => (
              <button type="button" key={activity}
                className={`optionButton ${selectedActivities.includes(activity) ? "selected" : ""}`}
                aria-pressed={selectedActivities.includes(activity)}
                onClick={() => toggleValue(activity, selectedActivities, setSelectedActivities)}>
                {activity}
              </button>
            ))}
          </div>
        </div>
        <button className="generateButton" type="submit"
          disabled={isSubmitting || !reason || selectedActivities.length === 0}>
          {isSubmitting ? "새 일정을 구성하고 있어요..." : "일정 다시 만들기 →"}
        </button>
      </form>
      {isSubmitting && <p className="replanStatus" role="status" aria-live="polite">
        주변 장소를 검색하고 AI가 일정을 재구성하고 있어요. 기존 기록은 그대로 유지됩니다.
      </p>}
      {error && <p className="replanError" role="alert">{error}</p>}
    </section>
  );
}
