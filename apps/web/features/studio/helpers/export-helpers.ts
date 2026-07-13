import type { NovelDocxParagraph } from "../../../lib/novel-store";

export function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  downloadBlob(filename, blob);
}

export function downloadBytesFile(filename: string, content: Uint8Array, type: string) {
  const buffer = new ArrayBuffer(content.byteLength);
  new Uint8Array(buffer).set(content);
  downloadBlob(filename, new Blob([buffer], { type }));
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function createNovelDocxParagraphXml(paragraph: NovelDocxParagraph): string {
  const styleMarkup = {
    title:
      "<w:pPr><w:jc w:val=\"center\"/><w:spacing w:after=\"240\"/></w:pPr><w:rPr><w:b/><w:sz w:val=\"56\"/><w:szCs w:val=\"56\"/></w:rPr>",
    subtitle:
      "<w:pPr><w:spacing w:after=\"120\"/></w:pPr><w:rPr><w:i/><w:color w:val=\"666666\"/><w:sz w:val=\"22\"/></w:rPr>",
    "chapter-heading":
      "<w:pPr><w:spacing w:before=\"480\" w:after=\"240\"/></w:pPr><w:rPr><w:b/><w:sz w:val=\"32\"/></w:rPr>",
    body: "<w:pPr><w:spacing w:after=\"200\" w:line=\"360\" w:lineRule=\"auto\"/><w:ind w:firstLine=\"420\"/></w:pPr><w:rPr><w:sz w:val=\"24\"/></w:rPr>",
  }[paragraph.style];

  return `<w:p><w:r>${styleMarkup}<w:t xml:space="preserve">${escapeXml(paragraph.text.replace(/\n/g, " "))}</w:t></w:r></w:p>`;
}

export function createNovelBookDocxFile(paragraphs: NovelDocxParagraph[]): Uint8Array {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs
    .map(createNovelDocxParagraphXml)
    .join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    },
    { name: "word/document.xml", content: documentXml },
  ];

  return createZipStore(
    files.map((file) => ({
      name: file.name,
      content: new TextEncoder().encode(file.content),
    })),
  );
}

export function createZipStore(files: Array<{ name: string; content: Uint8Array }>) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.content);
    const local = buildZipLocalHeader({
      crc,
      compressedSize: file.content.length,
      uncompressedSize: file.content.length,
      nameLength: nameBytes.length,
    });
    chunks.push(local, nameBytes, file.content);
    centralDirectory.push(
      buildZipCentralDirectoryHeader({
        crc,
        compressedSize: file.content.length,
        uncompressedSize: file.content.length,
        nameLength: nameBytes.length,
        localHeaderOffset: offset,
      }),
      nameBytes,
    );
    offset += local.length + nameBytes.length + file.content.length;
  });
  const centralStart = offset;
  const centralSize = centralDirectory.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = buildZipEndRecord({
    entries: files.length,
    centralSize,
    centralStart,
  });

  return concatBytes([...chunks, ...centralDirectory, end]);
}

export function buildZipLocalHeader(input: {
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  nameLength: number;
}) {
  const bytes = new Uint8Array(30);
  const view = new DataView(bytes.buffer);

  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, input.crc, true);
  view.setUint32(18, input.compressedSize, true);
  view.setUint32(22, input.uncompressedSize, true);
  view.setUint16(26, input.nameLength, true);
  view.setUint16(28, 0, true);

  return bytes;
}

export function buildZipCentralDirectoryHeader(input: {
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  nameLength: number;
  localHeaderOffset: number;
}) {
  const bytes = new Uint8Array(46);
  const view = new DataView(bytes.buffer);

  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, input.crc, true);
  view.setUint32(20, input.compressedSize, true);
  view.setUint32(24, input.uncompressedSize, true);
  view.setUint16(28, input.nameLength, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, input.localHeaderOffset, true);

  return bytes;
}

export function buildZipEndRecord(input: {
  entries: number;
  centralSize: number;
  centralStart: number;
}) {
  const bytes = new Uint8Array(22);
  const view = new DataView(bytes.buffer);

  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, input.entries, true);
  view.setUint16(10, input.entries, true);
  view.setUint32(12, input.centralSize, true);
  view.setUint32(16, input.centralStart, true);
  view.setUint16(20, 0, true);

  return bytes;
}

export function concatBytes(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;

  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.length;
  });
  return bytes;
}

export function crc32(bytes: Uint8Array) {
  let crc = -1;

  for (const byte of bytes) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
