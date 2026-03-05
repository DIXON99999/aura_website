import type { Country } from '@/types'
import { EntityTypes } from '@/types'

function createCountry(name: string, flagCode: string, slug?: string): Country {
  return {
    id: `country-${flagCode.toLowerCase()}`,
    name,
    slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
    flagCode: flagCode.toUpperCase(),
    auraScore: 0,
    createdAt: new Date(),
    type: EntityTypes.COUNTRY,
  }
}

export const countries: Country[] = [
  // North America
  createCountry('United States', 'US'),
  createCountry('Canada', 'CA'),
  createCountry('Mexico', 'MX'),

  // South America
  createCountry('Brazil', 'BR'),
  createCountry('Argentina', 'AR'),
  createCountry('Chile', 'CL'),
  createCountry('Peru', 'PE'),
  createCountry('Colombia', 'CO'),

  // Europe - Western
  createCountry('United Kingdom', 'GB'),
  createCountry('France', 'FR'),
  createCountry('Germany', 'DE'),
  createCountry('Spain', 'ES'),
  createCountry('Portugal', 'PT'),
  createCountry('Netherlands', 'NL'),
  createCountry('Belgium', 'BE'),
  createCountry('Switzerland', 'CH'),
  createCountry('Austria', 'AT'),
  createCountry('Ireland', 'IE'),

  // Europe - Northern
  createCountry('Sweden', 'SE'),
  createCountry('Denmark', 'DK'),
  createCountry('Norway', 'NO'),
  createCountry('Finland', 'FI'),
  createCountry('Iceland', 'IS'),

  // Europe - Eastern
  createCountry('Poland', 'PL'),
  createCountry('Ukraine', 'UA'),
  createCountry('Russia', 'RU'),
  createCountry('Czech Republic', 'CZ'),
  createCountry('Slovakia', 'SK'),
  createCountry('Hungary', 'HU'),
  createCountry('Romania', 'RO'),
  createCountry('Bulgaria', 'BG'),
  createCountry('Serbia', 'RS'),
  createCountry('Croatia', 'HR'),
  createCountry('Slovenia', 'SI'),
  createCountry('Bosnia and Herzegovina', 'BA'),
  createCountry('North Macedonia', 'MK'),
  createCountry('Montenegro', 'ME'),
  createCountry('Kosovo', 'XK'),
  createCountry('Latvia', 'LV'),
  createCountry('Lithuania', 'LT'),
  createCountry('Estonia', 'EE'),
  createCountry('Belarus', 'BY'),
  createCountry('Moldova', 'MD'),

  // Europe - Southern
  createCountry('Italy', 'IT'),
  createCountry('Greece', 'GR'),
  createCountry('Turkey', 'TR'),
  createCountry('Cyprus', 'CY'),
  createCountry('Malta', 'MT'),

  // Asia - East
  createCountry('South Korea', 'KR'),
  createCountry('Japan', 'JP'),
  createCountry('China', 'CN'),
  createCountry('Taiwan', 'TW'),
  createCountry('Hong Kong', 'HK'),
  createCountry('Macau', 'MO'),
  createCountry('Mongolia', 'MN'),

  // Asia - Southeast
  createCountry('Philippines', 'PH'),
  createCountry('Vietnam', 'VN'),
  createCountry('Thailand', 'TH'),
  createCountry('Indonesia', 'ID'),
  createCountry('Malaysia', 'MY'),
  createCountry('Singapore', 'SG'),
  createCountry('Myanmar', 'MM'),
  createCountry('Cambodia', 'KH'),
  createCountry('Laos', 'LA'),

  // Asia - South
  createCountry('India', 'IN'),
  createCountry('Pakistan', 'PK'),
  createCountry('Bangladesh', 'BD'),
  createCountry('Sri Lanka', 'LK'),
  createCountry('Nepal', 'NP'),

  // Asia - Central & West
  createCountry('Kazakhstan', 'KZ'),
  createCountry('Uzbekistan', 'UZ'),
  createCountry('Israel', 'IL'),
  createCountry('United Arab Emirates', 'AE'),
  createCountry('Saudi Arabia', 'SA'),
  createCountry('Qatar', 'QA'),
  createCountry('Kuwait', 'KW'),
  createCountry('Bahrain', 'BH'),
  createCountry('Jordan', 'JO'),
  createCountry('Lebanon', 'LB'),
  createCountry('Iran', 'IR'),
  createCountry('Iraq', 'IQ'),

  // Oceania
  createCountry('Australia', 'AU'),
  createCountry('New Zealand', 'NZ'),

  // Africa
  createCountry('South Africa', 'ZA'),
  createCountry('Egypt', 'EG'),
  createCountry('Morocco', 'MA'),
  createCountry('Nigeria', 'NG'),
  createCountry('Kenya', 'KE'),
  createCountry('Algeria', 'DZ'),
  createCountry('Tunisia', 'TN'),
]
