/** Server-safe mirror of the light-theme semantic tokens in styles.css. */
export const presentation = {
  navy: "#002A5F", primary: "#054492", link: "#005CAB", mid: "#1D6CB5",
  sky: "#0091D5", cyan: "#00B5EE", grey: "#939598",
  surface: "#FFFFFF", background: "#F7F9FC", text: "#002A5F",
  muted: "#62666C", border: "#CFD9E5", infoSurface: "#E3F3FC",
  success: "#18734B", destructive: "#B42332",
} as const;

export function printRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
}

export function pdfRgb(hex: string): [number, number, number] {
  return printRgb(hex).map((channel) => channel / 255) as [number, number, number];
}