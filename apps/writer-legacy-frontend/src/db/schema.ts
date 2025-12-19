import { foreignKey, integer, numeric, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const user = sqliteTable('user', {
  id: text('id', { length: 22 }).primaryKey(),
  providerId: text('provider_id', { length: 256 }).unique(),
  nickname: text('nickname', { length: 256 }),
  fullName: text('full_name'),
  email: text('email', { length: 256 }),
  password: text('password', { length: 256 }),
})

export const storyTable = sqliteTable('story', {
  id: text('id', { length: 22 }).primaryKey(),
  name: text('name', { length: 256 }),
})

export type StoryTable = typeof storyTable.$inferSelect

export const plotpoint = sqliteTable('plotpoint', {
  id: text('id', { length: 22 }).primaryKey(),
  storyId: text('story_id', { length: 22 }).references(() => storyTable.id),
  name: text('name'),
  summary: text('summary'),
})

export const character = sqliteTable('character', {
  id: text('id', { length: 22 }).primaryKey(),
  storyId: text('story_id', { length: 22 }).references(() => storyTable.id),
  isProtagonist: numeric('is_protagonist'),
  picture: text('picture', { length: 256 }),
  name: text('name'),
  summary: text('summary'),
  age: text('age'),
})

export const tree = sqliteTable('tree', {
  id: text('id', { length: 22 }).primaryKey(),
  storyId: text('story_id', { length: 22 }).references(() => storyTable.id),
  treeJson: text('tree_json'),
})

export const treeEntity = sqliteTable(
  'treeEntity',
  {
    id: text('id', { length: 22 }).primaryKey(),
    storyId: text('story_id', { length: 22 }).references(() => storyTable.id),
    parentId: text('parent_id', { length: 22 }),
    title: text('title'),
    sortOrder: integer('sort_order'),
    kind: text('kind'),
    summary: text('summary'),
  },
  (table) => {
    return {
      parentReference: foreignKey({
        columns: [table.parentId],
        foreignColumns: [table.id],
        name: 'parent_id_fk',
      }),
    }
  },
)

export const scene = sqliteTable('scene', {
  treeEntityId: text('id', { length: 22 })
    .primaryKey()
    .references(() => treeEntity.id),
  sceneJson: text('scene_json'),
})
