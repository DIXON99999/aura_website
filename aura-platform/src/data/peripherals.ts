import type { Peripheral } from '@/types'
import { EntityTypes, PeripheralType } from '@/types'

const brandMap: Record<string, string> = {
  'Zowie': 'brand-zowie',
  'Razer': 'brand-razer',
  'Logitech': 'brand-logitech',
  'Endgame Gear': 'brand-endgame-gear',
  'Hitscan': 'brand-hitscan',
  'ATK': 'brand-atk',
  'Pulsar': 'brand-pulsar',
  'WLMouse': 'brand-wlmouse',
  'Finalmouse': 'brand-finalmouse',
  'Lamzu': 'brand-lamzu',
  'Ninjutso': 'brand-ninjutso',
  'Vaxee': 'brand-vaxee',
  'G-Wolves': 'brand-g-wolves',
  'Artisan': 'brand-artisan',
  'SteelSeries': 'brand-steelseries',
  'Lethal Gaming Gear': 'brand-lgg',
  'X-raypad': 'brand-xraypad',
  'Skypad': 'brand-skypad',
}

interface PeripheralInput {
  brand: string
  model: string
}

function createPeripheral(input: PeripheralInput, type: PeripheralType): Peripheral {
  const fullName = `${input.brand} ${input.model}`
  const slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return {
    id: `peripheral-${slug}`,
    name: fullName,
    slug,
    auraScore: 0,
    createdAt: new Date(),
    type: EntityTypes.PERIPHERAL,
    peripheralType: type,
    brandId: brandMap[input.brand] || 'brand-unknown',
    aliases: [input.model, input.brand],
  }
}

const miceData: PeripheralInput[] = [
  { brand: "Zowie", model: "EC-DW" },
  { brand: "Zowie", model: "FK-DW" },
  { brand: "Zowie", model: "ZA-DW" },
  { brand: "Zowie", model: "S-DW" },
  { brand: "Zowie", model: "U2" },
  { brand: "Razer", model: "DeathAdder V3 Pro" },
  { brand: "Razer", model: "Viper V3 Pro" },
  { brand: "Razer", model: "Viper Mini Signature Edition" },
  { brand: "Logitech", model: "G Pro X Superlight 2" },
  { brand: "Logitech", model: "G Pro X Superlight 2 DEX" },
  { brand: "Logitech", model: "G Pro X Superstrike" },
  { brand: "Endgame Gear", model: "OP1we" },
  { brand: "Endgame Gear", model: "XM2we" },
  { brand: "Hitscan", model: "Hyperlight" },
  { brand: "ATK", model: "F1 Ultimate" },
  { brand: "ATK", model: "X1 Ultimate" },
  { brand: "Pulsar", model: "X2V2" },
  { brand: "Pulsar", model: "X2H" },
  { brand: "Pulsar", model: "Xlite V3" },
  { brand: "WLMouse", model: "Beast X" },
  { brand: "WLMouse", model: "Beast X Max" },
  { brand: "WLMouse", model: "Huan" },
  { brand: "Finalmouse", model: "UltralightX" },
  { brand: "Lamzu", model: "Atlantis Mini Pro" },
  { brand: "Lamzu", model: "Thorn" },
  { brand: "Ninjutso", model: "Sora V2" },
  { brand: "Vaxee", model: "XE-W" },
  { brand: "G-Wolves", model: "HTS Plus 4K" },
]

const mousepadData: PeripheralInput[] = [
  { brand: "Artisan", model: "Hien" },
  { brand: "Artisan", model: "Zero" },
  { brand: "Artisan", model: "Hayate Otsu" },
  { brand: "Artisan", model: "Raiden" },
  { brand: "SteelSeries", model: "QcK" },
  { brand: "SteelSeries", model: "QcK Heavy" },
  { brand: "Zowie", model: "G-SR" },
  { brand: "Zowie", model: "G-SR-SE" },
  { brand: "Logitech", model: "G640" },
  { brand: "Razer", model: "Gigantus V2" },
  { brand: "Razer", model: "Strider" },
  { brand: "Pulsar", model: "ParaControl V2" },
  { brand: "Lethal Gaming Gear", model: "Saturn Pro" },
  { brand: "Vaxee", model: "PA" },
  { brand: "X-raypad", model: "Aqua Control+" },
  { brand: "Endgame Gear", model: "MPC450" },
  { brand: "Skypad", model: "Glass 3.0" },
]

export const mice: Peripheral[] = miceData.map((m) => createPeripheral(m, PeripheralType.MOUSE))
export const mousepads: Peripheral[] = mousepadData.map((m) => createPeripheral(m, PeripheralType.MOUSEPAD))
export const peripherals: Peripheral[] = [...mice, ...mousepads]
