import * as htmlToImage from "html-to-image";
import type { Diagram } from "@/schema";
import { stringifyDiagram } from "@/lib/yaml";

export function serializeDiagramForExport(diagram: Diagram): string {
  return stringifyDiagram(diagram);
}

export function exportYaml(diagram: Diagram): string {
  const text = serializeDiagramForExport(diagram);
  const blob = new Blob([text], { type: "application/x-yaml" });
  triggerDownload(blob, `archflow-${Date.now()}.yaml`);
  return text;
}

export async function exportPng(element: HTMLElement): Promise<void> {
  const dataUrl = await htmlToImage.toPng(element, { pixelRatio: 2 });
  triggerDownload(dataURLToBlob(dataUrl), `archflow-${Date.now()}.png`);
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function dataURLToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
