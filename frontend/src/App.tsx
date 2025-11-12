import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import AgreementsPage from "./pages/AgreementsPage";
import SetupPage from "./pages/SetupPage";
import DemoPage from "./pages/DemoPage";
import JournalLoadingPage from "./pages/JournalLoadingPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "demo",
        element: <DemoPage />,
      },
      {
        path: "privacy",
        element: <PrivacyPage />,
      },
      {
        path: "terms",
        element: <TermsPage />,
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: "dashboard",
            element: <DashboardPage />,
          },
          {
            path: "agreements",
            element: <AgreementsPage />,
          },
          {
            path: "setup",
            element: <SetupPage />,
          },
          {
            path: "journal/:journalId/loading",
            element: <JournalLoadingPage />,
          },
          {
            path: "journal/:id",
            element: <JournalPage />,
          },
          // Add other protected routes here
        ],
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
