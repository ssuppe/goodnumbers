import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AgreementsPage from './AgreementsPage';

import { useApiForm, type Submitter, type HandleSubmit } from '../hooks/useApiForm';

// Define the specific type for the form data used on this page for type-safe mocking.
type AgreementsFormData = { agreementsSigned: boolean };

// 1. Use vi.mock() to create a simple auto-mock of the module.
// This is hoisted by Vitest and replaces the real implementation.
vi.mock('../hooks/useApiForm');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// 2. After mocking, cast the imported function to its explicit Mock type.
// This provides a definitive, type-safe reference for the rest of the test file.
const mockedUseApiForm = useApiForm as Mock<
  [Submitter<AgreementsFormData>],
  [HandleSubmit<AgreementsFormData>, boolean, string | null]
>;

describe('AgreementsPage', () => {
  beforeEach(() => {
    // 3. This call is now guaranteed to be type-safe.
    mockedUseApiForm.mockClear();
    mockedUseApiForm.mockReturnValue([vi.fn(), false, null]);
    mockNavigate.mockClear();
  });

  it('renders all required text, checkboxes, and a disabled button', () => {
    render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

    // Check for V3 spec content
    expect(screen.getByRole('heading', { name: /Welcome to GoodNumbers/i })).toBeInTheDocument();
    expect(screen.getByText(/Before we can create your account/i)).toBeInTheDocument();

    // Check for both checkbox labels
    const termsCheckbox = screen.getByLabelText(/i accept the terms and conditions/i);
    const privacyCheckbox = screen.getByLabelText(/i have read and accept the privacy policy/i);
    expect(termsCheckbox).toBeInTheDocument();
    expect(privacyCheckbox).toBeInTheDocument();
    expect(termsCheckbox).not.toBeChecked();
    expect(privacyCheckbox).not.toBeChecked();

    // Check for the button and its initial disabled state
    const continueButton = screen.getByRole('button', { name: /Accept and Continue to Setup/i });
    expect(continueButton).toBeInTheDocument();
    expect(continueButton).toBeDisabled();
  });

  it('enables the continue button only when both checkboxes are checked', () => {
    render(<MemoryRouter><AgreementsPage /></MemoryRouter>);
    const termsCheckbox = screen.getByLabelText(/i accept the terms and conditions/i);
    const privacyCheckbox = screen.getByLabelText(/i have read and accept the privacy policy/i);
    const continueButton = screen.getByRole('button', { name: /Accept and Continue to Setup/i });

    // Check one, button should still be disabled
    fireEvent.click(termsCheckbox);
    expect(termsCheckbox).toBeChecked();
    expect(privacyCheckbox).not.toBeChecked();
    expect(continueButton).toBeDisabled();

    // Check the other, button should now be enabled
    fireEvent.click(privacyCheckbox);
    expect(termsCheckbox).toBeChecked();
    expect(privacyCheckbox).toBeChecked();
    expect(continueButton).toBeEnabled();

    // Uncheck one, button should become disabled again
    fireEvent.click(termsCheckbox);
    expect(termsCheckbox).not.toBeChecked();
    expect(continueButton).toBeDisabled();
  });

  it('calls the api submission hook with correct data when submitted', () => {
    // This function is the one we want to track for this specific test
    const mockHandleSubmit = vi.fn();
    
    // Override the default mock from beforeEach for this specific test case
    mockedUseApiForm.mockReturnValue([mockHandleSubmit, false, null]);

    render(<MemoryRouter><AgreementsPage /></MemoryRouter>);

    // Enable the button
    fireEvent.click(screen.getByLabelText(/i accept the terms and conditions/i));
    fireEvent.click(screen.getByLabelText(/i have read and accept the privacy policy/i));

    // Click the button and verify our specific submission handler was called
    fireEvent.click(screen.getByRole('button', { name: /Accept and Continue to Setup/i }));
    expect(mockHandleSubmit).toHaveBeenCalledWith({ agreementsSigned: true });
  });
});