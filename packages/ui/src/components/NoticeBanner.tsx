import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils.ts";
import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

const noticeBannerVariants = cva("border", {
  variants: {
    variant: {
      urgent:
        "border-[var(--alert-urgent-border)] bg-[var(--alert-urgent-bg)] text-[var(--alert-urgent-text)]",
      timer:
        "border-[var(--alert-timer-border)] bg-[var(--alert-timer-bg)] text-[var(--alert-timer-text)]",
      info:
        "border-[var(--alert-info-border)] bg-[var(--alert-info-bg)] text-[var(--alert-info-text)]",
      admin:
        "border-[var(--admin-banner-border)] bg-[var(--admin-banner-bg)] text-[var(--admin-banner-text)]",
      rewards:
        "border-[var(--rewards-banner-border)] bg-[var(--rewards-banner-bg)] text-[var(--rewards-banner-text)] hover:bg-[var(--rewards-banner-hover)] transition-colors",
    },
    layout: {
      inline:
        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm",
      compact: "flex items-start gap-2 rounded-md p-2 text-sm",
      strip: "rounded-none border-x-0 border-t-0",
      rewards: "inline-flex items-center gap-3 rounded-full px-3 py-1.5 text-sm",
    },
  },
  defaultVariants: {
    layout: "compact",
  },
});

type NoticeBannerVariantProps = VariantProps<typeof noticeBannerVariants>;

type NoticeBannerProps = HTMLAttributes<HTMLDivElement> &
  NoticeBannerVariantProps;

export function NoticeBanner({
  variant,
  layout,
  className,
  ...props
}: NoticeBannerProps) {
  return (
    <div
      className={cn(noticeBannerVariants({ variant, layout }), className)}
      {...props}
    />
  );
}

type NoticeBannerButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  NoticeBannerVariantProps;

export function NoticeBannerButton({
  variant,
  layout,
  className,
  type = "button",
  ...props
}: NoticeBannerButtonProps) {
  return (
    <button
      type={type}
      className={cn(noticeBannerVariants({ variant, layout }), className)}
      {...props}
    />
  );
}

export function noticeLabelClassName() {
  return "text-[10px] font-medium uppercase tracking-wide text-[var(--rewards-banner-label)] opacity-80";
}
