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
  character_name: z.string().meta({
    description: 'Display name of the character receiving/losing the item',
    example: 'Luke Skywalker',
  }),
  item_name: z.string().meta({
    description: 'Name of the item',
    example: 'Lightsaber',
  }),
  item_amount: z.number().int().meta({
    description: 'Amount of the item',
    example: 1,
  }),
  item_description: z.string().optional().meta({
    description: 'Optional description of the item (used when adding)',
    example: 'Blue kyber crystal blade',
  }),
})

// Paragraph script schema
export const paragraphScriptSchema = z.string().optional().meta({
  description: 'JavaScript function to execute for this paragraph. Receives (data, functions) parameters.',
  example: '(data, { addItem }) => { addItem(data, "Luke", { name: "lightsaber", amount: 1 }) }',
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
