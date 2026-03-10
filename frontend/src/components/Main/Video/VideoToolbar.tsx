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
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <h2 className="text-[26px] font-bold text-[#111827]">전체 영상</h2>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative w-full sm:w-[300px]">
          <Search
            size={18}
            strokeWidth={2}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]"
          />
          <input
            type="text"
            value={searchKeyword}
            onChange={(event) => onChangeSearchKeyword(event.target.value)}
            placeholder="영상 검색"
            className="h-[48px] w-full rounded-full border border-[#E5EAF1] bg-white pl-11 pr-4 text-sm text-[#111827] outline-none transition-colors placeholder:text-[#B6BFCC] focus:border-[#93C5FD]"
          />
        </div>

        <select
          value={sortOption}
          onChange={(event) =>
            onChangeSortOption(event.target.value as SortOption)
          }
          className="h-[48px] min-w-[112px] rounded-full border border-[#E5EAF1] bg-white px-4 text-sm font-semibold text-[#374151] outline-none transition-colors focus:border-[#93C5FD]"
        >
          <option value="latest">최신순</option>
          <option value="oldest">오래된순</option>
        </select>
      </div>
    </div>
  );
}