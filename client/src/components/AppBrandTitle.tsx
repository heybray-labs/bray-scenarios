type AppBrandTitleProps = {
  appName: string;
  size?: "default" | "large";
};

// Navbar uses text-xs (12px) over body text (14px) — keep that ratio when scaling up.
const sizeStyles = {
  default: {
    wordmark: "text-xs",
    title: "font-semibold text-gray-900",
  },
  large: {
    wordmark: "text-[calc(1.5rem*12/14)]",
    title: "text-2xl font-semibold text-gray-900",
  },
} as const;

export function AppBrandTitle({ appName, size = "default" }: AppBrandTitleProps) {
  const styles = sizeStyles[size];

  return (
    <div className="flex flex-col gap-0 leading-none">
      <span className={`font-medium text-primary ${styles.wordmark}`}>heybray</span>
      <span className={styles.title}>{appName}</span>
    </div>
  );
}
