import { Component, Show, For, createSignal, onMount, onCleanup, createEffect, createMemo } from "solid-js";
import { Portal } from "solid-js/web";
import { Node as StoryNode } from "../types/core";
import {
  BsChevronUp,
  BsChevronLeft,
  BsChevronRight,
  BsPencil,
  BsTrash,
  BsFileText,
  BsClipboard,
  BsCheckCircle,
  BsCircle,
  BsFileEarmarkTextFill,
  BsFileEarmarkText,
  BsThreeDotsVertical,
  BsClock,
  BsPeople,
  BsGlobe,
} from "solid-icons/bs";
import { nodeStore } from "../stores/nodeStore";
import { charactersStore } from "../stores/charactersStore";
import { contextItemsStore } from "../stores/contextItemsStore";
import { useOllama } from "../hooks/useOllama";
import { getChaptersInStoryOrder } from "../utils/nodeTraversal";
import { NodeStatusMenu } from "./NodeStatusMenu";
import { StoryTimePicker } from "./StoryTimePicker";
import { ChapterContextManager } from "./ChapterContextManager";
import { calendarStore } from "../stores/calendarStore";
import { buildNodeMarkdown, buildPrecedingContextMarkdown } from "../utils/nodeContentExport";
import { getCharacterDisplayName } from "../utils/character";
import { copyPreviewStore } from "../stores/copyPreviewStore";
import styles from "./NodeHeader.module.css";

interface NodeHeaderProps {
  node: StoryNode;
  messageCount: number;
}

