import { useEffect, useRef } from 'react'
import { useAuraStore } from '@/stores'
import {
  countries,
  games,
  regions,
  organisations,
  organisationGames,
  players,
  brands,
  peripherals,
  roles,
  weapons,
  characters,
} from '@/data'

export function useSeedData() {
  const addEntity = useAuraStore((s) => s.addEntity)
  const seeded = useRef(false)

  useEffect(() => {
    if (seeded.current) return
    seeded.current = true

    for (const country of countries) {
      addEntity(country)
    }
    for (const game of games) {
      addEntity(game)
    }
    for (const region of regions) {
      addEntity(region)
    }
    for (const org of organisations) {
      addEntity(org)
    }
    for (const orgGame of organisationGames) {
      addEntity(orgGame)
    }
    for (const player of players) {
      addEntity(player)
    }
    for (const brand of brands) {
      addEntity(brand)
    }
    for (const peripheral of peripherals) {
      addEntity(peripheral)
    }
    for (const role of roles) {
      addEntity(role)
    }
    for (const weapon of weapons) {
      addEntity(weapon)
    }
    for (const character of characters) {
      addEntity(character)
    }
  }, [addEntity])
}
