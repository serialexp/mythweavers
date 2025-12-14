#!/bin/bash

# Update imports in component files
echo "Updating component imports..."

# Update imports from '../types' to '../types/core'
find src/components -name "*.tsx" -type f -exec sed -i.bak "s/from '\.\.\/types'/from '\.\.\/types\/core'/g" {} \;

# Update imports in store files
echo "Updating store imports..."
find src/stores -name "*.ts" -type f -exec sed -i.bak "s/from '\.\.\/types'/from '\.\.\/types\/core'/g" {} \;

# Update imports in hook files
echo "Updating hook imports..."
find src/hooks -name "*.ts" -type f -exec sed -i.bak "s/from '\.\.\/types'/from '\.\.\/types\/core'/g" {} \;

# Update imports in util files
echo "Updating util imports..."
find src/utils -name "*.ts" -type f -exec sed -i.bak "s/from '\.\.\/types'/from '\.\.\/types\/core'/g" {} \;

# Clean up backup files
find src -name "*.bak" -type f -delete

echo "Import updates complete!"