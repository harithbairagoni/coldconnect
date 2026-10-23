import { useRouter, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

export type AppBackFallback =
  | string
  | {
      to: string;
      search?: Record<string, unknown>;
    };

/**
 * Hook to navigate backward in browser history.
 * If browser history is available, it goes back in history.
 * Otherwise, it navigates to the specified fallback route with search parameters safely.
 */
export function useAppBack(fallback: AppBackFallback = "/") {
  const router = useRouter();
  const navigate = useNavigate();

  const goBack = useCallback(() => {
    try {
      // If we have history in the browser session, go back
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
    } catch (err) {
      console.warn("[useAppBack] history.back() failed, using fallback:", err);
    }

    try {
      if (typeof fallback === "string") {
        const [path, searchStr] = fallback.split("?");
        if (searchStr) {
          const params: Record<string, string> = {};
          new URLSearchParams(searchStr).forEach((val, key) => {
            params[key] = val;
          });
          navigate({ to: path as never, search: params as never });
          return;
        }
        navigate({ to: fallback as never });
        return;
      }

      navigate({
        to: fallback.to as never,
        search: (fallback.search || {}) as never,
      });
    } catch (navErr) {
      console.error("[useAppBack] Navigation fallback failed:", navErr);
      navigate({ to: "/" as never });
    }
  }, [navigate, fallback]);

  return goBack;
}
