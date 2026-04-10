import { Badge } from "@/components/ui/badge";
import type { SyntaxError } from "@/lib/engine/syntax-analyzer";

interface SyntaxErrorItemProps {
  error: SyntaxError;
}

function HighlightedMessage({ message }: { message: string }) {
  const parts = message.split(/(\{[^}]*\})/g);
  return (
    <span>
      {parts.map((part, i) =>
        /^\{[^}]*\}$/.test(part) ? (
          <code
            key={i}
            className="px-1 py-0.5 rounded text-xs font-mono bg-(--accent-orange)/15 text-(--accent-orange)"
          >
            {part}
          </code>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

export function SyntaxErrorItem({ error }: SyntaxErrorItemProps) {
  const isError = error.severity === "error";

  return (
    <div
      className={`flex gap-3 rounded-lg px-4 py-3 border ${
        isError
          ? "bg-(--error)/5 border-(--error)/20"
          : "bg-[hsl(45,86%,59%)]/5 border-[hsl(45,86%,59%)]/20"
      }`}
    >
      <span className="mt-0.5 shrink-0 text-base leading-none">
        {isError ? "🔴" : "🟡"}
      </span>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-sm text-foreground leading-snug">
          <HighlightedMessage message={error.message} />
        </p>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="h-5 px-1.5 text-[10px] font-mono border-border text-muted-foreground"
          >
            {error.rule}
          </Badge>
          {error.occurrence !== undefined && error.occurrence > 1 && (
            <span className="text-[10px] text-muted-foreground">
              occurrence {error.occurrence}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
