import { cn } from "@/lib/utils";

export function SectionHeader({
  index,
  eyebrow,
  title,
  supporting,
  className,
}: {
  index: string;
  eyebrow?: string;
  title: string;
  supporting?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-baseline gap-3">
        <span className="section-number text-2xl md:text-3xl">{index}</span>
        {eyebrow ? (
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {eyebrow}
          </span>
        ) : null}
      </div>
      <h2 className="text-4xl leading-[0.95] md:text-6xl">{title}</h2>
      {supporting ? (
        <p className="max-w-xl text-base text-muted-foreground">
          {supporting}
        </p>
      ) : null}
    </div>
  );
}
