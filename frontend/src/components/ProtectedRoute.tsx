// file: frontend/src/components/ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    // Render a loading indicator while session is being fetched
    return <div>Loading session...</div>;
  }

  if (!user) {
    // User is not authenticated, redirect to the home/login page.
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // User is authenticated, now check onboarding status.
  if (!user.agreementsSigned) {
    // If agreements are not signed, they must go to the agreements page.
    // We allow navigation only if they are already heading there.
    if (location.pathname !== "/agreements") {
      return <Navigate to="/agreements" replace />;
    }
  } else if (!user.nightscoutUrl) {
    // If agreements are signed but setup is not complete, redirect to setup.
    // We allow navigation only if they are already heading there.
    if (location.pathname !== "/setup") {
      return <Navigate to="/setup" replace />;
    }
  } else if (location.pathname === "/agreements") {
    // If user is fully onboarded, prevent access to onboarding pages and redirect to dashboard.
    return <Navigate to="/dashboard" replace />;
  }

  // If all onboarding checks pass, render the requested child route.
  return <Outlet />;
}
