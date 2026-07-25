import { Injectable } from "@nestjs/common";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as Minio from "minio";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";

interface StoredObject {
  key: string;
  size: number;
  mimeType: string;
}

@Injectable()
export class StorageService {
  private readonly driver = process.env.STORAGE_DRIVER || "local";
  private readonly localRoot = path.resolve(process.cwd(), process.env.LOCAL_UPLOAD_DIR || "server/uploads");
  private readonly bucket = process.env.MINIO_BUCKET || "hannao-assets";
  private minio?: Minio.Client;

  constructor() {
    if (this.driver === "minio") {
      this.minio = new Minio.Client({
        endPoint: process.env.MINIO_ENDPOINT || "127.0.0.1",
        port: Number(process.env.MINIO_PORT || 9000),
        useSSL: process.env.MINIO_USE_SSL === "true",
        accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
        secretKey: process.env.MINIO_SECRET_KEY || "minioadmin"
      });
    }
  }

  async put(key: string, buffer: Buffer, mimeType: string): Promise<StoredObject> {
    if (this.minio) {
      if (!(await this.minio.bucketExists(this.bucket))) await this.minio.makeBucket(this.bucket);
      await this.minio.putObject(this.bucket, key, buffer, buffer.length, { "Content-Type": mimeType });
      return { key, size: buffer.length, mimeType };
    }

    const target = path.join(this.localRoot, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buffer);
    return { key, size: buffer.length, mimeType };
  }

  async signedUrl(key: string, expiresSeconds = 300) {
    if (this.minio) return this.minio.presignedGetObject(this.bucket, key, expiresSeconds);
    return `/api/files/content/${encodeURIComponent(key)}`;
  }

  private localPath(key: string) {
    const target = path.resolve(this.localRoot, key);
    if (target !== this.localRoot && !target.startsWith(`${this.localRoot}${path.sep}`)) throw new Error("非法文件路径");
    return target;
  }

  private async seedPlaceholder(key: string) {
    const document = await PDFDocument.create();
    const page = document.addPage([595, 842]);
    const font = await document.embedFont(StandardFonts.Helvetica);
    page.drawText("Hannao intangible asset attachment", { x: 58, y: 760, size: 20, font, color: rgb(0.08, 0.34, 0.45) });
    page.drawText(`Storage key: ${key.replace(/[^\x20-\x7E]/g, "_")}`, { x: 58, y: 725, size: 9, font, color: rgb(0.35, 0.4, 0.43) });
    page.drawText("Local development placeholder. Replace it through the admin upload flow.", { x: 58, y: 690, size: 10, font });
    return Buffer.from(await document.save());
  }

  async read(key: string) {
    if (this.minio) {
      try {
        const stream = await this.minio.getObject(this.bucket, key);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(Buffer.from(chunk));
        return Buffer.concat(chunks);
      } catch (error) {
        if (!key.startsWith("seed/")) throw error;
        return this.seedPlaceholder(key);
      }
    }
    const target = this.localPath(key);
    try {
      return await readFile(target);
    } catch (error) {
      if (!key.startsWith("seed/")) throw error;
      return this.seedPlaceholder(key);
    }
  }

  private watermarkSvg(width: number, height: number, label: string) {
    const safe = label.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] || character);
    return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="rgba(255,255,255,.72)"/><text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" font-family="PingFang SC,Noto Sans CJK SC,Arial,sans-serif" font-size="${Math.max(14, Math.round(height * .22))}" fill="rgba(23,78,95,.72)">${safe}</text></svg>`);
  }

  async watermarked(key: string, mimeType: string, label?: string) {
    const source = await this.read(key);
    if (!label) return source;
    if (mimeType === "application/pdf") {
      const document = await PDFDocument.load(source);
      const overlay = await sharp(this.watermarkSvg(1400, 150, label)).png().toBuffer();
      const image = await document.embedPng(overlay);
      document.setSubject(label);
      for (const page of document.getPages()) {
        const width = page.getWidth();
        const height = width * (150 / 1400);
        page.drawImage(image, { x: 0, y: 12, width, height, opacity: 0.88 });
      }
      return Buffer.from(await document.save());
    }
    if (mimeType.startsWith("image/")) {
      const metadata = await sharp(source).metadata();
      const width = Math.max(320, metadata.width || 1200);
      const height = Math.max(54, Math.round(width * 0.075));
      return sharp(source).composite([{ input: this.watermarkSvg(width, height, label), gravity: "south" }]).toBuffer();
    }
    return source;
  }

  localStream(key: string) {
    const target = this.localPath(key);
    return existsSync(target) ? createReadStream(target) : null;
  }
}
