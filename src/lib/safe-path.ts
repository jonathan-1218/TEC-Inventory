/**
 * Sanitise a user-supplied post-login / post-action redirect target to a same-site path.
 *
 * Only a path beginning with a single "/" not followed by "/" or "\" is allowed — "//host" and
 * "/\host" are protocol-relative and resolve cross-origin in browsers. We also reject C0 control
 * characters and DEL: the URL parser strips tab/newline/CR mid-string, so "/\t//evil.com" would
 * otherwise slip past the prefix check and collapse to "//evil.com". Anything else falls back to "/".
 */
export function safePath(value: unknown): string {
  if (typeof value !== "string") return "/"
  if (!/^\/(?![/\\])/.test(value)) return "/"
  if (/[\u0000-\u001f\u007f]/.test(value)) return "/"
  return value
}
