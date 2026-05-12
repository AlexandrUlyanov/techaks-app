import React, { createContext, useContext, useMemo } from "react";
import { createContextualCan } from "@casl/react";
import type { AppAbility } from "../../contracts/ability";
import { defineAbilityFor } from "../../contracts/ability";
import { useAuth } from "../hooks/use-auth";

export const AbilityContext = createContext<AppAbility>(undefined as any);
export const Can = createContextualCan(AbilityContext.Consumer);

export function useAbility() {
  return useContext(AbilityContext);
}

export const AbilityProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();

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
