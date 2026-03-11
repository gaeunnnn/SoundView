// 자막 수정 페이지 더미 데이터
export type SoundEvent = {
  id: number;
  timeSec: number;
  timeLabel: string;
  emoji: string;
  description: string;
  enabled: boolean;
};

export const DUMMY_SOUND_EVENTS: SoundEvent[] = [
  { id: 1,  timeSec: 3,   timeLabel: "00:03", emoji: "💥", description: "펑 소리",          enabled: true },
  { id: 2,  timeSec: 6,   timeLabel: "00:06", emoji: "💭", description: "와 진짜 크다!",     enabled: true },
  { id: 3,  timeSec: 12,  timeLabel: "00:12", emoji: "💥", description: "큰 터지는 소리",    enabled: true },
  { id: 4,  timeSec: 20,  timeLabel: "00:20", emoji: "👥", description: "사람들 웅성거림",   enabled: true },
  { id: 5,  timeSec: 28,  timeLabel: "00:28", emoji: "🎵", description: "배경음악 시작",     enabled: true },
  { id: 6,  timeSec: 35,  timeLabel: "00:35", emoji: "💭", description: "지금 터진 거 봤어?", enabled: true },
  { id: 7,  timeSec: 45,  timeLabel: "00:45", emoji: "👏", description: "박수 소리",         enabled: true },
  { id: 8,  timeSec: 52,  timeLabel: "00:52", emoji: "💭", description: "와 대박이다!",      enabled: true },
  { id: 9,  timeSec: 63,  timeLabel: "01:03", emoji: "🔴", description: "연속 폭발음",       enabled: true },
  { id: 10, timeSec: 75,  timeLabel: "01:15", emoji: "💭", description: "사진 찍어!",        enabled: true },
  { id: 11, timeSec: 85,  timeLabel: "01:25", emoji: "💥", description: "불꽃 치솟는 소리",  enabled: true },
  { id: 12, timeSec: 100, timeLabel: "01:40", emoji: "🔥", description: "환호 소리",         enabled: true },
  { id: 13, timeSec: 121, timeLabel: "02:01", emoji: "💭", description: "아 진짜 예쁘다",    enabled: true },
  { id: 14, timeSec: 150, timeLabel: "02:30", emoji: "💎", description: "바람 소리",         enabled: true },
];

export const DUMMY_EDIT_VIDEO = {
  title: "자연 다큐멘터리 Vol.1",
  duration: "12:34",
  totalSec: 754,
  thumbnail: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop",
};
