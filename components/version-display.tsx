"use client";

import { useState } from "react";
import { PATCH_NOTES, type PatchNote } from "@/utils/patch-notes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function formatDateFr(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function LevelBadge({ level }: { level: PatchNote["level"] }) {
  if (level === 0) {
    return (
      <Badge variant="secondary" className="text-xs">
        Fix
      </Badge>
    );
  }
  if (level === 1) {
    return (
      <Badge
        className="text-xs border-transparent text-white"
        style={{ backgroundColor: "var(--accent-orange)" }}
      >
        Nouveauté
      </Badge>
    );
  }
  return (
    <Badge
      className="text-xs border-transparent text-white"
      style={{ backgroundColor: "var(--success)" }}
    >
      Majeure
    </Badge>
  );
}

export function VersionDisplay() {
  const [open, setOpen] = useState(false);

  const latest = PATCH_NOTES[0];
  const isRecent =
    Date.now() - new Date(latest.date).getTime() < SEVEN_DAYS_MS;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative text-muted-foreground text-xs hover:text-foreground transition-colors cursor-pointer"
      >
        version {latest.version}
        {isRecent && (
          <span
            className="absolute -top-1 -right-2 w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ backgroundColor: "var(--accent-orange)" }}
          />
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Notes de mise à jour</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-3">
              {PATCH_NOTES.map((note) => (
                <Card key={note.version}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
                    <div className="flex items-center gap-2">
                      <LevelBadge level={note.level} />
                      <span className="font-bold text-sm">version {note.version}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatDateFr(note.date)}
                    </span>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <p className="text-sm">{note.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
