import { strToU8, Zip, ZipDeflate } from "fflate";

import type { ExportFile } from "./files";

/**
 * Files as a zip, made as it's read: each one compressed and passed on, so nothing is
 * stored on the way.
 */
export function zipStream(files: ExportFile[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const zip = new Zip((error, chunk, final) => {
        if (error) {
          controller.error(error);
          return;
        }
        controller.enqueue(chunk);
        if (final) controller.close();
      });
      for (const file of files) {
        const entry = new ZipDeflate(file.path, { level: 6 });
        zip.add(entry);
        entry.push(strToU8(file.content), true);
      }
      zip.end();
    },
  });
}