export const NodeHeader: Component<NodeHeaderProps> = (props) => {
  let headerRef: HTMLDivElement | undefined;
  let anchorRef: HTMLDivElement | undefined;
  let dropdownRef: HTMLDivElement | undefined;
  let dropdownButtonRef: HTMLButtonElement | undefined;
  const [showDropdown, setShowDropdown] = createSignal(false);
  const [dropdownPosition, setDropdownPosition] = createSignal({ top: 0, left: 0 });
  const [dropdownWidth, setDropdownWidth] = createSignal(200);
  const [dropdownMaxHeight, setDropdownMaxHeight] = createSignal(320);
  const [isSummaryExpanded, setIsSummaryExpanded] = createSignal(false);
  const [isEditingTitle, setIsEditingTitle] = createSignal(false);
  const [editTitle, setEditTitle] = createSignal(props.node.title);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = createSignal(false);
  const [isEditingTime, setIsEditingTime] = createSignal(false);
  const [isContextManagerOpen, setIsContextManagerOpen] = createSignal(false);
  const [isSelectingViewpoint, setIsSelectingViewpoint] = createSignal(false);
  const [isSelectingStorylines, setIsSelectingStorylines] = createSignal(false);
  const [isEditingGoal, setIsEditingGoal] = createSignal(false);
  const [editGoal, setEditGoal] = createSignal(props.node.goal || '');

  const { generateNodeSummary } = useOllama();

  // Create a memoized dropdown style to ensure reactivity
  const dropdownStyle = createMemo(() => {
    const pos = dropdownPosition();
    const width = dropdownWidth();
    const maxHeight = dropdownMaxHeight();
    console.log('Computing dropdown style - position:', pos);
    return {
      position: "fixed" as const,
      top: `${pos.top}px`,
      left: `${pos.left}px`,
      width: `${width}px`,
      'max-height': `${maxHeight}px`,
      'overflow-y': 'auto' as const,
      "z-index": 1000,
    };
  });

  const chaptersInOrder = createMemo(() => getChaptersInStoryOrder(nodeStore.nodesArray));
  const currentChapterIndex = createMemo(() =>
    chaptersInOrder().findIndex((chapter) => chapter.id === props.node.id)
  );
  const previousChapter = createMemo(() => {
    const chapters = chaptersInOrder();
    const index = currentChapterIndex();
    if (index > 0) {
      return chapters[index - 1];
    }
    return null;
  });
  const nextChapter = createMemo(() => {
    const chapters = chaptersInOrder();
    const index = currentChapterIndex();
    if (index >= 0 && index < chapters.length - 1) {
      return chapters[index + 1];
    }
    return null;
  });

  const getPreviousChapterTitle = () => {
    const chapter = previousChapter();
    return chapter ? `Go to previous chapter: ${chapter.title}` : "Previous chapter unavailable";
  };

  const getNextChapterTitle = () => {
    const chapter = nextChapter();
    return chapter ? `Go to next chapter: ${chapter.title}` : "Next chapter unavailable";
  };

  // Handle click outside to close dropdown
  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Don't close if we're editing the time or selecting viewpoint/storylines
      if (isEditingTime() || isSelectingViewpoint() || isSelectingStorylines()) return;

      if (dropdownRef && !dropdownRef.contains(e.target as HTMLElement) &&
          dropdownButtonRef && !dropdownButtonRef.contains(e.target as HTMLElement)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    onCleanup(() => document.removeEventListener('click', handleClickOutside));
  });

  const updateDropdownLayout = () => {
    if (!dropdownButtonRef) return;

    const rect = dropdownButtonRef.getBoundingClientRect();
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768;
    const horizontalMargin = 16;
    const minBottomMargin = 10;
    const minWidth = 200;
    const maxWidth = 360;

    // Calculate width
    const calculatedWidth = Math.min(Math.max(minWidth, viewportWidth - horizontalMargin * 2), maxWidth);
    const maxLeft = viewportWidth - calculatedWidth - horizontalMargin;
    const preferredLeft = rect.right - calculatedWidth;
    const clampedLeft = Math.min(Math.max(preferredLeft, horizontalMargin), Math.max(horizontalMargin, maxLeft));
    setDropdownWidth(calculatedWidth);

    // Calculate available space
    const spaceBelow = viewportHeight - rect.bottom - minBottomMargin;
    const spaceAbove = rect.top - minBottomMargin;
    const maxAvailableHeight = Math.max(120, viewportHeight - minBottomMargin * 2);

    let maxHeight = Math.min(spaceBelow, maxAvailableHeight);
    let top = rect.bottom + 4;

    // THE STUPID SIMPLE FIX: If status menu is open, just move up by 100px
    const statusOpen = isStatusMenuOpen();
    console.log('updateDropdownLayout - status menu open:', statusOpen, 'initial top:', top);
    if (statusOpen) {
      top -= 100;
      console.log('Shifted up by 100px, new top:', top);
      // Make sure we don't go off the top of the screen
      top = Math.max(minBottomMargin, top);
    }

    // If we're too close to the bottom, flip to above
    if (spaceBelow < 160 && spaceAbove > spaceBelow) {
      maxHeight = Math.min(spaceAbove, maxAvailableHeight);
      top = rect.top - 300 - 4;

      // Again, if status menu is open, shift up a bit more
      if (isStatusMenuOpen()) {
        top -= 50;
      }

      top = Math.max(minBottomMargin, top);
    }

    setDropdownMaxHeight(maxHeight);
    setDropdownPosition({
      top,
      left: clampedLeft
    });
  };

  // Update dropdown position when shown
  createEffect(() => {
    if (showDropdown()) {
      updateDropdownLayout();
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          updateDropdownLayout();
          // Additional update after content settles
          setTimeout(() => updateDropdownLayout(), 100);
        });
      } else {
        setTimeout(() => updateDropdownLayout(), 0);
      }
    }
  });

  // Separate effect to track status menu changes
  createEffect(() => {
    // Access the signal to create dependency
    const isOpen = isStatusMenuOpen();
    console.log('Status menu open state changed:', isOpen);

    // Only update if dropdown is visible
    if (showDropdown()) {
      console.log('Updating dropdown layout due to status menu change');
      updateDropdownLayout();
    }
  });

  onMount(() => {
    const handleResize = () => {
      if (showDropdown()) {
        updateDropdownLayout();
      }
    };

    window.addEventListener('resize', handleResize);
    onCleanup(() => window.removeEventListener('resize', handleResize));
  });

  const toggleSummaryExpanded = (e: MouseEvent) => {
    e.stopPropagation();
    setIsSummaryExpanded(!isSummaryExpanded());
  };

  const handleEditTitle = (e: MouseEvent) => {
    e.stopPropagation();
    setIsEditingTitle(true);
    setEditTitle(props.node.title);
    setShowDropdown(false);
  };

  const handleSaveTitle = () => {
    if (editTitle().trim() && editTitle() !== props.node.title) {
      nodeStore.updateNode(props.node.id, { title: editTitle().trim() });
    }
    setIsEditingTitle(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(props.node.title);
    setIsEditingTitle(false);
  };

  const handleEditGoal = (e: MouseEvent) => {
    e.stopPropagation();
    setIsEditingGoal(true);
    setEditGoal(props.node.goal || '');
    setShowDropdown(false);
  };

  const handleSaveGoal = () => {
    const newGoal = editGoal().trim();
    if (newGoal !== (props.node.goal || '')) {
      nodeStore.updateNode(props.node.id, { goal: newGoal || undefined });
    }
    setIsEditingGoal(false);
  };

  const handleCancelGoalEdit = () => {
    setEditGoal(props.node.goal || '');
    setIsEditingGoal(false);
  };

  const handleDelete = async (e: MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete ${props.node.type} "${props.node.title}" and all its contents?`)) {
      nodeStore.deleteNode(props.node.id);
    }
    setShowDropdown(false);
  };

  const handleGenerateSummary = async (e: MouseEvent) => {
    e.stopPropagation();
    setShowDropdown(false);
    try {
      await nodeStore.generateNodeSummary(props.node.id, generateNodeSummary);
    } catch (error) {
      console.error('Failed to generate summary:', error);
      alert('Failed to generate summary: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleCopyNode = (e: MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement node copy functionality
    alert('Copy functionality not yet implemented');
    setShowDropdown(false);
  };

  const handleCopyAsMarkdown = async (e: MouseEvent) => {
    e.stopPropagation();
    const markdown = buildNodeMarkdown(props.node.id);
    if (!markdown) {
      alert("No story content available to copy yet.");
      return;
    }

    if (!navigator.clipboard) {
      alert("Clipboard access is not available in this browser.");
      return;
    }

    try {
      await navigator.clipboard.writeText(markdown);
      setShowDropdown(false);
    } catch (error) {
      console.error("Failed to copy chapter as Markdown:", error);
      alert("Failed to copy chapter to clipboard. Please try again.");
    }
  };

  const handleCopyPreviousContext = async (e: MouseEvent) => {
    e.stopPropagation();
    const summary = buildPrecedingContextMarkdown(props.node.id, {
      includeCurrentNode: false,
      mode: "summary",
    });

    if (!summary) {
      alert("No previous chapters with content were found to copy.");
      return;
    }

    setShowDropdown(false);
    await copyPreviewStore.requestCopy(summary);
  };

  const handleEditTime = (e: MouseEvent) => {
    e.stopPropagation();
    setIsEditingTime(true);
  };

  const handleSaveTime = (time: number | null) => {
    nodeStore.updateNode(props.node.id, { storyTime: time ?? undefined });
    setIsEditingTime(false);
    setShowDropdown(false);
  };

  const handleCancelTimeEdit = () => {
    setIsEditingTime(false);
  };

  const handleManageContext = (e: MouseEvent) => {
    e.stopPropagation();
    setIsContextManagerOpen(true);
    setShowDropdown(false);
  };

  const handleSelectViewpoint = (e: MouseEvent) => {
    e.stopPropagation();
    setIsSelectingViewpoint(true);
  };

  const handleSetViewpointCharacter = (characterId: string | null) => {
    nodeStore.updateNode(props.node.id, { viewpointCharacterId: characterId || undefined });
    setIsSelectingViewpoint(false);
    setShowDropdown(false);
  };

  const handleToggleStoryline = (storylineId: string) => {
    const currentIds = props.node.activeContextItemIds || [];

    // Preserve non-plot items
    const nonPlotIds = currentIds.filter(id => {
      const item = contextItemsStore.contextItems.find(i => i.id === id);
      return item && item.type !== 'plot';
    });

    // Toggle the selected storyline
    const plotIds = currentIds.filter(id => {
      const item = contextItemsStore.contextItems.find(i => i.id === id);
      return item && item.type === 'plot';
    });

    let newPlotIds: string[];
    if (plotIds.includes(storylineId)) {
      newPlotIds = plotIds.filter(id => id !== storylineId);
    } else {
      newPlotIds = [...plotIds, storylineId];
    }

    nodeStore.updateNode(props.node.id, {
      activeContextItemIds: [...nonPlotIds, ...newPlotIds]
    });
  };

  const handleScrollToTop = () => {
    if (anchorRef) {
      anchorRef.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleNavigateToChapter = (chapterId: string | undefined) => {
    if (!chapterId) return;
    nodeStore.selectNode(chapterId);
    setShowDropdown(false);
  };

  // Get status icon
  const getStatusIcon = () => {
    switch (props.node.status) {
      case "done":
        return <BsCheckCircle color="#22c55e" />;
      case "review":
        return <BsFileEarmarkTextFill color="#3b82f6" />;
      case "needs_work":
        return <BsFileEarmarkText color="#f97316" />;
      case "draft":
      default:
        return <BsCircle color="#94a3b8" />;
    }
  };

  // Get status text
  const getStatusText = () => {
    switch (props.node.status) {
      case "done":
        return "Done";
      case "review":
        return "Ready for Review";
      case "needs_work":
        return "Needs Work";
      case "draft":
      default:
        return "Draft";
    }
  };

  // Get active characters for this scene
  const activeCharacters = createMemo(() => {
    if (props.node.type !== 'scene' || !props.node.activeCharacterIds) {
      return [];
    }
    const activeIds = new Set(props.node.activeCharacterIds);
    return charactersStore.characters.filter(char => activeIds.has(char.id));
  });

  // Get active context items for this scene (non-global, non-plot only)
  const activeContextItems = createMemo(() => {
    if (props.node.type !== 'scene' || !props.node.activeContextItemIds) {
      return [];
    }
    const activeIds = new Set(props.node.activeContextItemIds);
    return contextItemsStore.contextItems.filter(item =>
      !item.isGlobal && item.type !== 'plot' && activeIds.has(item.id)
    );
  });

  // Get the protagonist character
  const protagonist = createMemo(() =>
    charactersStore.characters.find(char => char.isMainCharacter)
  );

  // Get the viewpoint character for this scene (or default to protagonist)
  const viewpointCharacter = createMemo(() => {
    if (props.node.type !== 'scene') return null;

    // If a specific viewpoint character is set, use it
    if (props.node.viewpointCharacterId) {
      return charactersStore.characters.find(
        char => char.id === props.node.viewpointCharacterId
      );
    }

    // Otherwise default to protagonist
    return protagonist();
  });

  // Check if viewpoint is explicitly set (not defaulting to protagonist)
  const hasExplicitViewpoint = createMemo(() =>
    props.node.type === 'scene' && !!props.node.viewpointCharacterId
  );

  // Get all storylines (plot-type context items)
  const storylines = createMemo(() =>
    contextItemsStore.contextItems.filter(item => item.type === 'plot')
  );

  // Get active storylines for this scene
  const activeStorylines = createMemo(() => {
    if (props.node.type !== 'scene' || !props.node.activeContextItemIds) {
      return [];
    }
    const activeIds = new Set(props.node.activeContextItemIds);
    return storylines().filter(s => activeIds.has(s.id));
  });

  // Get first 2 lines of summary or placeholder
  const getSummaryPreview = () => {
    if (props.node.isSummarizing) {
      return "Generating summary...";
    }
    if (!props.node.summary) {
      return "No summary yet. Click to generate.";
    }
    const lines = props.node.summary.split("\n");
    if (lines.length <= 2) {
      return props.node.summary;
    }
    return lines.slice(0, 2).join("\n") + "...";
  };

  return (
    <>
      <div ref={anchorRef} class={styles.scrollAnchor} />
      <div ref={headerRef} class={styles.nodeHeader}>
        <div class={styles.nodeHeaderLeft}>
          <div class={styles.nodeTitleSection}>
            <Show when={!isEditingTitle()}>
              <div class={styles.nodeTitle}>
                {props.node.title}
              </div>
            </Show>
            <Show when={isEditingTitle()}>
              <input
                class={styles.editInput}
                value={editTitle()}
                onInput={(e) => setEditTitle(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                onBlur={handleSaveTitle}
                autofocus
              />
            </Show>
            <Show when={props.node.status && !isEditingTitle()}>
              <div class={styles.statusBadge} title={getStatusText()}>
                {getStatusIcon()}
              </div>
            </Show>
          </div>
          <div class={styles.nodeMetadata}>
            <span class={styles.metaItem}>
              {props.messageCount} {props.messageCount === 1 ? "message" : "messages"}
            </span>
            <Show when={props.node.wordCount}>
              <span class={styles.metaItem}>
                {props.node.wordCount} words
              </span>
            </Show>
            <Show when={props.node.storyTime !== undefined && props.node.storyTime !== null}>
              <span class={styles.metaItem} title={calendarStore.formatStoryTime(props.node.storyTime!)}>
                <BsClock style={{ "font-size": "0.9em", "vertical-align": "middle" }} />
                {calendarStore.formatStoryTime(props.node.storyTime!)}
              </span>
            </Show>
            <Show when={props.node.type === 'scene' && viewpointCharacter()}>
              <span class={styles.metaItem} title={hasExplicitViewpoint() ? "Viewpoint character (custom)" : "Viewpoint character (protagonist)"}>
                POV: {viewpointCharacter() ? getCharacterDisplayName(viewpointCharacter()!) : ''}{hasExplicitViewpoint() ? '' : ' (default)'}
              </span>
            </Show>
          </div>

          <Show when={props.node.type === 'scene' && (activeCharacters().length > 0 || activeContextItems().length > 0 || activeStorylines().length > 0)}>
            <div class={styles.activeContext}>
              <Show when={activeCharacters().length > 0}>
                <div class={styles.activeContextSection}>
                  <span class={styles.contextLabel}>Characters:</span>
                  <span class={styles.contextList}>
                    {activeCharacters().map(char => getCharacterDisplayName(char)).join(', ')}
                  </span>
                </div>
              </Show>
              <Show when={activeContextItems().length > 0}>
                <div class={styles.activeContextSection}>
                  <span class={styles.contextLabel}>Context:</span>
                  <span class={styles.contextList}>
                    {activeContextItems().map(item => item.name).join(', ')}
                  </span>
                </div>
              </Show>
              <Show when={activeStorylines().length > 0}>
                <div class={styles.activeContextSection}>
                  <span class={styles.contextLabel}>Storylines:</span>
                  <span class={styles.contextList}>
                    {activeStorylines().map(s => s.name).join(', ')}
                  </span>
                </div>
              </Show>
            </div>
          </Show>
        </div>

        <div class={styles.nodeActions}>
          <button
            class={styles.scrollButton}
            onClick={() => handleNavigateToChapter(previousChapter()?.id)}
            disabled={!previousChapter()}
            title={getPreviousChapterTitle()}
            aria-label="Previous chapter"
          >
            <BsChevronLeft />
          </button>

          <button
            class={styles.scrollButton}
            onClick={() => handleNavigateToChapter(nextChapter()?.id)}
            disabled={!nextChapter()}
            title={getNextChapterTitle()}
            aria-label="Next chapter"
          >
            <BsChevronRight />
          </button>

          <button
            ref={dropdownButtonRef}
            class={styles.actionButton}
            onClick={(e) => {
              e.stopPropagation();
              setShowDropdown(!showDropdown());
            }}
            title="More actions"
          >
            <BsThreeDotsVertical />
          </button>

          <button
            class={styles.scrollButton}
            onClick={handleScrollToTop}
            title="Scroll to top"
          >
            <BsChevronUp />
          </button>
        </div>

        <Portal>
          <Show when={showDropdown()}>
            <div
              ref={dropdownRef}
              class={styles.dropdown}
              style={dropdownStyle()}
            >
              <button onClick={handleEditTitle}>
                <BsPencil /> Edit Title
              </button>

              <Show when={props.node.type === "scene"}>
                <button onClick={handleEditGoal}>
                  <BsFileText />
                  {props.node.goal ? 'Edit Goal' : 'Set Goal'}
                </button>
              </Show>

              <Show when={props.node.type === "scene" && !isEditingTime()}>
                <button onClick={handleEditTime}>
                  <BsClock />
                  {props.node.storyTime !== undefined && props.node.storyTime !== null
                    ? `Edit Time: ${calendarStore.formatStoryTime(props.node.storyTime)}`
                    : 'Set Story Time'}
                </button>
              </Show>

              <Show when={isEditingTime()}>
                <StoryTimePicker
                  currentTime={props.node.storyTime ?? null}
                  previousChapterTime={previousChapter()?.storyTime ?? null}
                  onSave={handleSaveTime}
                  onCancel={handleCancelTimeEdit}
                />
              </Show>

              <Show when={props.node.type === "scene"}>
                <button onClick={handleManageContext}>
                  <BsPeople /> Manage Active Context
                </button>
              </Show>

              <Show when={props.node.type === "scene" && !isSelectingViewpoint()}>
                <button onClick={handleSelectViewpoint}>
                  <BsPeople />
                  {viewpointCharacter()
                    ? `Viewpoint: ${getCharacterDisplayName(viewpointCharacter()!)}${hasExplicitViewpoint() ? '' : ' (default)'}`
                    : 'Set Viewpoint Character'}
                </button>
              </Show>

              <Show when={isSelectingViewpoint()}>
                <div class={styles.viewpointSelector}>
                  <div class={styles.viewpointHeader}>Select Viewpoint Character:</div>
                  <Show when={protagonist()}>
                    <button
                      class={styles.viewpointOption}
                      onClick={() => handleSetViewpointCharacter(null)}
                    >
                      {getCharacterDisplayName(protagonist()!)} (Protagonist - Default)
                    </button>
                  </Show>
                  <For each={activeCharacters()}>
                    {(char) => (
                      <Show when={char.id !== protagonist()?.id}>
                        <button
                          class={styles.viewpointOption}
                          onClick={() => handleSetViewpointCharacter(char.id)}
                        >
                          {getCharacterDisplayName(char)}
                        </button>
                      </Show>
                    )}
                  </For>
                  <button
                    class={styles.viewpointCancel}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSelectingViewpoint(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </Show>

              <Show when={props.node.type === "scene" && !isSelectingStorylines()}>
                <button onClick={(e) => {
                  e.stopPropagation();
                  setIsSelectingStorylines(true);
                }}>
                  <BsGlobe />
                  {activeStorylines().length > 0
                    ? `Storylines (${activeStorylines().length})`
                    : 'Assign Storylines'}
                </button>
              </Show>

              <Show when={isSelectingStorylines()}>
                <div class={styles.viewpointSelector}>
                  <div class={styles.viewpointHeader}>Select Storylines:</div>
                  <For each={storylines()}>
                    {(storyline) => {
                      const isActive = () => (props.node.activeContextItemIds || []).includes(storyline.id);
                      return (
                        <label class={styles.viewpointOption} style={{ display: 'flex', 'align-items': 'center', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isActive()}
                            onChange={() => handleToggleStoryline(storyline.id)}
                            style={{ 'margin-right': '8px' }}
                          />
                          {storyline.name}
                        </label>
                      );
                    }}
                  </For>
                  <Show when={storylines().length === 0}>
                    <p style={{ padding: '8px', opacity: 0.6, 'font-size': '0.9em' }}>
                      No storylines defined. Add plot-type context items first.
                    </p>
                  </Show>
                  <button
                    class={styles.viewpointCancel}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSelectingStorylines(false);
                    }}
                  >
                    Done
                  </button>
                </div>
              </Show>

              <Show when={props.node.type === "scene"}>
                <button onClick={handleCopyPreviousContext}>
                  <BsFileEarmarkTextFill /> Copy Previous Context
                </button>
                <button onClick={handleCopyAsMarkdown}>
                  <BsFileEarmarkText /> Copy as Markdown
                </button>
              </Show>

              <button onClick={handleCopyNode} disabled>
                <BsClipboard />
                Copy Node (TODO)
              </button>

              <div class={styles.dropdownDivider} />

              <Show when={props.node.type === "scene"}>
                <NodeStatusMenu
                  currentStatus={props.node.status}
                  onSelect={(status) => nodeStore.updateNode(props.node.id, { status })}
                  onOptionSelected={() => setShowDropdown(false)}
                  parentMenuOpen={() => showDropdown()}
                  onLayoutChange={updateDropdownLayout}
                  onOpenChange={(isOpen) => {
                    setIsStatusMenuOpen(isOpen)
                    updateDropdownLayout()
                  }}
                />

                <div class={styles.dropdownDivider} />
              </Show>

              <button
                onClick={handleGenerateSummary}
                title="Generate summary"
                disabled={props.node.isSummarizing}
              >
                <Show when={!props.node.isSummarizing}>
                  <BsFileText />
                </Show>
                <Show when={props.node.isSummarizing}>
                  <span class={styles.spinner}>⟳</span>
                </Show>
                {props.node.summary ? "Regenerate" : "Generate"} Summary
              </button>

              <div class={styles.dropdownDivider} />

              <button onClick={handleDelete} class={styles.deleteButton}>
                <BsTrash /> Delete Node
              </button>
            </div>
          </Show>
        </Portal>
      </div>

      <Show when={props.node.summary || props.node.isSummarizing}>
        <div class={styles.summarySection}>
          <Show when={!isSummaryExpanded()}>
            <div class={styles.summaryPreview} onClick={toggleSummaryExpanded}>
              {getSummaryPreview()}
            </div>
          </Show>
          <Show when={isSummaryExpanded()}>
            <div class={styles.summaryFull} onClick={toggleSummaryExpanded}>
              {props.node.isSummarizing
                ? "Generating summary..."
                : props.node.summary || "No summary yet. Click to generate."}
            </div>
          </Show>
        </div>
      </Show>

      <Show when={props.node.type === "scene" && (isEditingGoal() || props.node.goal)}>
        <div class={styles.goalSection}>
          <Show when={!isEditingGoal()}>
            <div class={styles.goalLabel}>Goal:</div>
            <div class={styles.goalText}>{props.node.goal}</div>
          </Show>
          <Show when={isEditingGoal()}>
            <div class={styles.goalLabel}>Goal:</div>
            <textarea
              class={styles.goalInput}
              value={editGoal()}
              onInput={(e) => setEditGoal(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleCancelGoalEdit();
                if (e.key === 'Enter' && e.ctrlKey) handleSaveGoal();
              }}
              onBlur={handleSaveGoal}
              placeholder="What are you trying to accomplish in this chapter?"
              rows={3}
              autofocus
            />
          </Show>
        </div>
      </Show>

      <Show when={props.node.type === "scene"}>
        <ChapterContextManager
          isOpen={isContextManagerOpen()}
          onClose={() => setIsContextManagerOpen(false)}
          chapterNode={props.node}
        />
      </Show>
    </>
  );
};
