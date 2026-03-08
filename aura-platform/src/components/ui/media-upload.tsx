import { useState, useRef, useCallback } from 'react'
import { Upload, X, Film } from 'lucide-react'
import { Button } from './button'
import { Input } from './input'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

interface MediaUploadProps {
  value: string
  onChange: (url: string) => void
  disabled?: boolean
  className?: string
  showUrlInput?: boolean
  compact?: boolean
}

// Helper to check if URL is a video
function isVideoUrl(url: string): boolean {
  const videoExtensions = ['.mp4', '.webm']
  const lowerUrl = url.toLowerCase()
  return videoExtensions.some(ext => lowerUrl.includes(ext))
}

export function MediaUpload({
  value,
  onChange,
  disabled = false,
  className,
  showUrlInput = true,
  compact = false,
}: MediaUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const handleFile = useCallback(async (file: File) => {
    if (!file) return

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm'
    ]
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, MP4, WebM')
      return
    }

    // Validate file size
    const isVideo = file.type.startsWith('video/')
    const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024
    if (file.size > maxSize) {
      setError(`File too large. Max: ${isVideo ? '50MB' : '5MB'}`)
      return
    }

    setUploading(true)
    setError('')

    try {
      const result = await api.uploadImage(file)
      const relativeUrl = result.imageUrl.startsWith('/api')
        ? result.imageUrl
        : `/api${result.imageUrl}`
      onChange(relativeUrl)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }, [onChange])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounter.current = 0

    if (disabled || uploading) return

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  return (
    <div className={className}>
      {/* URL Input */}
      {showUrlInput && (
        <div className="flex gap-2 mb-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter image/video URL or drag & drop below"
            disabled={disabled || uploading}
            className="flex-1"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? 'Uploading...' : 'Browse'}
          </Button>
        </div>
      )}

      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !value && fileInputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-lg transition-all duration-200",
          isDragging && "border-primary bg-primary/5 scale-[1.02]",
          !isDragging && !value && "border-muted-foreground/25 hover:border-muted-foreground/50",
          !value && "cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed",
          compact ? "p-4" : "p-6",
          value ? "border-transparent" : ""
        )}
      >
        {!showUrlInput && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
            onChange={handleFileChange}
            className="hidden"
          />
        )}

        {value ? (
          // Preview
          <div className={cn("relative rounded-lg overflow-hidden bg-muted", compact ? "max-w-xs" : "aspect-video max-w-sm")}>
            {isVideoUrl(value) ? (
              <video
                src={value}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <img
                src={value}
                alt="Preview"
                className="w-full h-full object-contain"
              />
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
              }}
              disabled={disabled}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          // Empty state
          <div className={cn(
            "flex flex-col items-center justify-center text-center",
            compact ? "py-2" : "py-8"
          )}>
            {isDragging ? (
              <>
                <Upload className={cn("text-primary mb-2", compact ? "w-6 h-6" : "w-10 h-10")} />
                <p className="text-sm font-medium text-primary">Drop to upload</p>
              </>
            ) : uploading ? (
              <>
                <div className={cn("animate-spin rounded-full border-2 border-primary border-t-transparent mb-2", compact ? "w-6 h-6" : "w-10 h-10")} />
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </>
            ) : (
              <>
                <Upload className={cn("text-muted-foreground mb-2", compact ? "w-6 h-6" : "w-10 h-10")} />
                <p className="text-sm font-medium">
                  Drag & drop or click to upload
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Film className="w-3 h-3" />
                  Images (5MB) or Clips (50MB)
                </p>
              </>
            )}
          </div>
        )}

        {/* Drag overlay */}
        {isDragging && value && (
          <div className="absolute inset-0 bg-primary/10 border-2 border-primary rounded-lg flex items-center justify-center">
            <div className="bg-background rounded-lg px-4 py-2 shadow-lg">
              <p className="text-sm font-medium text-primary">Drop to replace</p>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-500 mt-2">{error}</p>
      )}
    </div>
  )
}
