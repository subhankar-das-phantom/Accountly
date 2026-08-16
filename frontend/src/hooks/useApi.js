import useSWR, { mutate as globalMutate } from 'swr';
import api from '../services/api';

// Generic fetcher — SWR passes the key (URL) as the first argument
const fetcher = (url) => api.get(url).then((res) => res.data);

/**
 * Custom SWR hook for GET requests.
 *
 * @param {string|null} endpoint  — API path (e.g. 'transactions/stats').
 *                                   Pass `null` to skip fetching (conditional fetch).
 * @param {object}      options   — SWR config overrides.
 * @returns {{ data, error, isLoading, isValidating, mutate }}
 */
export const useApi = (endpoint, options = {}) => {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    endpoint,   // null key = don't fetch
    fetcher,
    {
      revalidateOnFocus: true,      // re-fetch when user tabs back
      revalidateOnReconnect: true,  // re-fetch when network reconnects
      dedupingInterval: 2000,       // dedupe identical requests within 2s
      errorRetryCount: 3,           // retry failed requests up to 3 times
      ...options,
    }
  );

  return { data, error, isLoading, isValidating, mutate };
};

/**
 * Invalidate all SWR keys matching a prefix.
 * Call after mutations (create/update/delete) to refresh related data.
 *
 * Example: invalidatePrefix('transactions') will revalidate
 *          'transactions', 'transactions/stats', 'transactions/chart-data', etc.
 */
export { globalMutate };
