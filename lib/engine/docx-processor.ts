import JSZip from "jszip";
import { saveAs } from "file-saver";
import { cleanBrokenTags, type FixedTag } from "./tag-cleaner";

export interface ProcessingResult {
  fileName: string;
  fixedTags: FixedTag[];
  success: boolean;
  error?: string;
}

export async function processDocx(file: File): Promise<ProcessingResult> {
  const baseName = file.name.replace(/\.docx$/i, "");

  try {
    const zip = await JSZip.loadAsync(file);
    const allFixedTags: FixedTag[] = [];

    const xmlFiles = Object.keys(zip.files).filter(
      (name) => name.startsWith("word/") && name.endsWith(".xml")
    );

    for (const xmlPath of xmlFiles) {
      const content = await zip.file(xmlPath)!.async("string");
      const { cleaned, fixedTags } = cleanBrokenTags(content, xmlPath);
      allFixedTags.push(...fixedTags);
      zip.file(xmlPath, cleaned);
    }

    const blob = await zip.generateAsync({
      type: "blob",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    saveAs(blob, `${baseName}_fixed.docx`);

    return {
      fileName: file.name,
      fixedTags: allFixedTags,
      success: true,
    };
  } catch (error) {
    return {
      fileName: file.name,
      fixedTags: [],
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}
