/**
 * A simple utility to escape special HTML characters in a string.
 * This is a critical security function to prevent Stored XSS attacks when
 * rendering user-provided data in server-side HTML templates.
 * @param str The input string to escape.
 * @returns The escaped string.
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
