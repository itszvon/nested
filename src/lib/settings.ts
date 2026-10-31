/**
 * Per-user editor preferences, stored as jsonb on the profile so they follow
 * the account across devices.
 */

export type EditorSettings = {
  tabSize: 2 | 4;
  fontSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
};

export const DEFAULT_SETTINGS: EditorSettings = {
  tabSize: 2,
  fontSize: 13,
  wordWrap: false,
  lineNumbers: true,
};

export const FONT_SIZES = [12, 13, 14, 15, 16];

export function readSettings(raw: unknown): EditorSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  const value = raw as Partial<EditorSettings>;

  return {
    tabSize: value.tabSize === 4 ? 4 : 2,
    fontSize:
      typeof value.fontSize === "number" && FONT_SIZES.includes(value.fontSize)
        ? value.fontSize
        : DEFAULT_SETTINGS.fontSize,
    wordWrap: value.wordWrap === true,
    lineNumbers: value.lineNumbers !== false,
  };
}
