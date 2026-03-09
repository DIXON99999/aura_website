import { useState, useRef, useEffect } from 'react'
import { Plus, X, MousePointerClick } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuraStore, useAuthStore } from '@/stores'

// Perk definitions
export interface Perk {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  unlockCondition: (userAura: number) => boolean
  unlockDescription: string
}

export const PERKS: Perk[] = [
  {
    id: 'double-click',
    name: 'Double Click',
    description: 'Each upvote counts as 2 votes',
    icon: MousePointerClick,
    unlockCondition: (userAura) => userAura >= 50,
    unlockDescription: 'Reach 50 aura to unlock',
  },
]

const INVENTORY_SLOTS = 5
const STORAGE_KEY = 'aura_equipped_perks'

function getEquippedPerks(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function setEquippedPerks(perks: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(perks))
}

export function useEquippedPerks() {
  const [equipped, setEquipped] = useState<string[]>(getEquippedPerks)

  const equipPerk = (perkId: string) => {
    if (equipped.length >= INVENTORY_SLOTS) return
    if (equipped.includes(perkId)) return
    const newEquipped = [...equipped, perkId]
    setEquipped(newEquipped)
    setEquippedPerks(newEquipped)
  }

  const unequipPerk = (perkId: string) => {
    const newEquipped = equipped.filter(id => id !== perkId)
    setEquipped(newEquipped)
    setEquippedPerks(newEquipped)
  }

  const hasPerk = (perkId: string) => equipped.includes(perkId)

  return { equipped, equipPerk, unequipPerk, hasPerk }
}

export function InventoryBar() {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [showPerkList, setShowPerkList] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { equipped, equipPerk, unequipPerk } = useEquippedPerks()

  // Get user's aura score (check both logged-in user and visitor profile)
  const user = useAuthStore((s) => s.user)
  const userProfiles = useAuraStore((s) => s.userProfiles)
  const players = useAuraStore((s) => s.players)

  // For logged-in users, use user.id; otherwise use visitorId
  const visitorId = localStorage.getItem('aura_visitor_id') || ''
  const lookupId = user?.id || visitorId
  const profileId = userProfiles[lookupId]
  const userProfile = profileId ? players[profileId] : null
  const userAura = userProfile?.auraScore || 0

  // Get available (unlocked) perks
  const availablePerks = PERKS.filter(p => p.unlockCondition(userAura))
  const unequippedPerks = availablePerks.filter(p => !equipped.includes(p.id))

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPerkList(false)
        setSelectedSlot(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSlotClick = (index: number) => {
    if (equipped[index]) {
      // Slot has a perk - clicking will show unequip option
      setSelectedSlot(index)
      setShowPerkList(true)
    } else {
      // Empty slot - show perk list
      setSelectedSlot(index)
      setShowPerkList(true)
    }
  }

  const handleEquipPerk = (perkId: string) => {
    equipPerk(perkId)
    setShowPerkList(false)
    setSelectedSlot(null)
  }

  const handleUnequipPerk = (perkId: string) => {
    unequipPerk(perkId)
    setShowPerkList(false)
    setSelectedSlot(null)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-1">
        {Array.from({ length: INVENTORY_SLOTS }).map((_, index) => {
          const equippedPerkId = equipped[index]
          const perk = equippedPerkId ? PERKS.find(p => p.id === equippedPerkId) : null
          const isSelected = selectedSlot === index && showPerkList

          return (
            <button
              key={index}
              onClick={() => handleSlotClick(index)}
              className={cn(
                'w-8 h-8 rounded border-2 border-dashed flex items-center justify-center transition-all',
                perk
                  ? 'border-primary/50 bg-primary/10 hover:border-red-500 hover:bg-red-500/10 group'
                  : 'border-border hover:border-primary/50 hover:bg-accent',
                isSelected && 'border-primary bg-primary/20'
              )}
              title={perk ? `${perk.name} - Click to unequip` : 'Empty slot - Click to equip'}
            >
              {perk ? (
                <div className="relative">
                  <perk.icon className="w-4 h-4 text-primary group-hover:hidden" />
                  <X className="w-4 h-4 text-red-500 hidden group-hover:block" />
                </div>
              ) : (
                <Plus className="w-3 h-3 text-muted-foreground" />
              )}
            </button>
          )
        })}
      </div>

      {/* Perk selection dropdown */}
      {showPerkList && (
        <div className="absolute top-full left-0 mt-2 w-56 rounded-lg border bg-card shadow-lg py-2 z-50">
          {selectedSlot !== null && equipped[selectedSlot] ? (
            // Show unequip option for equipped perk
            <>
              {(() => {
                const perk = PERKS.find(p => p.id === equipped[selectedSlot])
                if (!perk) return null
                return (
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-2 mb-2">
                      <perk.icon className="w-5 h-5 text-primary" />
                      <span className="font-medium">{perk.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{perk.description}</p>
                    <button
                      onClick={() => handleUnequipPerk(perk.id)}
                      className="w-full px-3 py-2 rounded bg-red-500/10 text-red-500 text-sm font-medium hover:bg-red-500/20 transition-colors"
                    >
                      Unequip
                    </button>
                  </div>
                )
              })()}
            </>
          ) : (
            // Show available perks to equip
            <>
              <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Available Perks
              </div>
              {unequippedPerks.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                  {availablePerks.length === 0 ? (
                    <>
                      <p>No perks unlocked yet</p>
                      <p className="text-xs mt-1">Reach 50 aura to unlock your first perk!</p>
                    </>
                  ) : (
                    <p>All perks are equipped</p>
                  )}
                </div>
              ) : (
                <div className="mt-1">
                  {unequippedPerks.map(perk => (
                    <button
                      key={perk.id}
                      onClick={() => handleEquipPerk(perk.id)}
                      className="w-full px-3 py-2 flex items-start gap-3 hover:bg-accent transition-colors"
                    >
                      <perk.icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="text-left">
                        <div className="text-sm font-medium">{perk.name}</div>
                        <div className="text-xs text-muted-foreground">{perk.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Show locked perks */}
              {PERKS.filter(p => !p.unlockCondition(userAura)).length > 0 && (
                <>
                  <div className="border-t my-2" />
                  <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Locked Perks
                  </div>
                  {PERKS.filter(p => !p.unlockCondition(userAura)).map(perk => (
                    <div
                      key={perk.id}
                      className="px-3 py-2 flex items-start gap-3 opacity-50"
                    >
                      <perk.icon className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="text-left">
                        <div className="text-sm font-medium text-muted-foreground">{perk.name}</div>
                        <div className="text-xs text-muted-foreground">{perk.unlockDescription}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
