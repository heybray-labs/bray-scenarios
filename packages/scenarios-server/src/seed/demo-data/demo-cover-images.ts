import {
  BadgeDollarSign,
  ClipboardCheck,
  Clock,
  Handshake,
  Megaphone,
  MessageCircleWarning,
  PhoneCall,
  RefreshCcw,
  Sparkles,
  Stethoscope,
  UserPlus,
  UserSearch,
  type IconNode,
} from "lucide";
import sharp from "sharp";

const COVER_WIDTH = 1200;
const COVER_HEIGHT = 675;
const ICON_VIEWBOX = 24;
const ICON_SCALE = 6;

export type DemoCoverArt = {
  icon: IconNode;
  background: string;
  foreground: string;
};

/** Pastel background + contrasting icon color, with a Lucide icon per base demo slug. */
export const DEMO_COVER_ART: Record<string, DemoCoverArt> = {
  "handling-angry-customer": {
    icon: MessageCircleWarning,
    background: "#FFE4E6",
    foreground: "#BE123C",
  },
  "negotiating-raise": {
    icon: BadgeDollarSign,
    background: "#FEF3C7",
    foreground: "#B45309",
  },
  "delivering-bad-news": {
    icon: Megaphone,
    background: "#EDE9FE",
    foreground: "#6D28D9",
  },
  "cold-call-sales": {
    icon: PhoneCall,
    background: "#E0F2FE",
    foreground: "#0369A1",
  },
  "breaking-medical-news": {
    icon: Stethoscope,
    background: "#CCFBF1",
    foreground: "#0F766E",
  },
  "performance-review": {
    icon: ClipboardCheck,
    background: "#E0E7FF",
    foreground: "#4338CA",
  },
  "workplace-conflict": {
    icon: Handshake,
    background: "#FFEDD5",
    foreground: "#C2410C",
  },
  "upselling-premium": {
    icon: Sparkles,
    background: "#D1FAE5",
    foreground: "#047857",
  },
  "skeptical-candidate": {
    icon: UserSearch,
    background: "#DBEAFE",
    foreground: "#1D4ED8",
  },
  "product-delay": {
    icon: Clock,
    background: "#F1F5F9",
    foreground: "#475569",
  },
  "new-hire-check-in": {
    icon: UserPlus,
    background: "#ECFCCB",
    foreground: "#4D7C0F",
  },
  "at-risk-renewal": {
    icon: RefreshCcw,
    background: "#CFFAFE",
    foreground: "#0E7490",
  },
};

function serializeAttrs(attrs: Record<string, string | number | undefined>): string {
  return Object.entries(attrs)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      const kebab = key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
      return `${kebab}="${String(value).replace(/"/g, "&quot;")}"`;
    })
    .join(" ");
}

function iconNodesToSvg(nodes: IconNode): string {
  return nodes
    .map(([tag, attrs]) => `<${tag} ${serializeAttrs(attrs)} />`)
    .join("\n    ");
}

export function demoCoverBaseSlug(slug: string): string {
  return slug.replace(/-variant-\d+$/, "");
}

export function resolveDemoCoverArt(slug: string): DemoCoverArt {
  const baseSlug = demoCoverBaseSlug(slug);
  const art = DEMO_COVER_ART[baseSlug];
  if (!art) {
    throw new Error(`No demo cover art configured for slug: ${slug}`);
  }
  return art;
}

export function renderCoverSvgFromArt({ icon, background, foreground }: DemoCoverArt): string {
  const tx = COVER_WIDTH / 2 - (ICON_VIEWBOX / 2) * ICON_SCALE;
  const ty = COVER_HEIGHT / 2 - (ICON_VIEWBOX / 2) * ICON_SCALE;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_WIDTH}" height="${COVER_HEIGHT}" viewBox="0 0 ${COVER_WIDTH} ${COVER_HEIGHT}" role="img" aria-hidden="true">
  <rect width="${COVER_WIDTH}" height="${COVER_HEIGHT}" fill="${background}" />
  <g transform="translate(${tx} ${ty}) scale(${ICON_SCALE})" fill="none" stroke="${foreground}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${iconNodesToSvg(icon)}
  </g>
</svg>`;
}

export function renderDemoCoverSvg(slug: string): string {
  return renderCoverSvgFromArt(resolveDemoCoverArt(slug));
}

export async function renderCoverImageFromArt(art: DemoCoverArt): Promise<Buffer> {
  const svg = renderCoverSvgFromArt(art);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function renderDemoCoverImage(slug: string): Promise<Buffer> {
  return renderCoverImageFromArt(resolveDemoCoverArt(slug));
}
