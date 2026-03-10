// 메인 페이지 영상 카드와 툴바에 사용하는 타입 정의 파일
export type VideoItem = {
  id: number;
  title: string;
  date: string;
  duration: string;
  thumbnail: string;
};

export type SortOption = "latest" | "oldest";