// 영상 재생 페이지에서 사용하는 타입 정의 파일
export type ViewerVideo = {
  id: number;
  title: string;
  date: string;
  duration: string;
  thumbnail: string;
  videoUrl?: string;
  uploadedBy?: { name: string; isMe?: boolean };
};

export type Comment = {
  id: number;
  authorName: string;
  authorColor: string;
  isMe: boolean;
  text: string;
  timeAgo: string;
};

export type EmojiReaction = {
  emoji: string;
  count: number;
  reacted: boolean;
};
