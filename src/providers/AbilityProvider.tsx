import React, { createContext, useContext, useEffect, useMemo } from "react";
import { createContextualCan } from "@casl/react";
import type { AppAbility } from "../../contracts/ability";
import { defineAbilityFor } from "../../contracts/ability";
import { useAuth } from "../hooks/use-auth";
import { trpc } from "./trpc";

export const AbilityContext = createContext<AppAbility>(undefined as any);
export const Can = createContextualCan(AbilityContext.Consumer);

export function useAbility() {
  return useContext(AbilityContext);
}

export const AbilityProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, token, setUser, logout } = useAuth();

  useEffect(() => {
    if (user && !token) {
      logout();
    }
  }, [user, token, logout]);
  
  const { data: serverUser, error } = trpc.auth.me.useQuery(undefined, {
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (error?.data?.code === "UNAUTHORIZED") {
      logout();
      window.location.href = "/login";
    }
  }, [error, logout]);

  useEffect(() => {
    if (!token || !serverUser) return;
    if (JSON.stringify(serverUser) !== JSON.stringify(user)) {
      setUser(serverUser);
    }
  }, [serverUser, setUser, token, user]);

  const ability = useMemo(() => {
    if (user) {
      return defineAbilityFor({ id: user.id, role: user.role });
    }
    // Default guest ability
    return defineAbilityFor({ id: 0, role: "guest" });
  }, [user]);

  return (
    <AbilityContext.Provider value={ability}>
      {children}
    </AbilityContext.Provider>
  );
};
