import { Context } from 'koishi'
import { VPetService } from '.'

export type { VPetService }

export interface Pet {
  userId: string
  platform: string
  guildId: string
  name: string
  type: string
  category: PetCategory
  health: number
  growth: number
  adoptTime: number
  lastInteractTime: number
}

export enum PetCategory {
  ANIMAL_LAND = 'animal_land',
  ANIMAL_WATER = 'animal_water',
  PLANT_TREE = 'plant_tree',
  PLANT_SHRUB = 'plant_shrub',
  PLANT_MOSS = 'plant_moss',
  FUNGUS = 'fungus'
}

export interface PetType {
  name: string
  category: PetCategory
}

export interface UserQuery {
  userId: string
  platform: string
  guildId: string
}

export interface VPetEvents {
  'vpet/adopt': (userId: string, platform: string, guildId: string, petName?: string) => Promise<Pet>
  'vpet/interact': (userId: string, platform: string, guildId: string) => Promise<Pet | null>
  'vpet/rename': (userId: string, platform: string, guildId: string, newName: string) => Promise<Pet | null>
}

declare module 'koishi' {
  interface Tables {
    'w-vpet': Pet
  }

  interface Context {
    vpet: VPetService
  }
}

declare module '@koishijs/plugin-console' {
  interface Events extends VPetEvents {}
}
