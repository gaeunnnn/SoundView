// 공유 앨범 더미 데이터 파일
import type { SharedAlbumDetail } from "../types/sharedAlbum";

const ME = { id: 0, name: "박민준", avatarColor: "#8B5CF6", isMe: true };
const JIEUN = { id: 1, name: "김지은", avatarColor: "#14B8A6" };
const JUNHO = { id: 2, name: "박준호", avatarColor: "#3B82F6" };

export const SHARED_ALBUM_DETAILS: SharedAlbumDetail[] = [
  {
    id: 101,
    name: "김지은",
    participants: [ME, JIEUN],
    videos: [
      {
        id: 201,
        title: "야시장 먹방 투어",
        date: "2026.02.22",
        duration: "3:15",
        thumbnail:
          "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1200&auto=format&fit=crop",
        uploadedBy: JIEUN,
        reactions: [
          { emoji: "🔥", count: 3, reacted: false },
          { emoji: "❤️", count: 1, reacted: true },
          { emoji: "😆", count: 2, reacted: false },
        ],
        commentCount: 3,
      },
      {
        id: 202,
        title: "불꽃놀이",
        date: "2026.02.28",
        duration: "12:34",
        thumbnail:
          "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop",
        uploadedBy: ME,
        reactions: [
          { emoji: "🔥", count: 2, reacted: true },
          { emoji: "❤️", count: 1, reacted: false },
          { emoji: "😆", count: 3, reacted: false },
        ],
        commentCount: 3,
      },
      {
        id: 203,
        title: "봄 벚꽃 드라이브",
        date: "2026.03.01",
        duration: "5:42",
        thumbnail:
          "https://images.unsplash.com/photo-1522383225653-ed111181a951?q=80&w=1200&auto=format&fit=crop",
        uploadedBy: JIEUN,
        reactions: [
          { emoji: "🔥", count: 1, reacted: false },
          { emoji: "❤️", count: 4, reacted: true },
          { emoji: "😆", count: 0, reacted: false },
        ],
        commentCount: 1,
      },
      {
        id: 204,
        title: "주말 카페 투어",
        date: "2026.03.05",
        duration: "8:20",
        thumbnail:
          "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=1200&auto=format&fit=crop",
        uploadedBy: ME,
        reactions: [
          { emoji: "🔥", count: 0, reacted: false },
          { emoji: "❤️", count: 2, reacted: false },
          { emoji: "😆", count: 1, reacted: false },
        ],
        commentCount: 0,
      },
    ],
  },
  {
    id: 102,
    name: "박준호",
    participants: [ME, JUNHO],
    videos: [
      {
        id: 301,
        title: "농구 경기 하이라이트",
        date: "2026.02.15",
        duration: "7:30",
        thumbnail:
          "https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1200&auto=format&fit=crop",
        uploadedBy: JUNHO,
        reactions: [
          { emoji: "🔥", count: 5, reacted: true },
          { emoji: "❤️", count: 0, reacted: false },
          { emoji: "😆", count: 1, reacted: false },
        ],
        commentCount: 5,
      },
      {
        id: 302,
        title: "주말 등산",
        date: "2026.02.20",
        duration: "4:10",
        thumbnail:
          "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop",
        uploadedBy: ME,
        reactions: [
          { emoji: "🔥", count: 2, reacted: false },
          { emoji: "❤️", count: 1, reacted: true },
          { emoji: "😆", count: 0, reacted: false },
        ],
        commentCount: 2,
      },
    ],
  },
];
