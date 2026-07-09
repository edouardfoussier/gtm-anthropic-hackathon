import { cn } from "@/lib/utils";

export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1600px] px-6 py-8 md:px-20 md:py-10",
        className,
      )}
    >
      {children}
    </div>
  );
}
