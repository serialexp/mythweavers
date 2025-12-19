import { z } from 'zod'

// Plot point action schema
export const plotPointActionSchema = z.strictObject({
  plot_point_id: z.string().meta({
    description: 'ID of the plot point',
    example: 'clx1234567890',
  }),
  action: z.enum(['introduce', 'mentioned', 'partially resolved', 'resolved']).meta({
    description: 'Type of plot point action',
    example: 'introduce',
  }),
})

// Inventory action schema
export const inventoryActionSchema = z.strictObject({
  type: z.enum(['add', 'remove']).meta({
    description: 'Type of inventory action',
    example: 'add',
  }),
  item_name: z.string().meta({
    description: 'Name of the item',
    example: 'Magic Sword',
  }),
  item_amount: z.number().int().meta({
    description: 'Amount of the item',
    example: 1,
  }),
})

// Character significant action schema
export const significantActionSchema = z.strictObject({
  action: z.string().meta({
    description: 'Description of the action',
    example: 'Found the ancient artifact',
  }),
  sceneId: z.string().meta({
    description: 'Scene where the action occurred',
    example: 'clx1234567890',
  }),
  timestamp: z.number().int().meta({
    description: 'Story time when the action occurred (in minutes)',
    example: 1440,
  }),
})
