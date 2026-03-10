// 공유 앨범 관련 타입 정의 파일
export type Participant = {
  id: number;
  name: string;
  avatarColor: string;
  isMe?: boolean;
};

export type EmojiReaction = {
  emoji: string;
  count: number;
  reacted: boolean;
};

export type SharedVideoItem = {
  id: number;
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
