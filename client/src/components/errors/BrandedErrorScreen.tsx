import type { ReactNode } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type BrandedErrorScreenAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export type BrandedErrorScreenProps = {
  subtitle: string;
  description: string;
  action?: BrandedErrorScreenAction;
  layout?: "page" | "content";
  children?: ReactNode;
};

function ErrorContent({
  subtitle,
  description,
  action,
  children,
}: Omit<BrandedErrorScreenProps, "layout">) {
  return (
    <div className="w-full max-w-lg text-center">
      <h1 className="text-4xl font-bold text-foreground">Uh oh!</h1>
      <h2 className="mt-4 text-2xl font-medium text-muted-foreground">{subtitle}</h2>
      <p className="mt-4 text-base text-muted-foreground">{description}</p>
      {children}
      {action && (
        <div className="mt-8">
          {action.href ? (
            <Button asChild>
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : (
            <Button onClick={action.onClick}>{action.label}</Button>
          )}
        </div>
      )}
    </div>
  );
}

export function BrandedErrorScreen({
  subtitle,
  description,
  action,
  layout = "page",
  children,
}: BrandedErrorScreenProps) {
  if (layout === "content") {
    return (
      <div className={cn("flex items-center justify-center p-8 py-16")}>
        <ErrorContent subtitle={subtitle} description={description} action={action}>
          {children}
        </ErrorContent>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center p-8">
        <ErrorContent subtitle={subtitle} description={description} action={action}>
          {children}
        </ErrorContent>
      </main>
    </div>
  );
}
