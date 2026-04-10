"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export function DropZone({ onFiles, disabled = false }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function filterDocx(files: FileList | null): File[] {
    if (!files) return [];
    return Array.from(files).filter(
      (f) =>
        f.name.toLowerCase().endsWith(".docx") ||
        f.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;
    const valid = filterDocx(e.dataTransfer.files);
    if (valid.length > 0) onFiles(valid);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const valid = filterDocx(e.target.files);
    if (valid.length > 0) onFiles(valid);
    e.target.value = "";
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative flex flex-col items-center justify-center gap-4
        min-h-52 rounded-xl border-2 border-dashed cursor-pointer
        transition-colors duration-150 select-none
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        ${
          isDragging
            ? "border-(--accent-orange) bg-(--accent-orange)/5"
            : "border-border bg-card hover:border-(--accent-orange)/60 hover:bg-secondary"
        }
      `}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        multiple
        className="sr-only"
        onChange={handleInputChange}
        disabled={disabled}
      />

      <UploadCloud
        size={40}
        className={
          isDragging ? "text-(--accent-orange)" : "text-muted-foreground"
        }
      />

      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">
          Glissez vos fichiers .docx ici
        </p>
        <p className="text-xs text-muted-foreground">
          ou cliquez pour parcourir
        </p>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="border-border text-foreground hover:border-(--accent-orange) hover:text-(--accent-orange) pointer-events-none"
        tabIndex={-1}
      >
        Parcourir
      </Button>
    </div>
  );
}
