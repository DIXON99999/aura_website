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

// POST /uploads - Upload an image
app.post('/', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return c.json({ error: 'No file provided' }, 400)
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP' }, 400)
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return c.json({ error: 'File too large. Max size: 5MB' }, 400)
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${crypto.randomUUID()}.${ext}`
    const filepath = join(UPLOADS_DIR, filename)

    // Save file
    const arrayBuffer = await file.arrayBuffer()
    await Bun.write(filepath, arrayBuffer)

    // Return the URL path
    const imageUrl = `/uploads/${filename}`

    return c.json({ imageUrl })
  } catch (error) {
    console.error('Upload error:', error)
    return c.json({ error: 'Upload failed' }, 500)
  }
})

// GET /uploads/:filename - Serve uploaded image
app.get('/:filename', async (c) => {
  const filename = c.req.param('filename')
  const filepath = join(UPLOADS_DIR, filename)

  const file = Bun.file(filepath)
  if (!(await file.exists())) {
    return c.json({ error: 'File not found' }, 404)
  }

  const contentType = file.type || 'application/octet-stream'
  return new Response(file, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000',
    },
  })
})

export default app
