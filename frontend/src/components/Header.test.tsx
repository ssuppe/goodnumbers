import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Header from "./Header";
import * as AuthContext from "../hooks/useAuth"; // Import the actual module for type inference

// Mock the module and define the mock implementation directly in the factory
vi.mock("../hooks/useAuth", async (importOriginal) => {
  const actual = await importOriginal<typeof AuthContext>(); // Get actual types
  return {
    ...actual, // Keep original exports if needed
    useAuth: vi.fn(), // Define the mock for useAuth here
  };
});

// Get a reference to the mocked useAuth function for test manipulation
const mockedUseAuth = vi.mocked(AuthContext.useAuth);

describe("Header", () => {
  beforeEach(() => {
    // Reset the mock before each test
    mockedUseAuth.mockClear();
    // Set a default mock return value to avoid undefined issues in tests
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      error: null,
    });
  });

  it("renders login link for unauthenticated users", () => {
    // No need to call mockReturnValue here if default is set in beforeEach
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );
    const loginLink = screen.getByText("Login");
    const registerLink = screen.getByText("Register");
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute("href", "/login");
    expect(registerLink).toBeInTheDocument();
    expect(registerLink).toHaveAttribute("href", "/register");
  });

  it("renders settings and logout links for authenticated users", () => {
    mockedUseAuth.mockReturnValue({
      user: { id: "1", name: "Test" },
      isLoading: false,
      error: null,
    }); // Override default for this test
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Logout")).toBeInTheDocument();
  });
});
