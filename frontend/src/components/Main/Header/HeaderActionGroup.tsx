// 상단 헤더 우측의 도움말과 알림 버튼 영역을 묶는 컴포넌트 파일
import { CircleHelp } from "lucide-react";
import HeaderIconButton from "./HeaderIconButton";
import NotificationButton from "./NotificationButton";

type HeaderActionGroupProps = {
  onClickHelp?: () => void;
};

export default function HeaderActionGroup({ onClickHelp }: HeaderActionGroupProps) {
  return (
    <div className="flex items-center gap-1">
      <HeaderIconButton ariaLabel="도움말" onClick={onClickHelp}>
        <CircleHelp size={18} strokeWidth={2} />
      </HeaderIconButton>

      <NotificationButton />
    </div>
  );
}