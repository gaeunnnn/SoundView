// 메인 페이지 상단 헤더 전체 레이아웃을 조립하는 컴포넌트 파일
import type { MainHeaderProps } from "../../../types/header";
import HeaderActionGroup from "./HeaderActionGroup";
import HeaderBrand from "./HeaderBrand";
import HeaderProfileButton from "./HeaderProfileButton";

export default function MainHeader({
  userName,
  onClickLogo,
  onClickHelp,
  onClickNotification,
  onClickProfile,
}: MainHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#E8EDF4] bg-white px-5">
      <HeaderBrand title="SoundSee" onClick={onClickLogo} />

      <div className="flex items-center gap-3">
        <HeaderActionGroup
          onClickHelp={onClickHelp}
          onClickNotification={onClickNotification}
        />
        <HeaderProfileButton userName={userName} onClick={onClickProfile} />
      </div>
    </header>
  );
}