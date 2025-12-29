# Plan: Generic Landmark Properties System

## Goal

Replace hardcoded Star Wars-specific landmark properties with a flexible, schema-driven system that works for any story genre.

## Current State

### Hardcoded Columns (in Landmark table)
- `population`, `industry`, `region`, `sector`, `planetaryBodies` - Star Wars specific
- `type` - limited to "system", "station", "nebula", "junction"

### Already Generic
- `LandmarkState` table with `field`/`value` pairs - works for any state changes over time
- Core fields: `id`, `mapId`, `x`, `y`, `name`, `description`, `color`, `size`

---

## Design: Option C (Hybrid)

### Schema Changes

```prisma
model Landmark {
  id          String          @id @default(cuid())
  mapId       String
  map         Map             @relation(fields: [mapId], references: [id], onDelete: Cascade)
  x           Float
  y           Float
  name        String
  description String          @db.Text
  type        String          @default("point")  // Generic: "point", "area", "path", "region"
  color       String?                             // Pin/marker color
  size        String?                             // "small", "medium", "large"
  properties  Json            @default("{}")      // All custom properties as key-value
  states      LandmarkState[]

  @@unique([mapId, id])
  @@index([mapId])
}

model Map {
  // ... existing fields ...
  propertySchema  Json?    // Schema defining available properties for this map
}
```

### Property Schema Format (stored in `Map.propertySchema`)

```typescript
interface PropertySchema {
  properties: PropertyDefinition[]
  stateFields: StateFieldDefinition[]
}

interface PropertyDefinition {
  key: string           // e.g., "population", "faction", "terrain"
  label: string         // e.g., "Population", "Controlling Faction"
  type: "text" | "number" | "enum" | "color" | "boolean"
  options?: Array<{     // For enum type
    value: string
    label: string
    color?: string      // Optional display color
  }>
  placeholder?: string  // Input placeholder text
  description?: string  // Help text
}

interface StateFieldDefinition {
  key: string           // e.g., "allegiance", "controlledBy"
  label: string         // e.g., "Allegiance"
  options: Array<{
    value: string
    label: string
    color: string       // Required for state visualization
  }>
}
```

### Example Schema (Star Wars)

```json
{
  "properties": [
    { "key": "population", "label": "Population", "type": "number" },
    { "key": "industry", "label": "Industry", "type": "enum", "options": [
      { "value": "farming", "label": "Agricultural" },
      { "value": "mining", "label": "Mining" },
      { "value": "trade", "label": "Trade Hub" },
      { "value": "political", "label": "Political" },
      { "value": "industry", "label": "Industrial" }
    ]},
    { "key": "region", "label": "Region", "type": "text" },
    { "key": "sector", "label": "Sector", "type": "text" },
    { "key": "planetaryBodies", "label": "Planetary Bodies", "type": "text" }
  ],
  "stateFields": [
    { "key": "allegiance", "label": "Allegiance", "options": [
      { "value": "republic", "label": "Republic", "color": "#3498db" },
      { "value": "separatist", "label": "Separatist", "color": "#e74c3c" },
      { "value": "contested", "label": "Contested", "color": "#f39c12" },
      { "value": "neutral", "label": "Neutral", "color": "#95a5a6" }
    ]}
  ]
}
```

### Example Schema (Fantasy)

```json
{
  "properties": [
    { "key": "population", "label": "Population", "type": "number" },
    { "key": "terrain", "label": "Terrain", "type": "enum", "options": [
      { "value": "forest", "label": "Forest" },
      { "value": "mountain", "label": "Mountain" },
      { "value": "plains", "label": "Plains" },
      { "value": "swamp", "label": "Swamp" }
    ]},
    { "key": "ruler", "label": "Ruler", "type": "text" }
  ],
  "stateFields": [
    { "key": "controlledBy", "label": "Controlled By", "options": [
      { "value": "kingdom", "label": "Kingdom of Light", "color": "#f1c40f" },
      { "value": "empire", "label": "Dark Empire", "color": "#2c3e50" },
      { "value": "contested", "label": "Contested", "color": "#e74c3c" },
      { "value": "independent", "label": "Independent", "color": "#27ae60" }
    ]}
  ]
}
```

---

## API Changes

### GET /my/maps/:mapId/landmarks (List View)
Returns minimal data for rendering pins:
```typescript
{
  landmarks: Array<{
    id: string
    name: string
    x: number
    y: number
    type: string
    color: string | null
    size: string | null
  }>
}
```

### GET /my/landmarks/:id (Detail View)
Returns full data including properties:
```typescript
{
  landmark: {
    id: string
    mapId: string
    name: string
    description: string
    x: number
    y: number
    type: string
    color: string | null
    size: string | null
    properties: Record<string, unknown>  // Full custom properties
  }
}
```

