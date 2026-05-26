// 공용 타입 정의

/** 어드민이 등록하는 "터진 릴스" 레퍼런스(예시 대본) */
export interface Reference {
  id: string;
  title: string; // 레퍼런스 제목 (예: "오픈런 부르는 카페 신메뉴 후킹")
  industry: string; // 업종 태그 (constants의 값, 또는 "공통")
  content: string; // 실제 대본/스크립트 본문
  note?: string; // 왜 터졌는지 등 메모 (프롬프트에 함께 전달)
  createdAt: string; // ISO 문자열
}

/** 앞 화면에서 사용자가 보내는 대본 생성 요청 */
export interface GenerateRequest {
  industry: string; // 업종
  region: string; // 지역
  purpose: string; // 제작 목적
  tone?: string; // 분위기/톤 (선택)
  extra?: string; // 추가 설명 (선택, 자유 입력)
}
