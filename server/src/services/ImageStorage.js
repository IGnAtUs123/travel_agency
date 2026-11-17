import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const PATH_RE = /^\/uploads\/[0-9a-f-]{36}\.(jpg|png)$/;

/** Определяет формат по сигнатуре файла (а не по заявленному типу). */
function detectExtension(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  return null;
}

/** Сохранение файлов изображений туров на диск. В БД хранится только путь вида /uploads/<uuid>.jpg */
export class ImageStorage {
  constructor(dir) {
    this.dir = dir;
  }

  /** Сохраняет один файл и возвращает его публичный путь. */
  async save(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error('Пустой файл');
    if (buffer.length > MAX_IMAGE_BYTES) throw new Error('Размер файла превышает 5 МБ');
    const ext = detectExtension(buffer);
    if (!ext) throw new Error('Допустимы только изображения JPG и PNG');
    await fs.mkdir(this.dir, { recursive: true });
    const name = `${crypto.randomUUID()}.${ext}`;
    await fs.writeFile(path.join(this.dir, name), buffer);
    return `/uploads/${name}`;
  }

  /** Сохраняет несколько файлов; возвращает список путей. */
  async saveAll(buffers) {
    const paths = [];
    for (const b of buffers) paths.push(await this.save(b));
    return paths;
  }

  isValidPath(p) {
    return typeof p === 'string' && PATH_RE.test(p);
  }
}
