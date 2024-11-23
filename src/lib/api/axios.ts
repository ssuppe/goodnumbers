import axios from "axios";
import axiosRetry from "axios-retry";

export const createApiClient = () => {
  const axiosInstance = axios.create({
    timeout: 300000, // 5 minutes
  });

  axiosRetry(axiosInstance, {
    retries: 5,
    retryDelay: axiosRetry.exponentialDelay,
    shouldResetTimeout: true,
    retryCondition: (error) => {
      return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.code === 'ECONNRESET';
    },
  });

  return axiosInstance;
};

  export const apiClient = createApiClient();