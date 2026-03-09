// 로그인 페이지 오른쪽 상단의 기능 카드 6개를 묶어 보여주는 컴포넌트 파일
import FeatureCard from "./FeatureCard";

const featureList = [
  { icon: "🔗", title: "영상 공유", description: "함께 보기" },
  { icon: "😊", title: "이모티콘", description: "소리를 눈으로" },
  { icon: "📁", title: "추억 저장", description: "앨범으로 보관" },
  { icon: "🎯", title: "환경음 감지", description: "12가지 인식" },
  { icon: "💬", title: "대화 자막", description: "정확한 전달" },
  { icon: "📳", title: "진동 피드백", description: "촉각으로 전달" },
];

export default function FeatureGrid() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {featureList.map((feature) => (
        <FeatureCard
          key={feature.title}
          icon={feature.icon}
          title={feature.title}
          description={feature.description}
        />
      ))}
    </div>
  );
}