"use client";

import { useState, useCallback } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropZone } from "@/components/drop-zone";
import { FileResultCard } from "@/components/file-result-card";
import { processDocx, type ProcessingResult } from "@/lib/engine/docx-processor";
import { toast } from "sonner";

export default function CleanTagsPage() {
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [processing, setProcessing] = useState(false);

  const handleFiles = useCallback(async (files: File[]) => {
    setProcessing(true);
    try {
      const newResults = await Promise.all(files.map((f) => processDocx(f)));
      setResults((prev) => [...newResults, ...prev]);

      const totalFixed = newResults.reduce(
        (sum, r) => sum + r.fixedTags.length,
        0
      );
      const errors = newResults.filter((r) => !r.success);

      if (errors.length > 0) {
        toast.error(`${errors.length} fichier(s) en erreur`);
      } else if (totalFixed > 0) {
        toast.success(
          `${totalFixed} tag${totalFixed > 1 ? "s" : ""} corrigé${totalFixed > 1 ? "s" : ""} — téléchargement en cours`
        );
      } else {
        toast.info("Aucun tag cassé détecté dans les fichiers traités");
      }
    } finally {
      setProcessing(false);
    }
  }, []);

  return (
    <div className="w-[80%] mx-auto py-12 space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">
          Clean My Tags
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Déposez vos fichiers .docx — les tags Dendreo cassés seront
          automatiquement réparés et le fichier corrigé téléchargé.
        </p>
      </div>

      <DropZone onFiles={handleFiles} disabled={processing} />

      {processing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          Traitement en cours…
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
              <FileResultCard key={`${result.fileName}-${i}`} result={result} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
