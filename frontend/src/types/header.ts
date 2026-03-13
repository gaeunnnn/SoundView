// 메인 페이지 상단 헤더에 사용하는 타입 정의 파일
export type MainHeaderProps = {
  userName: string;
  userCode?: string;
  onClickLogo?: () => void;
  onClickHelp?: () => void;
  onClickNotification?: () => void;
  onClickProfile?: () => void;
};