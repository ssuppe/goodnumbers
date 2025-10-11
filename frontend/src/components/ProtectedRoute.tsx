// file: frontend/src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute() {
  const { user, isLoading, error } = useAuth();

  if (isLoading) {
    // Optionally render a loading spinner or null
    return null;
  }

  if (error) {
    // Handle error state, e.g., redirect to an error page or display a message
    // For now, we'll just redirect to login if there's an error, or handle it more gracefully later.
    // The test doesn't explicitly cover error state for ProtectedRoute, so keeping it simple.
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    return <Navigate to="/api/auth/signin" replace />;
  }

  return <Outlet />;
}
