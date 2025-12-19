import type { Node } from '@writer/shared'

export const getOrderedSceneIds = (structure: Node[]): string[] => {
  return structure.flatMap(
    (book) =>
      book.children?.flatMap(
        (arc) => arc.children?.flatMap((chapter) => chapter.children?.map((scene) => scene.id) || []) || [],
      ) || [],
  )
}
