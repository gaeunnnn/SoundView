// 공유 앨범 관련 타입 정의 파일
export type Participant = {
  id: number;
  name: string;
  avatarColor: string;
  profileImageUrl?: string | null;
  isMe?: boolean;
  code?: string;
};

export type EmojiReaction = {
  emoji: string;
  count: number;
  reacted: boolean;
};

export type SharedVideoItem = {
  id: number;      // album_videos.id — 리액션, 댓글, 목록 필터링용
  videoId: number; // videos.id — 삭제, 제목 수정용
  title: string;
  date: string;
  duration: string;
  thumbnail: string;
  uploadedBy: Participant;
  reactions: EmojiReaction[];
  commentCount: number;
};

export type SharedAlbumDetail = {
  id: number;
  name: string;
  participants: Participant[];
  videos: SharedVideoItem[];
};
