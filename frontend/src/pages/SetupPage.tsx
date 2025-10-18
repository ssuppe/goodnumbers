// file: frontend/src/pages/SetupPage.tsx
import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useApiForm } from "../hooks/useApiForm";
import { GlucoseUnit } from "@goodnumbers/common";

export default function SetupPage() {
  const { user, refetchSession } = useAuth();
  const navigate = useNavigate();

  // Form state remains local
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [preferredUnits, setPreferredUnits] = useState<GlucoseUnit>("MGDL");

  useEffect(() => {
    if (user) {
      setUrl(user.nightscoutUrl ?? "");
      setPreferredUnits(user.preferredUnits ?? "MGDL");
    }
  }, [user]);

  const [handleApiSubmit, isSubmitting, error] = useApiForm(
    async (data: {
      nightscoutUrl: string | null;
      nightscoutToken: string | null;
      preferredUnits: GlucoseUnit;
    }) => {
      await api.put("/user/settings", data);
      await refetchSession();
      navigate("/dashboard");
    },
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      nightscoutUrl: url.trim() === "" ? null : url.trim(),
      nightscoutToken: token.trim() === "" ? null : token.trim(),
      preferredUnits,
    };
    void handleApiSubmit(payload);
  };

  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      <h1 className="text-3xl font-bold text-center">Account Setup</h1>
      <p className="text-center text-gray-600 mt-2">
        Connect your Nightscout instance to get started.
      </p>
      <div className="mt-8 p-8 border rounded-lg bg-white shadow-sm">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div>
              <label
                htmlFor="nightscoutUrl"
                className="block text-sm font-medium text-gray-700"
              >
                Nightscout URL
              </label>
              <input
                type="text"
                id="nightscoutUrl"
                name="nightscoutUrl"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                placeholder="https://your-nightscout-site.com"
              />
            </div>
            <div>
              <label
                htmlFor="nightscoutToken"
                className="block text-sm font-medium text-gray-700"
              >
                Nightscout Token
              </label>
              <input
                type="password"
                id="nightscoutToken"
                name="nightscoutToken"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              />
              {user?.nightscoutTokenLast3 && (
                <p className="mt-1 text-sm text-gray-500">
                  Token is set, ending in ...{user.nightscoutTokenLast3}. Leave
                  blank to keep it.
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="preferredUnits"
                className="block text-sm font-medium text-gray-700"
              >
                Preferred Units
              </label>
              <select
                id="preferredUnits"
                name="preferredUnits"
                value={preferredUnits}
                onChange={(e) =>
                  setPreferredUnits(e.target.value as GlucoseUnit)
                }
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              >
                <option value="MGDL">mg/dL</option>
                <option value="MMOL">mmol/L</option>
              </select>
            </div>
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            )}
            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isSubmitting ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
