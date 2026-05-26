// 아주 가벼운 어드민 보호 — MVP용 단일 비밀번호 게이트.
// 비밀번호는 환경변수 ADMIN_PASSWORD 에서 읽는다. (미설정 시 개발용 기본값)
// 운영 배포 시 반드시 ADMIN_PASSWORD 를 설정하세요.

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || "aidaebon";
}

/** 요청 헤더의 x-admin-password 가 일치하는지 검사 */
export function isAdmin(req: Request): boolean {
  const provided = req.headers.get("x-admin-password");
  return Boolean(provided) && provided === getAdminPassword();
}
