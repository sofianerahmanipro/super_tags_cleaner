import type { FixedTag } from "@/lib/engine/tag-cleaner";

interface TagDiffProps {
  tag: FixedTag;
}

export function TagDiff({ tag }: TagDiffProps) {
  return (
    <div className="flex items-center gap-2 py-1.5 text-xs font-mono">
      <span className="px-2 py-0.5 rounded bg-(--error)/20 text-(--error) line-through">
        {tag.original}
      </span>
      <span className="text-muted-foreground shrink-0">→</span>
      <span className="px-2 py-0.5 rounded bg-(--success)/20 text-(--success)">
        {tag.fixed}
      </span>
      <span className="ml-auto shrink-0 flex items-center gap-2 text-muted-foreground">
        <span className="px-1.5 py-0.5 rounded bg-border">
          {tag.fragments} fragments
        </span>
        {tag.file && tag.file.replace("word/", "")}
      </span>
    </div>
  );
}