### GET /my/maps/:mapId (includes schema)
```typescript
{
  map: {
    // ... existing fields ...
    propertySchema: PropertySchema | null
  }
}
```

### PUT /my/landmarks/:id
Accepts properties as JSON:
```typescript
{
  name?: string
  description?: string
  x?: number
  y?: number
  type?: string
  color?: string | null
  size?: string | null
  properties?: Record<string, unknown>
}
```

### PUT /my/maps/:mapId
Accepts propertySchema updates:
```typescript
{
  propertySchema?: PropertySchema
}
```

---

## Migration Steps

### Phase 1: Database Schema
1. Add `properties Json @default("{}")` column to `Landmark`
2. Add `propertySchema Json?` column to `Map`
3. Run migration

### Phase 2: Data Migration
1. For each existing landmark, migrate fixed columns to `properties`:
   ```sql
   UPDATE "Landmark"
   SET properties = jsonb_build_object(
     'population', population,
     'industry', industry,
     'region', region,
     'sector', sector,
     'planetaryBodies', "planetaryBodies"
   )
   WHERE population IS NOT NULL
      OR industry IS NOT NULL
      OR region IS NOT NULL
      OR sector IS NOT NULL
      OR "planetaryBodies" IS NOT NULL;
   ```

2. For each existing map, create default Star Wars schema:
   ```sql
   UPDATE "Map"
   SET "propertySchema" = '{"properties": [...], "stateFields": [...]}'::jsonb;
   ```

### Phase 3: Backend Updates
1. Update landmark routes to use `properties` JSON
2. Update list endpoint to exclude `properties` (select specific columns)
3. Update detail endpoint to include full `properties`
4. Add schema validation on property updates (optional, can be lenient)
5. Update map routes to include/update `propertySchema`

### Phase 4: Frontend Updates
1. Update `LandmarkPopup` to render properties dynamically from schema
2. Replace hardcoded allegiance buttons with schema-driven state field buttons
3. Add property schema editor in map settings
4. Update landmark store types

### Phase 5: Cleanup
1. Remove deprecated columns: `population`, `industry`, `region`, `sector`, `planetaryBodies`
2. Run final migration
3. Update story-to-mythweavers migration script to use new format

---

## Migration Script Update (from-story.ts)

The migration script needs to:
1. Read old fixed properties from source landmarks
2. Convert them to `properties` JSON in target
3. Create a default Star Wars `propertySchema` for migrated maps

```typescript
// In landmark migration:
const properties: Record<string, string> = {}
if (landmark.population) properties.population = landmark.population
if (landmark.industry) properties.industry = landmark.industry
if (landmark.region) properties.region = landmark.region
if (landmark.sector) properties.sector = landmark.sector
if (landmark.planetaryBodies) properties.planetaryBodies = landmark.planetaryBodies

await targetPrisma.landmark.create({
  data: {
    // ... core fields ...
    properties,
  }
})

// For each map, set default schema
await targetPrisma.map.update({
  where: { id: mapId },
  data: {
    propertySchema: DEFAULT_STAR_WARS_SCHEMA
  }
})
```

---

## LandmarkState Migration

`LandmarkState` already uses the generic `field`/`value` pattern. No schema changes needed.

The migration script should:
1. Copy all `LandmarkState` records as-is
2. The `field` values (e.g., "allegiance") will match the `stateFields[].key` in the schema

---

## Files to Modify

### Backend (mythweavers-backend)
- `prisma/schema.prisma` - Add columns
- `src/routes/my/landmarks.ts` - Update CRUD operations
- `src/routes/my/maps.ts` - Include schema in responses
- `scripts/migrate/from-story.ts` - Update migration

### Frontend (mythweavers-story-editor)
- `src/components/maps/LandmarkPopup.tsx` - Dynamic property rendering
- `src/stores/landmarkStatesStore.ts` - May need schema awareness
- `src/types/core.ts` - Update Landmark type, add PropertySchema types

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Schema | 30 min |
| Phase 2: Data migration | 1 hour |
| Phase 3: Backend | 2 hours |
| Phase 4: Frontend | 3 hours |
| Phase 5: Cleanup | 30 min |
| **Total** | **~7 hours** |

---

## Open Questions

1. Should we validate properties against schema on save, or be lenient?
   - Recommendation: Lenient - just store what's sent, schema is for UI hints

2. Should schema be per-map or per-story?
   - Recommendation: Per-map (different maps might have different location types)

3. Should we support nested properties?
   - Recommendation: No, keep it flat key-value for simplicity

4. How to handle schema changes when landmarks already have data?
   - Recommendation: Old properties stay in JSON even if not in schema (backwards compatible)
