import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import HomePage from "./HomePage";
import * as useAuthModule from "../hooks/useAuth"; // Import the module
import { type SessionUser } from "../contexts/AuthTypes"; // Import SessionUser type

// Mock the useAuth hook and useNavigate
vi.mock("../hooks/useAuth");
const mockedUseAuth = vi.mocked(useAuthModule.useAuth);

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("HomePage", () => {
  beforeEach(() => {
    mockedUseAuth.mockClear();
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      error: null,
    }); // Default unauthenticated state
    mockNavigate.mockClear();
  });

  it("renders marketing content for unauthenticated users", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", {
        name: /A smart weekly journal for type 1 diabetics/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/See a demo/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Register" })).toBeInTheDocument();
  });

  it("shows loading state when auth context is loading", () => {
    mockedUseAuth.mockReturnValue({ user: null, isLoading: true, error: null });
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: /A smart weekly journal for type 1 diabetics/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("redirects authenticated users to the dashboard", () => {
    const mockUser: SessionUser = {
      id: "1",
      email: "test@example.com",
      name: "Test User",
      agreementsSigned: true,
      nightscoutUrl: "http://ns.com",
      preferredUnits: "MGDL",
    };
    mockedUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      error: null,
    });
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true }); // This is the primary assertion
    expect(
      screen.queryByRole("heading", {
        name: /A smart weekly journal for type 1 diabetics/i,
      }),
    ).not.toBeInTheDocument();
  });
});
