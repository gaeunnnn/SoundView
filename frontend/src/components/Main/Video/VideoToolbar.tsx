// 영상 목록 상단의 검색창과 정렬 영역을 렌더링하는 컴포넌트 파일
import { Search } from "lucide-react";
import type { SortOption } from "../../../types/video";

type VideoToolbarProps = {
  searchKeyword: string;
  sortOption: SortOption;
  onChangeSearchKeyword: (value: string) => void;
  onChangeSortOption: (value: SortOption) => void;
};

export default function VideoToolbar({
  searchKeyword,
  sortOption,
  onChangeSearchKeyword,
  onChangeSortOption,
}: VideoToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 sm:flex-none">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
          />
          <input
            type="text"
            value={searchKeyword}
            onChange={(event) => onChangeSearchKeyword(event.target.value)}
            placeholder="영상 검색"
            className="h-9 w-full sm:w-44 rounded-xl border border-[#E2E8F0] bg-white pl-8 pr-3 text-sm outline-none placeholder:text-[#CBD5E1] focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/10 shadow-sm"
          />
        </div>

        <select
          value={sortOption}
          onChange={(event) =>
            onChangeSortOption(event.target.value as SortOption)
          }
          className="flex h-9 items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm text-[#475569] shadow-sm transition-colors hover:bg-[#F0F4FF] hover:border-[#C7D7FD] hover:text-[#2563EB]"
        >
          <option value="latest">최신순</option>
          <option value="oldest">오래된순</option>
          <option value="title">제목순</option>
          <option value="uploader">작성자순</option>
        </select>
      </div>
    </div>
  );
}