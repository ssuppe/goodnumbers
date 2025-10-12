import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useApiForm } from '../hooks/useApiForm';

export default function AgreementsPage() {
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const navigate = useNavigate();

  // This boolean determines if the form is valid and the button should be enabled.
  const canContinue = termsAgreed && privacyAgreed;

  // Use our custom hook to manage the form's submission state.
  // On success, it automatically navigates to the next step in the onboarding flow.
  const [handleApiSubmit, isSubmitting, error] = useApiForm(async (data: { agreementsSigned: boolean }) => {
    await api.put('/user/settings', data);
    navigate('/setup');
  });

  // This function handles the form's onSubmit event.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canContinue) {
      // We call the handler from our hook, passing the required payload.
      void handleApiSubmit({ agreementsSigned: true });
    }
  };

  return (
    <div className="bg-light pt-12">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-extrabold text-gray-900 text-center">Welcome to GoodNumbers</h1>
          <p className="mt-2 text-center text-gray-600">Before we can create your account, you must review and accept the agreements below.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="relative flex items-start">
              <div className="flex h-6 items-center">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(e) => setTermsAgreed(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
              <div className="ml-3 text-sm leading-6">
                <label htmlFor="terms" className="text-gray-700 text-base">
                  I accept the <Link to="/terms" className="font-medium v3-primary-text hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Terms and Conditions</Link>. I understand that <strong className="font-bold">GoodNumbers is an experimental project, is NOT medical advice</strong>, and may provide incorrect or misleading information. I confirm that I will <strong className="font-bold">always consult a healthcare professional</strong> before making any changes to my diabetic healthcare plan, insulin usage, or device settings. I accept all responsibility and liability for the use of this software.
                </label>
              </div>
            </div>

            <div className="relative flex items-start">
              <div className="flex h-6 items-center">
                <input
                  id="privacy"
                  name="privacy"
                  type="checkbox"
                  checked={privacyAgreed}
                  onChange={(e) => setPrivacyAgreed(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
              <div className="ml-3 text-sm leading-6">
                <label htmlFor="privacy" className="text-gray-700 text-base">
                  I have read and accept the <Link to="/privacy" className="font-medium v3-primary-text hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Privacy Policy</Link>. I consent to the storage and processing of my pseudonymized health data (including any treatment, CGM data, Nightscout data, etc) for the purpose of journal analysis and feature development. I understand I am responsible for the data I share.
                </label>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm font-medium text-critical-red">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={!canContinue || isSubmitting}
                className="flex w-full justify-center rounded-lg px-4 py-3 text-base font-semibold text-white shadow-sm transition-colors duration-150 disabled:bg-gray-400 disabled:text-gray-700 enabled:v3-bg-primary enabled:v3-hover-bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {isSubmitting ? 'Saving and Continuing...' : 'Accept and Continue to Setup'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}