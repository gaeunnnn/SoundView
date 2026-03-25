// 메인 페이지 상단 헤더에 사용하는 타입 정의 파일
export type MainHeaderProps = {
  userName: string;
  userCode?: string;
  profileImageUrl?: string | null;
  onClickLogo?: () => void;
  onClickHelp?: () => void;
  onClickProfile?: () => void;
  onVideoCompleted?: (videoId: number) => void;
};