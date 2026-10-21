/** Erreur Tauri renvoyée quand une webview portant ce label existe déjà (course de création). */
export function isLabelConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /already exists/i.test(message);
}
