import { useEffect } from 'react'
import { useAuraStore } from '@/stores'
import { useVisitorId } from './use-visitor-id'

export function useSeedData() {
  const fetchAllData = useAuraStore((s) => s.fetchAllData)
  const loadVisitorVotes = useAuraStore((s) => s.loadVisitorVotes)
  const loadUserProfile = useAuraStore((s) => s.loadUserProfile)
  const initialized = useAuraStore((s) => s.initialized)
  const visitorId = useVisitorId()

  useEffect(() => {
    if (!initialized) {
      fetchAllData()
    }
  }, [fetchAllData, initialized])

  // Load visitor-specific data when visitorId is available
  useEffect(() => {
    if (visitorId && initialized) {
      loadVisitorVotes(visitorId)
      loadUserProfile(visitorId)
    }
  }, [visitorId, initialized, loadVisitorVotes, loadUserProfile])
}
