// file: frontend/src/pages/SetupPage.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SetupPage from "./SetupPage";
import * as useAuthModule from "../hooks/useAuth";
import { useApiForm } from "../hooks/useApiForm";
import { type SessionUser } from "../contexts/AuthTypes";

// Mock the hooks used by the component
vi.mock("../hooks/useAuth");
vi.mock("../hooks/useApiForm");

const mockedUseAuth = vi.mocked(useAuthModule.useAuth);
const mockedUseApiForm = useApiForm as Mock;

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("SetupPage", () => {
  const mockHandleSubmit = vi.fn();

  beforeEach(() => {
    mockedUseAuth.mockClear();
    mockedUseApiForm.mockClear();
    mockNavigate.mockClear();
    mockHandleSubmit.mockClear();

    // Default mock for useApiForm
    mockedUseApiForm.mockReturnValue([mockHandleSubmit, false, null]);
  });

  it("renders the form correctly for a new user", () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      error: null,
    });
    render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: /Account Setup/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Nightscout URL/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nightscout Token/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Preferred Units/i)).toBeInTheDocument();
    expect(screen.queryByText(/Token is set/i)).not.toBeInTheDocument();
  });

  it("pre-fills form data for an existing user but keeps token field blank", () => {
    const mockUser: SessionUser = {
      id: "1",
      nightscoutUrl: "https://my-test-site.com",
      preferredUnits: "MMOL",
      nightscoutTokenLast3: "xyz",
    };
    mockedUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(/Nightscout URL/i)).toHaveValue(
      mockUser.nightscoutUrl,
    );
    expect(screen.getByLabelText(/Preferred Units/i)).toHaveValue(
      mockUser.preferredUnits,
    );
    expect(screen.getByLabelText(/Nightscout Token/i)).toHaveValue(""); // Security: Token field should always be empty
  });

  it("displays the token hint when a token is already set", () => {
    const mockUser: SessionUser = { id: "1", nightscoutTokenLast3: "xyz" };
    mockedUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByText(/Token is set, ending in \.\.\.xyz/i),
    ).toBeInTheDocument();
  });

  it("converts empty string inputs to null on submission", async () => {
    mockedUseAuth.mockReturnValue({
      user: { id: "1" },
      isLoading: false,
      error: null,
    });
    render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/Nightscout URL/i), {
      target: { value: " " },
    }); // Whitespace
    fireEvent.change(screen.getByLabelText(/Nightscout Token/i), {
      target: { value: "" },
    }); // Empty

    fireEvent.click(screen.getByRole("button", { name: /Save Settings/i }));

    await waitFor(() => {
      expect(mockHandleSubmit).toHaveBeenCalledWith({
        nightscoutUrl: null,
        nightscoutToken: null, // Ensure empty string becomes null
        preferredUnits: "MGDL", // Default value
      });
    });
  });

  it("displays loading state and disables button during submission", () => {
    mockedUseApiForm.mockReturnValue([mockHandleSubmit, true, null]); // isSubmitting = true
    render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>,
    );

    const button = screen.getByRole("button", { name: /Saving\.\.\./i });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it("displays an error message on submission failure", () => {
    const errorMessage = "Failed to save";
    mockedUseApiForm.mockReturnValue([mockHandleSubmit, false, errorMessage]);
    render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });
});
