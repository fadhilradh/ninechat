import { newId } from "./db"
import type { Attachment } from "./types"

/**
 * Vision models resample anything larger than roughly this anyway, and a
 * Netlify function body is capped well below what a phone camera produces --
 * so we shrink before the image ever leaves the browser.
 */
const MAX_EDGE = 1568
const JPEG_QUALITY = 0.85
const KEEP_ORIGINAL_UNDER = 200 * 1024

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]

export class ImageError extends Error {}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new ImageError("Could not read the file"))
    reader.readAsDataURL(blob)
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new ImageError("Could not encode the image"))),
      mime,
      quality
    )
  })
}

/**
 * Turns a picked file into a wire-ready attachment: downscaled, re-encoded,
 * and carrying its final dimensions so the composer can lay out a thumbnail
 * without a reflow.
 */
export async function fileToAttachment(file: File): Promise<Attachment> {
  if (!file.type.startsWith("image/")) {
    throw new ImageError(`${file.name} is not an image`)
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new ImageError(`${file.type} is not supported. Use PNG, JPEG, WebP or GIF.`)
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new ImageError(`Could not decode ${file.name}`)
  })

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const needsResize = scale < 1
  const smallEnough = file.size <= KEEP_ORIGINAL_UNDER

  // An animated GIF loses its animation the moment it hits a canvas, and a
  // small file is not worth re-encoding, so leave both alone.
  if ((!needsResize && smallEnough) || file.type === "image/gif") {
    const dataUrl = await readAsDataUrl(file)
    bitmap.close()
    return {
      id: newId(),
      name: file.name,
      mime: file.type,
      size: file.size,
      width: bitmap.width,
      height: bitmap.height,
      dataUrl,
    }
  }

  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext("2d")
  if (!ctx) throw new ImageError("This browser refused a 2D canvas")

  // PNGs with transparency go black on a JPEG background otherwise.
  const keepAlpha = file.type === "image/png"
  if (!keepAlpha) {
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const mime = keepAlpha ? "image/png" : "image/jpeg"
  const blob = await canvasToBlob(canvas, mime, JPEG_QUALITY)
  const dataUrl = await readAsDataUrl(blob)

  return {
    id: newId(),
    name: file.name,
    mime,
    size: blob.size,
    width,
    height,
    dataUrl,
  }
}

/** Pulls images out of a paste event, so Win+Shift+S then Ctrl+V just works. */
export function imagesFromClipboard(items: DataTransferItemList): File[] {
  const files: File[] = []
  for (const item of Array.from(items)) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue
    const file = item.getAsFile()
    if (file) files.push(file)
  }
  return files
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
