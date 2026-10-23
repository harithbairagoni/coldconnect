/**
 * LinkedIn URL Normalization Utility
 * Normalizes input LinkedIn URLs to canonical format:
 * https://www.linkedin.com/in/{identifier}
 * Rejects non-LinkedIn URLs.
 */

export function normalizeLinkedInUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  let cleaned = rawUrl.trim();
  if (!cleaned) return null;

  // Add protocol if missing
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    cleaned = `https://${cleaned}`;
  }

  try {
    const parsed = new URL(cleaned);
    const hostname = parsed.hostname.toLowerCase();

    // Verify it's a valid LinkedIn domain
    const isLinkedInHost =
      hostname === "linkedin.com" ||
      hostname === "www.linkedin.com" ||
      hostname.endsWith(".linkedin.com");

    if (!isLinkedInHost) {
      return null;
    }

    // Clean pathname
    let pathname = parsed.pathname;
    // Remove trailing slash
    pathname = pathname.replace(/\/+$/, "");

    // Path must not be empty or just slash
    if (!pathname || pathname === "/") {
      return null;
    }

    // Build canonical format
    return `https://www.linkedin.com${pathname}`;
  } catch {
    return null;
  }
}

export function isValidLinkedInUrl(url?: string | null): boolean {
  return normalizeLinkedInUrl(url) !== null;
}
