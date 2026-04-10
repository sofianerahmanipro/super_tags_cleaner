"use client";

import { useState, useCallback } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropZone } from "@/components/drop-zone";
import { ErrorReportCard } from "@/components/error-report-card";
import { analyzeDocx, type AnalysisResult } from "@/lib/engine/syntax-analyzer";
import { toast } from "sonner";
import { features } from "@/utils/features";

export default function CleanSyntaxPage() {
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const isWip = features.find((f) => f.href === "/clean-syntax")?.wip;

  const handleFiles = useCallback(async (files: File[]) => {
    setProcessing(true);
    try {
      const newResults = await Promise.all(files.map((f) => analyzeDocx(f)));
      setResults((prev) => [...newResults, ...prev]);

      const failed = newResults.filter((r) => !r.success);
      const totalErrors = newResults.reduce(
        (sum, r) => sum + r.errors.filter((e) => e.severity === "error").length,
        0,
      );
      const totalWarnings = newResults.reduce(
        (sum, r) => sum + r.errors.filter((e) => e.severity === "warning").length,
        0,
      );

      if (failed.length > 0) {
        toast.error(`${failed.length} fichier(s) en erreur`);
      } else if (totalErrors === 0 && totalWarnings === 0) {
        toast.success("Aucune erreur de syntaxe détectée ✅");
      } else {
        const parts = [];
        if (totalErrors > 0) parts.push(`${totalErrors} erreur${totalErrors > 1 ? "s" : ""}`);
        if (totalWarnings > 0)
          parts.push(`${totalWarnings} avertissement${totalWarnings > 1 ? "s" : ""}`);
        toast.warning(parts.join(", ") + " détecté(s)");
      }
    } finally {
      setProcessing(false);
    }
  }, []);

  return (
    <div className="w-[80%] mx-auto py-12 space-y-8">
      <div className='flex justify-between items-center'>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Clean My Syntaxe</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Déposez vos fichiers .docx — les tags Dendreo seront analysés et les erreurs de syntaxe
            listées. Le fichier n&apos;est pas modifié.
          </p>
        </div>
        {isWip ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
            Beta
          </span>
        ) : null}
      </div>

      <DropZone onFiles={handleFiles} disabled={processing} />

      {processing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          Analyse en cours…
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">
              Résultats ({results.length} fichier{results.length > 1 ? "s" : ""})
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResults([])}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-(--error) hover:bg-secondary"
            >
              <Trash2 size={13} className="mr-1" />
              Tout effacer
            </Button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
            {results.map((result, i) => (
              <ErrorReportCard key={`${result.fileName}-${i}`} result={result} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
