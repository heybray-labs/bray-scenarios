import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Tag } from "lucide-react";

export type ClassificationChipOption = {
  slug: string;
  label: string;
  color?: string | null;
  icon?: string | null;
};

function kebabToPascal(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function resolveLucideIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Tag;
  const pascal = kebabToPascal(name.trim().toLowerCase());
  const icon = (LucideIcons as unknown as Record<string, LucideIcon | undefined>)[pascal];
  return icon ?? Tag;
}

export function classificationChipStyle(color: string) {
  return {
    color,
    backgroundColor: `${color}18`,
    borderColor: `${color}40`,
  } as const;
}

export function solidClassificationChipStyle(color: string) {
  return {
    color: "#ffffff",
    backgroundColor: color,
    borderColor: color,
  } as const;
}

/** Opaque equivalent of tag pill alpha on white: 0x18 ≈ 9%, 0x40 ≈ 25%. */
export function overlayClassificationChipStyle(color: string) {
  return {
    color,
    backgroundColor: `color-mix(in srgb, ${color} 9%, white)`,
    borderColor: `color-mix(in srgb, ${color} 25%, white)`,
  } as const;
}

export function overlayPillStyle(color: string) {
  return overlayClassificationChipStyle(color);
}
