import React from "react";
import { Navigate, Outlet } from "react-router";
import { useAbility } from "../providers/AbilityProvider";
import type { Actions, Subjects } from "../../contracts/ability";

interface ProtectedRouteProps {
  action: Actions;
  subject: Subjects;
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  action,
  subject,
  redirectTo = "/",
}) => {
  const ability = useAbility();

  if (ability.cannot(action, subject)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
};
