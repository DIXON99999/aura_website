import { useState, useRef, useEffect } from 'react'
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, type Notification } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface NotificationBellProps {
  userId: string
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load unread count on mount
  useEffect(() => {
    loadUnreadCount()
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [userId])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadUnreadCount = async () => {
    try {
      const { count } = await api.getUnreadNotificationCount(userId)
      setUnreadCount(count)
    } catch (error) {
      console.error('Failed to load unread count:', error)
    }
  }

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const data = await api.getNotifications(userId, { limit: 20 })
      setNotifications(data)
    } catch (error) {
      console.error('Failed to load notifications:', error)
    }
    setLoading(false)
  }

  const handleOpen = () => {
    if (!isOpen) {
      loadNotifications()
    }
    setIsOpen(!isOpen)
  }

  const handleMarkRead = async (notificationId: string) => {
    try {
      await api.markNotificationRead(notificationId)
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead(userId)
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  const handleClearAll = async () => {
    if (!confirm('Clear all notifications?')) return
    try {
      await api.clearAllNotifications(userId)
      setNotifications([])
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to clear notifications:', error)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      handleMarkRead(notification.id)
    }
    setIsOpen(false)
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'mention':
        return '@'
      case 'reply':
        return 'Re:'
      case 'aura_farm_created':
        return '🌾'
      case 'entity_vote':
        return '▲'
      default:
        return '!'
    }
  }

  const getNotificationText = (notification: Notification) => {
    switch (notification.type) {
      case 'mention':
        return 'mentioned you'
      case 'reply':
        return 'replied'
      case 'aura_farm_created':
        return 'has created Aurafarm about you'
      case 'entity_vote':
        return 'voted on your profile'
      default:
        return 'interacted with you'
    }
  }

  const getNotificationIconStyle = (type: string) => {
    switch (type) {
      case 'mention':
        return 'bg-blue-500/20 text-blue-500'
      case 'aura_farm_created':
        return 'bg-green-500/20 text-green-500'
      case 'entity_vote':
        return 'bg-yellow-500/20 text-yellow-500'
      default:
        return 'bg-primary/20 text-primary'
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg transition-colors hover:bg-accent text-muted-foreground hover:text-accent-foreground"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold px-1 shadow-md animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-h-[400px] rounded-lg border bg-card shadow-lg overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
            <h3 className="font-semibold text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto max-h-[340px]">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  to={notification.sourceUrl}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "block px-4 py-3 border-b last:border-b-0 hover:bg-accent/50 transition-colors",
                    !notification.read && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                      getNotificationIconStyle(notification.type)
                    )}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{notification.fromUsername}</span>
                        {' '}
                        <span className="text-muted-foreground">
                          {getNotificationText(notification)}
                        </span>
                        {notification.content && (
                          <>
                            {' - '}
                            <span className="text-foreground">{notification.content}</span>
                          </>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {!notification.read && (
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleMarkRead(notification.id)
                        }}
                        className="flex-shrink-0 p-1 rounded hover:bg-accent transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
