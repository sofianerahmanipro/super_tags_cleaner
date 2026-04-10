"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, File, FileText, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SyntaxErrorItem } from "@/components/syntax-error-item";
import type { AnalysisResult } from "@/lib/engine/syntax-analyzer";
import type { SyntaxError } from "@/lib/engine/syntax-rules";

interface ErrorReportCardProps {
  result: AnalysisResult;
}

interface PageGroup {
  label: string;
  page: number | undefined;
  errors: SyntaxError[];
}

function groupErrorsByPage(errors: SyntaxError[]): PageGroup[] {
  const pageMap = new Map<string, PageGroup>();

  for (const error of errors) {
    const key = error.page !== undefined ? String(error.page) : "headers";
    if (!pageMap.has(key)) {
      pageMap.set(key, {
        label: error.page !== undefined ? `~Page ${error.page}` : "En-têtes et pieds de page",
        page: error.page,
        errors: [],
      });
    }
    pageMap.get(key)!.errors.push(error);
  }

  return [...pageMap.values()].sort((a, b) => {
    if (a.page === undefined && b.page === undefined) return 0;
    if (a.page === undefined) return 1;
    if (b.page === undefined) return -1;
    return a.page - b.page;
  });
}

const COLLAPSE_THRESHOLD = 5;

function PageGroupSection({ group, showTooltip }: { group: PageGroup; showTooltip?: boolean }) {
  const defaultOpen = group.errors.length <= COLLAPSE_THRESHOLD;
  const [open, setOpen] = useState(defaultOpen);
  const isCollapsible = group.errors.length > COLLAPSE_THRESHOLD;

  const errorCount = group.errors.filter((e) => e.severity === "error").length;
  const warningCount = group.errors.filter((e) => e.severity === "warning").length;

  const sorted = [...group.errors].sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === "error" ? -1 : 1;
  });

  const header = (
    <div className="flex items-center gap-2 py-2 px-1">
      {group.page !== undefined ? (
        <File size={13} className="shrink-0 text-muted-foreground" />
      ) : (
        <FileText size={13} className="shrink-0 text-muted-foreground" />
      )}
      <span className="text-xs font-semibold text-foreground">{group.label}</span>
      {showTooltip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle size={14} className="text-primary shrink-0 cursor-help" />
          </TooltipTrigger>
          <TooltipContent>
            <p>Les numéros de page sont approximatifs et peuvent différer de votre document.</p>
          </TooltipContent>
        </Tooltip>
      )}
      <span className="text-[11px] text-muted-foreground">
        — {errorCount > 0 && `${errorCount} erreur${errorCount > 1 ? "s" : ""}`}
        {errorCount > 0 && warningCount > 0 && ", "}
        {warningCount > 0 && `${warningCount} avert.`}
      </span>
      {isCollapsible && (
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
      )}
    </div>
  );

  if (!isCollapsible) {
    return (
      <div>
        <div className="border-b border-border/50 mb-2">{header}</div>
        <div className="space-y-2">
          {sorted.map((error, i) => (
            <SyntaxErrorItem key={i} error={error} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full text-left border-b border-border/50 mb-2 cursor-pointer">
        {header}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2">
          {sorted.map((error, i) => (
            <SyntaxErrorItem key={i} error={error} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ErrorReportCard({ result }: ErrorReportCardProps) {
  const errorCount = result.errors.filter((e) => e.severity === "error").length;
  const warningCount = result.errors.filter((e) => e.severity === "warning").length;
  const total = result.errors.length;

  const useGrouped = result.totalPages > 1;

  const sorted = [...result.errors].sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === "error" ? -1 : 1;
  });

  const groups = useGrouped ? groupErrorsByPage(result.errors) : [];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={15} className="shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground truncate">{result.fileName}</span>
          </div>

          {total === 0 ? (
            <Badge className="shrink-0 bg-(--success)/15 text-(--success) border-(--success)/30 hover:bg-(--success)/15">
              ✅ Aucune erreur
            </Badge>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              {errorCount > 0 && (
                <Badge className="bg-(--error)/15 text-(--error) border-(--error)/30 hover:bg-(--error)/15">
                  {errorCount} erreur{errorCount > 1 ? "s" : ""}
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge className="bg-[hsl(45,86%,59%)]/15 text-[hsl(45,86%,59%)] border-[hsl(45,86%,59%)]/30 hover:bg-[hsl(45,86%,59%)]/15">
                  {warningCount} avert.
                </Badge>
              )}
            </div>
          )}
        </div>

        {result.error && <p className="mt-2 text-xs text-(--error)">{result.error}</p>}
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-2">
        {total === 0 ? (
          <div className="flex items-center gap-2 text-sm text-(--success)">
            <CheckCircle2 size={16} />
            Aucune erreur de syntaxe détectée
          </div>
        ) : useGrouped ? (
          <div className="space-y-4">
            {groups.map((group, i) => (
              <PageGroupSection
                key={group.page ?? "headers"}
                group={group}
                showTooltip={
                  group.page !== undefined && i === groups.findIndex((g) => g.page !== undefined)
                }
              />
            ))}
          </div>
        ) : (
          sorted.map((error, i) => <SyntaxErrorItem key={i} error={error} />)
        )}
      </CardContent>
    </Card>
  );
}
