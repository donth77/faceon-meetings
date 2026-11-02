/** Saves text as a file in the browser's downloads, named after something the reader knows. */
export function downloadFile(input: {
  /** The file's name without its extension; characters file systems reject are replaced. */
  name: string;
  extension: string;
  content: string;
  type: string;
}): void {
  const url = URL.createObjectURL(
    new Blob([input.content], { type: `${input.type};charset=utf-8` }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${input.name.replace(/[\/:*?"<>|]+/g, "-")}.${input.extension}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Saves a file the server made (a CSV or a zip, say) under the name it gave. */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name.replace(/[\/:*?"<>|]+/g, "-");
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
