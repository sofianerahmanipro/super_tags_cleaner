"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TagDiff } from "@/components/tag-diff";
import type { ProcessingResult } from "@/lib/engine/docx-processor";

interface FileResultCardProps {
  result: ProcessingResult;
}

export function FileResultCard({ result }: FileResultCardProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasFixed = result.fixedTags.length > 0;

  function handleCopy() {
    const text = result.fixedTags.map((t) => t.fixed).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3 flex-wrap">
          {result.success ? (
            <CheckCircle2 size={18} className="text-(--success) shrink-0" />
          ) : (
            <XCircle size={18} className="text-(--error) shrink-0" />
          )}

          <span className="text-sm font-medium text-foreground truncate flex-1">
            {result.fileName}
          </span>

          {result.success ? (
            <Badge
              variant="outline"
              className={
                hasFixed
                  ? "border-(--accent-orange) text-(--accent-orange)"
                  : "border-(--success) text-(--success)"
              }
            >
              {hasFixed
                ? `${result.fixedTags.length} tag${result.fixedTags.length > 1 ? "s" : ""} corrigé${result.fixedTags.length > 1 ? "s" : ""}`
                : "Aucun tag cassé"}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-(--error) text-(--error)">
              Erreur
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {!result.success && result.error && (
          <p className="text-xs text-(--error) mt-1">{result.error}</p>
        )}

        {result.success && !hasFixed && (
          <p className="text-xs text-muted-foreground mt-1">Aucun tag cassé détecté ✅</p>
        )}

        {result.success && hasFixed && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <div className="mt-1 flex items-center gap-1">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary"
                >
                  {open ? (
                    <><ChevronUp size={14} className="mr-1" /> Masquer les détails</>
                  ) : (
                    <><ChevronDown size={14} className="mr-1" /> Voir les détails</>
                  )}
                </Button>
              </CollapsibleTrigger>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                {copied ? (
                  <><Check size={14} className="mr-1 text-(--success)" /> Copié</>
                ) : (
                  <><Copy size={14} className="mr-1" /> Copier les tags</>
                )}
              </Button>
            </div>

            <CollapsibleContent>
              <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-border bg-secondary px-3 py-1">
                {result.fixedTags.map((tag, i) => (
                  <TagDiff key={i} tag={tag} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
