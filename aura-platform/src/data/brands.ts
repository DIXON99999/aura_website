import type { Brand } from '@/types'
import { EntityTypes } from '@/types'

function createBrand(name: string, slug?: string): Brand {
  return {
    id: `brand-${(slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    auraScore: 0,
    createdAt: new Date(),
    type: EntityTypes.BRAND,
  }
}

export const brands: Brand[] = [
  createBrand('Zowie'),
  createBrand('Razer'),
  createBrand('Logitech'),
  createBrand('Endgame Gear', 'endgame-gear'),
  createBrand('Hitscan'),
  createBrand('ATK'),
  createBrand('Pulsar'),
  createBrand('WLMouse'),
  createBrand('Finalmouse'),
  createBrand('Lamzu'),
  createBrand('Ninjutso'),
  createBrand('Vaxee'),
  createBrand('G-Wolves', 'g-wolves'),
  createBrand('Artisan'),
  createBrand('SteelSeries'),
  createBrand('Lethal Gaming Gear', 'lgg'),
  createBrand('X-raypad', 'xraypad'),
  createBrand('Skypad'),
]
