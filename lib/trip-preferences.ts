export const activityOptions = [
  "맛집 탐방", "카페 투어", "쇼핑", "자연·산책", "실내 전시·박물관", "사진 명소",
  "액티비티", "문화·역사", "바다·해변", "야경", "현지 체험", "휴식·힐링",
];

export const situationOptions = [
  "비 또는 악천후", "시간 부족", "예산 부족", "방문 예정 장소의 영업 종료",
  "긴 대기 시간", "이동 어려움", "일행의 컨디션 저하", "기존 일정이 마음에 들지 않음",
  "주변의 새로운 장소 탐색", "교통편 문제", "혼잡한 장소 회피", "계획에 없던 장소 방문 희망",
];

const requiredPrefix = "꼭 하고 싶어요: ";
const preferredPrefix = "가능하면 하고 싶어요: ";
const requestPrefix = "추가 요청: ";
const situationPrefix = "추가 상황: ";

export type ActivityPreferences = {
  required: string[];
  preferred: string[];
  request: string;
};

export function encodeActivities(required: string[], preferred: string[], request: string) {
  return [
    ...required.map((item) => `${requiredPrefix}${item}`),
    ...preferred.filter((item) => !required.includes(item)).map((item) => `${preferredPrefix}${item}`),
    ...(request.trim() ? [`${requestPrefix}${request.trim()}`] : []),
  ];
}

export function decodeActivities(values: string[]): ActivityPreferences {
  const required: string[] = [];
  const preferred: string[] = [];
  const requests: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (value.startsWith(requiredPrefix)) required.push(value.slice(requiredPrefix.length));
    else if (value.startsWith(preferredPrefix)) preferred.push(value.slice(preferredPrefix.length));
    else if (value.startsWith(requestPrefix)) requests.push(value.slice(requestPrefix.length));
    else if (value) preferred.push(value); // Pre-priority records remain usable.
  }
  return { required, preferred: preferred.filter((item) => !required.includes(item)), request: requests.join("\n") };
}

export function encodeSituations(selected: string[], details: string) {
  return [...selected, ...(details.trim() ? [`${situationPrefix}${details.trim()}`] : [])].join(" · ");
}

export function decodeSituations(value: string) {
  const selected: string[] = [];
  const details: string[] = [];
  for (const item of value.split(/\s*·\s*/).map((part) => part.trim()).filter(Boolean)) {
    if (item === "특별한 상황 없음") continue;
    if (item.startsWith(situationPrefix)) details.push(item.slice(situationPrefix.length));
    else if (situationOptions.includes(item)) selected.push(item);
    else details.push(item); // Keep legacy free-form situation text intact.
  }
  return { selected, details: details.join("\n") };
}

export function activitySearchTerms(values: string[]) {
  const { required, preferred, request } = decodeActivities(values);
  return [...required, ...preferred, ...(request ? [request.slice(0, 72)] : [])].filter(Boolean);
}
