// 로그인한 사용자 정보를 전역으로 관리하는 컨텍스트
import { createContext, useContext, useEffect, useState } from "react";
import { getMyProfile } from "../api/user";
import type { UserProfile } from "../api/user";

type UserContextValue = {
  me: UserProfile | null;
};

const UserContext = createContext<UserContextValue>({ me: null });

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<UserProfile | null>(null);

  useEffect(() => {
    getMyProfile().then(setMe).catch(() => {});
  }, []);

  return <UserContext.Provider value={{ me }}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}
