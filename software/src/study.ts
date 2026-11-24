/** The study link is an isolated software-only preview, not a real connection. */
export function isStudySearch(search: string): boolean {
  return new URLSearchParams(search).get("study") === "1";
}

export function storageKeyFor(search: string): string {
  return isStudySearch(search) ? "university-radar:study:v1" : "university-radar:v1";
}

export const STUDY_MODE =
  typeof window !== "undefined" && isStudySearch(window.location.search);
