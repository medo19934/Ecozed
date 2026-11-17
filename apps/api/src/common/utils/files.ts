import { StreamableFile } from '@nestjs/common';

/** Private, non-cacheable file response with a safe Content-Disposition. */
export const fileResponse = (buffer: Buffer, mimeType: string, name: string, inline = false) =>
  new StreamableFile(buffer, {
    type: mimeType,
    disposition: `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(name)}`,
    length: buffer.length,
  });

/** multer gives latin1-decoded names; restore UTF-8 (Arabic file names). */
export const decodeFileName = (name: string): string => {
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
};
