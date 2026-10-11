/** Server-safe mirror of the light-theme semantic tokens in styles.css. */
export const presentation = {
  navy: "#082E5E", primary: "#28468E", link: "#426CB2", mid: "#426CB2",
  sky: "#1E90D1", cyan: "#4EB4EB", grey: "#939598",
  surface: "#FFFFFF", background: "#F7F9FC", text: "#080909",
  muted: "#62666C", border: "#CFD9E5", infoSurface: "#E8F4FC",
  success: "#18734B", destructive: "#B42332",
} as const;

export function printRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
}

export function pdfRgb(hex: string): [number, number, number] {
  return printRgb(hex).map((channel) => channel / 255) as [number, number, number];
}