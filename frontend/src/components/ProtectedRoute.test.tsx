import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import * as useAuthModule from "../hooks/useAuth";
import { type SessionUser } from "../contexts/AuthTypes";

// Mock the useAuth hook
vi.mock("../hooks/useAuth");
const useAuthMock = vi.mocked(useAuthModule.useAuth);

// A helper component to display the current path
const LocationDisplay = () => <div>Current Path: {useLocation().pathname}</div>;
const ProtectedContent = () => <div>Protected Content</div>;

describe("ProtectedRoute", () => {
  beforeEach(() => {
    useAuthMock.mockClear();
    // Default mock value: authenticated, fully onboarded user
    useAuthMock.mockReturnValue({
      user: {
        id: "1",
        name: "Test User",
        email: "test@example.com",
        agreementsSigned: true,
        nightscoutUrl: "http://test.nightscout.com",
        preferredUnits: "MGDL",
      } as SessionUser, // Cast to SessionUser
      isLoading: false,
      error: null,
    });
  });

  it("renders loading state while auth context is loading", () => {
    useAuthMock.mockReturnValue({
      user: null,
      isLoading: true,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<ProtectedContent />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading session...")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated users to the home page", async () => {
    useAuthMock.mockReturnValue({
      user: null,
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<ProtectedContent />} />
          </Route>
          <Route path="/" element={<LocationDisplay />} />{" "}
          {/* Home page route */}
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
      expect(screen.getByText("Current Path: /")).toBeInTheDocument();
    });
  });

  it("redirects authenticated users with unsigned agreements to /agreements", async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: "1",
        name: "Test User",
        email: "test@example.com",
        agreementsSigned: false, // Agreements not signed
        nightscoutUrl: null,
        preferredUnits: "MGDL",
      } as SessionUser,
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<ProtectedContent />} />
          </Route>
          <Route path="/agreements" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
      expect(screen.getByText("Current Path: /agreements")).toBeInTheDocument();
    });
  });

  it("redirects authenticated users with signed agreements but incomplete setup to /setup", async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: "1",
        name: "Test User",
        email: "test@example.com",
        agreementsSigned: true, // Agreements signed
        nightscoutUrl: null, // Setup incomplete
        preferredUnits: "MGDL",
      } as SessionUser,
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<ProtectedContent />} />
          </Route>
          <Route path="/setup" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
      expect(screen.getByText("Current Path: /setup")).toBeInTheDocument();
    });
  });

  it("renders children for fully onboarded authenticated users", async () => {
    // Default mock value from beforeEach is already a fully onboarded user
    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<ProtectedContent />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("redirects fully onboarded users from /agreements to /dashboard", async () => {
    render(
      <MemoryRouter initialEntries={["/agreements"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/agreements" element={<ProtectedContent />} />
          </Route>
          <Route path="/dashboard" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
      expect(screen.getByText("Current Path: /dashboard")).toBeInTheDocument();
    });
  });

  it("allows fully onboarded users to access the /setup page", async () => {
    render(
      <MemoryRouter initialEntries={["/setup"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/setup" element={<ProtectedContent />} />
          </Route>
          <Route path="/dashboard" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
      expect(
        screen.queryByText("Current Path: /dashboard"),
      ).not.toBeInTheDocument();
    });
  });
});
