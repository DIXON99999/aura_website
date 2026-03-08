import { Hono } from 'hono'
import { mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

const app = new Hono()

const UPLOADS_DIR = './uploads'

// Ensure uploads directory exists
if (!existsSync(UPLOADS_DIR)) {
  await mkdir(UPLOADS_DIR, { recursive: true })
}

// Allowed file types
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const VIDEO_TYPES = ['video/mp4', 'video/webm']
const ALL_ALLOWED_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES]

// File size limits
const IMAGE_MAX_SIZE = 5 * 1024 * 1024 // 5MB for images
const VIDEO_MAX_SIZE = 50 * 1024 * 1024 // 50MB for videos

// POST /uploads - Upload an image or video
app.post('/', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return c.json({ error: 'No file provided' }, 400)
    }

    // Validate file type
    if (!ALL_ALLOWED_TYPES.includes(file.type)) {
      return c.json({ error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, MP4, WebM' }, 400)
    }

    // Determine if it's a video
    const isVideo = VIDEO_TYPES.includes(file.type)
    const maxSize = isVideo ? VIDEO_MAX_SIZE : IMAGE_MAX_SIZE

    // Validate file size
    if (file.size > maxSize) {
      const maxMB = maxSize / (1024 * 1024)
      return c.json({ error: `File too large. Max size: ${maxMB}MB` }, 400)
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')
    const filename = `${crypto.randomUUID()}.${ext}`
    const filepath = join(UPLOADS_DIR, filename)

    // Save file
    const arrayBuffer = await file.arrayBuffer()
    await Bun.write(filepath, arrayBuffer)

    // Return the URL path and type info
    const mediaUrl = `/uploads/${filename}`

    return c.json({
      imageUrl: mediaUrl, // Keep for backwards compatibility
      mediaUrl,
      mediaType: isVideo ? 'video' : 'image'
    })
  } catch (error) {
    console.error('Upload error:', error)
    return c.json({ error: 'Upload failed' }, 500)
  }
})

// GET /uploads/:filename - Serve uploaded file with Range support for video seeking
app.get('/:filename', async (c) => {
  const filename = c.req.param('filename')
  const filepath = join(UPLOADS_DIR, filename)

  const file = Bun.file(filepath)
  if (!(await file.exists())) {
    return c.json({ error: 'File not found' }, 404)
  }

  const contentType = file.type || 'application/octet-stream'
  const fileSize = file.size
  const rangeHeader = c.req.header('Range')

  // Handle Range requests for video seeking
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/)
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0
      const end = match[2] ? parseInt(match[2], 10) : fileSize - 1
      const chunkSize = end - start + 1

      const arrayBuffer = await file.arrayBuffer()
      const chunk = arrayBuffer.slice(start, end + 1)

      return new Response(chunk, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Length': chunkSize.toString(),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000',
        },
      })
    }
  }

  // Regular full file response
  return new Response(file, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': fileSize.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000',
    },
  })
})

export default app
