import { useState, useEffect } from 'react'

const VISITOR_ID_KEY = 'aura_visitor_id'

function generateVisitorId(): string {
  return crypto.randomUUID()
}

export function useVisitorId(): string {
  const [visitorId, setVisitorId] = useState<string>('')

  useEffect(() => {
    let id = localStorage.getItem(VISITOR_ID_KEY)
    if (!id) {
      id = generateVisitorId()
      localStorage.setItem(VISITOR_ID_KEY, id)
    }
    setVisitorId(id)
  }, [])

  return visitorId
}
