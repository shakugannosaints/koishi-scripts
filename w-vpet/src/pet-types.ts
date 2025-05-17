import { PetCategory, PetType } from './types'

// 动物类型（陆生）
const landAnimals: PetType[] = [
  { name: '小狗', category: PetCategory.ANIMAL_LAND },
  { name: '小猫', category: PetCategory.ANIMAL_LAND },
  { name: '仓鼠', category: PetCategory.ANIMAL_LAND },
  { name: '兔子', category: PetCategory.ANIMAL_LAND },
  { name: '刺猬', category: PetCategory.ANIMAL_LAND },
  { name: '松鼠', category: PetCategory.ANIMAL_LAND },
  { name: '小熊', category: PetCategory.ANIMAL_LAND },
  { name: '浣熊', category: PetCategory.ANIMAL_LAND },
  { name: '小狐狸', category: PetCategory.ANIMAL_LAND },
  { name: '小鹿', category: PetCategory.ANIMAL_LAND },
  { name: '小猪', category: PetCategory.ANIMAL_LAND },
  { name: '小羊', category: PetCategory.ANIMAL_LAND },
  { name: '小马', category: PetCategory.ANIMAL_LAND },
  { name: '小象', category: PetCategory.ANIMAL_LAND },
  { name: '小猴', category: PetCategory.ANIMAL_LAND },
]

// 动物类型（水生）
const waterAnimals: PetType[] = [
  { name: '金鱼', category: PetCategory.ANIMAL_WATER },
  { name: '热带鱼', category: PetCategory.ANIMAL_WATER },
  { name: '小乌龟', category: PetCategory.ANIMAL_WATER },
  { name: '小章鱼', category: PetCategory.ANIMAL_WATER },
  { name: '海豚', category: PetCategory.ANIMAL_WATER },
  { name: '小鲸鱼', category: PetCategory.ANIMAL_WATER },
  { name: '水母', category: PetCategory.ANIMAL_WATER },
  { name: '小虾', category: PetCategory.ANIMAL_WATER },
  { name: '小蟹', category: PetCategory.ANIMAL_WATER },
  { name: '海星', category: PetCategory.ANIMAL_WATER },
  { name: '小海马', category: PetCategory.ANIMAL_WATER },
  { name: '小鳄鱼', category: PetCategory.ANIMAL_WATER },
  { name: '河豚', category: PetCategory.ANIMAL_WATER },
]

// 植物类型（乔木）
const trees: PetType[] = [
  { name: '小松树', category: PetCategory.PLANT_TREE },
  { name: '小橡树', category: PetCategory.PLANT_TREE },
  { name: '小樱花', category: PetCategory.PLANT_TREE },
  { name: '小苹果树', category: PetCategory.PLANT_TREE },
  { name: '小柳树', category: PetCategory.PLANT_TREE },
  { name: '小枫树', category: PetCategory.PLANT_TREE },
  { name: '小桃树', category: PetCategory.PLANT_TREE },
  { name: '小梨树', category: PetCategory.PLANT_TREE },
  { name: '小杉树', category: PetCategory.PLANT_TREE },
  { name: '小银杏', category: PetCategory.PLANT_TREE },
]

// 植物类型（灌木）
const shrubs: PetType[] = [
  { name: '小玫瑰', category: PetCategory.PLANT_SHRUB },
  { name: '小茉莉', category: PetCategory.PLANT_SHRUB },
  { name: '小杜鹃', category: PetCategory.PLANT_SHRUB },
  { name: '小栀子花', category: PetCategory.PLANT_SHRUB },
  { name: '小月季', category: PetCategory.PLANT_SHRUB },
  { name: '小紫荆', category: PetCategory.PLANT_SHRUB },
  { name: '小丁香', category: PetCategory.PLANT_SHRUB },
  { name: '小茶花', category: PetCategory.PLANT_SHRUB },
  { name: '小绣球', category: PetCategory.PLANT_SHRUB },
]

// 植物类型（苔藓）
const mosses: PetType[] = [
  { name: '小青苔', category: PetCategory.PLANT_MOSS },
  { name: '小地衣', category: PetCategory.PLANT_MOSS },
  { name: '小石松', category: PetCategory.PLANT_MOSS },
  { name: '小泥炭藓', category: PetCategory.PLANT_MOSS },
  { name: '小卷柏', category: PetCategory.PLANT_MOSS },
  { name: '小角苔', category: PetCategory.PLANT_MOSS },
]

// 真菌类型
const fungi: PetType[] = [
  { name: '小蘑菇', category: PetCategory.FUNGUS },
  { name: '小木耳', category: PetCategory.FUNGUS },
  { name: '小灵芝', category: PetCategory.FUNGUS },
  { name: '小松露', category: PetCategory.FUNGUS },
  { name: '小牛肝菌', category: PetCategory.FUNGUS },
  { name: '小羊肚菌', category: PetCategory.FUNGUS },
  { name: '小银耳', category: PetCategory.FUNGUS },
  { name: '小猴头菇', category: PetCategory.FUNGUS },
]

// 合并所有宠物类型
export const petTypes: PetType[] = [
  ...landAnimals,
  ...waterAnimals,
  ...trees,
  ...shrubs,
  ...mosses,
  ...fungi,
]
