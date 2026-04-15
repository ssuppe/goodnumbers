import axios from "axios";

// Define the shape of the data we expect from the CSRF token endpoint.
interface CsrfTokenResponse {
  csrfToken: string;
}

export const api = axios.create({
  baseURL: "/api", // The base URL will be proxied by Vite
  headers: {
    "Content-Type": "application/json",
  },
});

// Use an interceptor to dynamically add the CSRF token to relevant requests
api.interceptors.request.use(
  async (config) => {
    if (
      ["POST", "PUT", "DELETE"].includes(config.method?.toUpperCase() ?? "")
    ) {
      const { data } = await axios.get<CsrfTokenResponse>("/api/csrf-token");
      // Add explicit type assertion to satisfy the linter.
      config.data = { ...(config.data as object), _csrf: data.csrfToken };
    }
    return config;
  },
  (error) => {
    // Ensure we always reject with a proper Error object.
    if (error instanceof Error) {
      return Promise.reject(error);
    }
    return Promise.reject(new Error(String(error)));
  },
);

export const updateJournal = async (id: string, payload: unknown) => {
  return api.put(`/journals/${id}`, payload);
};

export const deleteJournal = async (id: string) => {
  return api.delete(`/journals/${id}`);
};
