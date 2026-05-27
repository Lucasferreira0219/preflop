import * as RT from "@radix-ui/react-tooltip";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <RT.Provider delayDuration={250} skipDelayDuration={300}>
      {children}
    </RT.Provider>
  );
}

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  if (!content) return <>{children}</>;
  return (
    <RT.Root>
      <RT.Trigger asChild>{children}</RT.Trigger>
      <RT.Portal>
        <RT.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-[240px] rounded-ctl border border-border bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink shadow-pop data-[state=delayed-open]:animate-fade-in"
        >
          {content}
          <RT.Arrow className="fill-surface-2" />
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  );
}
