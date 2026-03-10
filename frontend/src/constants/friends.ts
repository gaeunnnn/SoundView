// 친구 찾기 모달에서 사용하는 더미 데이터 파일
export type FriendItem = {
  id: number;
  name: string;
  email: string;
  personalCode: string;
};

export const FRIEND_LIST: FriendItem[] = [
  {
    id: 1,
    name: "김지은",
    email: "jieun@example.com",
    personalCode: "A7J5HXN3",
  },
  {
    id: 2,
    name: "박준호",
    email: "junho@example.com",
    personalCode: "M4Q9LZP2",
  },
  {
    id: 3,
    name: "최하늘",
    email: "haneul@example.com",
    personalCode: "R8TX5NWD",
  },
];