// 메인 페이지 영상 카드와 툴바에 사용하는 타입 정의 파일
export type VideoItem = {
  id: number;      // album_videos.id — 리액션, 댓글, 목록 필터링용
  videoId: number; // videos.id — 삭제, 제목 수정, 앨범 공유용
  title: string;
  date: string;
  duration: string;
  thumbnail: string;
  uploaderName: string;
  videoUrl?: string; // 로컬/데모 영상 URL (optional)
};

export type SortOption = "latest" | "oldest" | "title" | "uploader";