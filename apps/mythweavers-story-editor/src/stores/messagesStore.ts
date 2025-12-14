import { createStore } from "solid-js/store";
import { batch, createMemo } from "solid-js";
import { Message } from "../types/core";
import { SavedStory } from "../types/store";
import { VersionConflictError } from "../types/api";
import { apiClient } from "../utils/apiClient";
import { storage } from "../utils/storage";
import { generateMessageId } from "../utils/id";
import { createSavePayload } from "../utils/savePayload";
import { errorStore } from "./errorStore";
import { nodeStore } from "./nodeStore";
import { currentStoryStore } from "./currentStoryStore";
import { getStoryStats } from "../utils/storyUtils";
import { settingsStore } from "./settingsStore";
import { saveService } from "../services/saveService";
import { calculateActivePath } from "../utils/nodeTraversal";

// Load saved input from localStorage
const savedInput = localStorage.getItem("story-input") || "";

const [messagesState, setMessagesState] = createStore({
  messages: [] as Message[],
  input: savedInput,
  isLoading: false,
  isAnalyzing: false,
  isSaving: false,
  isManualSaving: false, // For showing UI lock during manual save
  saveQueueLength: 0, // Number of items in save queue
  lastSaveError: null as string | null,
  showStorageFullModal: false,
  showConflictDialog: false,
  conflictInfo: null as {
    serverUpdatedAt: string;
    clientUpdatedAt: string;
  } | null,
});

// Data loading is handled by reloadDataForStory

// Full save function that saves the entire story (for local storage or manual saves)
const saveFullStory = async () => {
  // Import dependencies dynamically to avoid circular imports
  const { currentStoryStore } = await import("./currentStoryStore");
  const { storyManager } = await import("../utils/storyManager");

  // Don't save if no story is initialized
  if (!currentStoryStore.isInitialized) {
    // No story initialized, skipping auto-save
    return;
  }

  // Don't save if we're already saving or loading
  if (messagesState.isSaving || messagesState.isLoading) return;

  // Don't save empty stories
  if (messagesState.messages.length === 0) return;

  // Don't save if storage mode is not set (during initialization)
  if (!currentStoryStore.storageMode) return;

  setMessagesState("isSaving", true);
  setMessagesState("lastSaveError", null);

  try {
    // Create consistent save payload
    const storyData = createSavePayload();

    // Saving chapters

    if (currentStoryStore.storageMode === "server") {
      // Save to server
      // Always update existing server story
      // Server stories are loaded with their server ID as the story ID
      try {
        // Save maps first (including any pending landmark changes)
        const { mapsStore } = await import("./mapsStore");
        await mapsStore.saveAllMaps();

        const response = await apiClient.updateStory(currentStoryStore.id, {
          ...storyData,
          lastKnownUpdatedAt: currentStoryStore.lastKnownUpdatedAt,
        });
        // Update the last known updatedAt timestamp
        currentStoryStore.setLastKnownUpdatedAt(response.updatedAt);
      } catch (error) {
        // Check for version conflict error (both VersionConflictError instance and error with VERSION_CONFLICT code)
        if (
          error instanceof VersionConflictError ||
          (error instanceof Error && (error as any).code === "VERSION_CONFLICT")
        ) {
          // Show conflict dialog
          const conflictError = error as VersionConflictError;
          setMessagesState("conflictInfo", {
            serverUpdatedAt:
              conflictError.serverUpdatedAt || (error as any).serverUpdatedAt,
            clientUpdatedAt:
              conflictError.clientUpdatedAt || (error as any).clientUpdatedAt,
          });
          setMessagesState("showConflictDialog", true);
          throw error; // Re-throw to prevent marking as saved
        }
        throw error;
      }
      // Story auto-saved to server
    } else {
      // Save to local storage
      // Update the existing local story
      await storyManager.updateLocalStory(currentStoryStore.id, {
        ...storyData,
        id: currentStoryStore.id,
        savedAt: new Date(),
        storageMode: "local",
      } satisfies SavedStory);
      // Story auto-saved to local storage
    }

    currentStoryStore.updateAutoSaveTime();
  } catch (error) {
    console.error("Failed to auto-save story:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    setMessagesState("lastSaveError", errorMessage);
    errorStore.addError(`Save failed: ${errorMessage}`);
  } finally {
    setMessagesState("isSaving", false);
  }
};

// Initialize save service callbacks and storage handlers
saveService.setCallbacks({
  onSaveStatusChange: (isSaving) => {
    setMessagesState("isSaving", isSaving);
    if (!isSaving) {
      // Update auto-save time when save completes
      currentStoryStore.updateAutoSaveTime();
    }
  },
  onQueueLengthChange: (length) => {
    setMessagesState("saveQueueLength", length);
  },
  onConflict: (serverUpdatedAt, clientUpdatedAt) => {
    setMessagesState("conflictInfo", { serverUpdatedAt, clientUpdatedAt });
    setMessagesState("showConflictDialog", true);
  },
  onError: (error) => {
    setMessagesState("lastSaveError", error.message);
    errorStore.addError(error.message);
  },
  onOperationFailed: (operation, error) => {
    // Handle rollback of failed operations
    console.log(`[SaveService] Rolling back failed operation: ${operation.type} for ${operation.entityId}`, error.message);

    // Import mapsStore dynamically to avoid circular dependency
    import('../stores/mapsStore').then(({ mapsStore }) => {
      const mapId = operation.data?.mapId;

      if (operation.entityType === 'hyperlane' && operation.type === 'hyperlane-insert' && mapId) {
        // Roll back hyperlane creation
        mapsStore.deleteHyperlane(mapId, operation.entityId);
        console.log(`Rolled back failed hyperlane creation: ${operation.entityId}`);
      } else if (operation.entityType === 'landmark' && operation.type === 'landmark-insert' && mapId) {
        // Roll back landmark creation (junctions)
        mapsStore.deleteLandmark(mapId, operation.entityId);
        console.log(`Rolled back failed landmark creation: ${operation.entityId}`);
      } else if (operation.entityType === 'fleet' && operation.type === 'fleet-insert' && mapId) {
        // Roll back fleet creation
        mapsStore.deleteFleet(mapId, operation.entityId);
        console.log(`Rolled back failed fleet creation: ${operation.entityId}`);
      }
    });
  },
});

// Set trigger full save function for saveService (only used for local stories)
saveService.setTriggerFullSave(() => saveFullStory());

// Helper function to trigger save through saveService
const triggerMessageSave = (
  messageId: string,
  message: Message,
  operation: "update" | "insert" | "delete",
  debounce: boolean = false,
  afterMessageId?: string | null,
) => {
  if (!currentStoryStore.isInitialized || !currentStoryStore.storageMode) {
    return;
  }

  // SaveService will handle local vs server storage internally
  saveService.saveMessage(
    currentStoryStore.id,
    messageId,
    message,
    operation,
    debounce,
    afterMessageId,
  );
};

// Removed non-functional debounced auto-save effect
// Auto-save is triggered manually in specific places where needed

// Memoized computation of visible messages
const visibleMessages = createMemo(() => {
  const showEvents = settingsStore.showEventMessages;

  return messagesState.messages.filter((msg) => {
    // Optionally hide event messages based on setting
    if (msg.type === "event" && !showEvents) return false;
    return true;
  });
});

// Memoized computation of total story turns (based on visible messages)
const totalStoryTurns = createMemo(() => {
  // Use visibleMessages which already filters based on settings
  return visibleMessages().filter(
    (msg) => msg.role === "assistant" && !msg.isQuery,
  ).length;
});

// Memoized computation of story turn numbers for all messages
const storyTurnNumbers = createMemo(() => {
  // Use visibleMessages which already filters based on settings
  const turnNumbers = new Map<string, number>();
  let storyTurnCount = 0;

  visibleMessages().forEach((msg) => {
    if (msg.role === "assistant" && !msg.isQuery) {
      storyTurnCount++;
    }
    turnNumbers.set(msg.id, storyTurnCount);
  });

  return turnNumbers;
});

// Memoized computation of nodes with branch messages (for StoryNavigation performance)
const nodeIdsWithBranches = createMemo(() => {
  const nodeIds = new Set<string>();

  for (const msg of messagesState.messages) {
    if (msg.type === "branch" && (msg.nodeId || msg.chapterId)) {
      nodeIds.add(msg.nodeId || msg.chapterId!);
    }
  }

  return nodeIds;
});

// Memoized computation of active path (based on branch choices)
const activePath = createMemo(() => {
  const messages = messagesState.messages;
  const nodes = nodeStore.nodesArray;
  const branchChoices = currentStoryStore.branchChoices || {};

  console.log("[activePath] Memo running:", {
    messageCount: messages.length,
    nodeCount: nodes.length,
    branchChoiceCount: Object.keys(branchChoices).length,
  });

  // Skip expensive calculation if no branch choices exist
  // (without branches, all messages/nodes are implicitly active)
  if (
    messages.length === 0 ||
    nodes.length === 0 ||
    Object.keys(branchChoices).length === 0
  ) {
    return {
      activeMessageIds: new Set<string>(),
      activeNodeIds: new Set<string>(),
    };
  }

  console.time("[activePath] calculateActivePath");
  const result = calculateActivePath(messages, nodes, branchChoices);
  console.timeEnd("[activePath] calculateActivePath");
  return result;
});

// Initialize effects within app lifecycle
let effectsInitialized = false;
const initializeEffects = () => {
  if (effectsInitialized) return;
  effectsInitialized = true;

  // Auto-save is now handled by the main auto-save function
  // which saves the full story data
};

// Function to reload data when story changes
const reloadDataForStory = async (storyId: string) => {
  try {
    // Import dependencies dynamically to avoid circular dependency
    const { storyManager } = await import("../utils/storyManager");

    // Clear current data but preserve saved input
    setMessagesState("messages", []);
    // Don't clear input if we have saved input in localStorage
    const savedInput = localStorage.getItem("story-input");
    if (!savedInput) {
      setMessagesState("input", "");
    }

    // Load the full story data
    const story = await storyManager.loadStory(storyId);
    if (story) {
      // Chapters are now handled through the node system

      // Filter out compacted messages - they're no longer needed
      const messages = story.messages
        .filter((msg) => !msg.isCompacted)
        .map((msg) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
          isSummarizing: false,
        }));

      // Log if we filtered any compacted messages
      const compactedCount = story.messages.filter(
        (msg) => msg.isCompacted,
      ).length;
      if (compactedCount > 0) {
        // Filtered out compacted messages
      }

      // Loaded story from storage

      // Verify chapter associations
      const chapterIds = new Set(story.chapters?.map((ch) => ch.id) || []);
      let orphanedMessages = 0;
      messages.forEach((msg) => {
        if (msg.chapterId && !chapterIds.has(msg.chapterId)) {
          // Message has invalid chapterId
          orphanedMessages++;
        }
      });
      if (orphanedMessages > 0) {
        // Found messages with invalid chapter associations
      }

      batch(() => {
        setMessagesState("messages", messages);
        // Only set input from story if we don't have saved input in localStorage
        const savedInput = localStorage.getItem("story-input");
        if (!savedInput) {
          setMessagesState("input", story.input || "");
        }
      });

      // Load maps for this story
      const { mapsStore } = await import("./mapsStore");
      await mapsStore.initializeMaps(
        story.storageMode === "server" ? storyId : undefined,
      );
    }
  } catch (error) {
    console.error("Error reloading data for story:", error);
  }
};

export const messagesStore = {
  // Initialize effects (call this from App component)
  initializeEffects,

  // Reload data when story changes
  reloadDataForStory,

  // Getters
  get messages() {
    return messagesState.messages;
  },
  get input() {
    return messagesState.input;
  },
  get isLoading() {
    return messagesState.isLoading;
  },
  get isAnalyzing() {
    return messagesState.isAnalyzing;
  },
  get isSaving() {
    return messagesState.isSaving;
  },
  get isManualSaving() {
    return messagesState.isManualSaving;
  },
  get saveQueueLength() {
    return messagesState.saveQueueLength;
  },
  get lastSaveError() {
    return messagesState.lastSaveError;
  },
  get showStorageFullModal() {
    return messagesState.showStorageFullModal;
  },
  get showConflictDialog() {
    return messagesState.showConflictDialog;
  },
  get conflictInfo() {
    return messagesState.conflictInfo;
  },
  get hasQueries() {
    return messagesState.messages.some((msg) => msg.isQuery);
  },
  get hasStoryMessages() {
    return messagesState.messages.some((msg) => !msg.isQuery);
  },
  get visibleMessages() {
    return visibleMessages();
  },
  get activeMessageIds() {
    return activePath().activeMessageIds;
  },
  get activeNodeIds() {
    return activePath().activeNodeIds;
  },
  isMessageActive(messageId: string): boolean {
    const activeIds = activePath().activeMessageIds;
    // If no branch choices, everything is active
    if (
      activeIds.size === 0 &&
      Object.keys(currentStoryStore.branchChoices || {}).length === 0
    ) {
      return true;
    }
    return activeIds.has(messageId);
  },
  isNodeActive(nodeId: string): boolean {
    const activeIds = activePath().activeNodeIds;
    // If no branch choices, everything is active
    if (
      activeIds.size === 0 &&
      Object.keys(currentStoryStore.branchChoices || {}).length === 0
    ) {
      return true;
    }
    return activeIds.has(nodeId);
  },

  // Check if a node has branch messages (O(1) lookup)
  hasNodeBranches(nodeId: string): boolean {
    return nodeIdsWithBranches().has(nodeId);
  },

  // Get story statistics
  getStats: (
    charsPerToken: number,
    model?: string,
    provider?: "ollama" | "openrouter" | "anthropic" | "openai",
  ) => {
    return getStoryStats(
      messagesState.messages,
      charsPerToken,
      model,
      provider as any,
    );
  },

  // Helper to get the chapter ID for a position
  getChapterIdForPosition: (
    afterMessageId: string | null,
  ): string | undefined => {
    const messages = messagesState.messages;

    if (afterMessageId === null) {
      // Inserting at beginning - no chapter
      return undefined;
    }

    const index = messages.findIndex((msg) => msg.id === afterMessageId);
    if (index === -1) return undefined;

    // Look backwards from this position to find the most recent chapter marker
    for (let i = index; i >= 0; i--) {
      const msg = messages[i];
      if (msg.type === "chapter" && msg.chapterId) {
        return msg.chapterId;
      }
    }

    return undefined;
  },

  getCurrentChapterId: () => {
    // Chapters are now nodes - use getCurrentNodeId instead
    // This function is kept for backward compatibility
    const selectedNodeId = nodeStore.selectedNodeId;
    if (selectedNodeId) {
      return selectedNodeId;
    }

    // Otherwise, look at the last message's chapterId or nodeId
    const messages = messagesState.messages;
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      return lastMessage.chapterId || lastMessage.nodeId;
    }

    return undefined;
  },

  getCurrentNodeId: () => {
    // Import here to avoid circular dependency
    const { nodeStore } = require("./nodeStore");

    // First check if there's a selected node
    const selectedNodeId = nodeStore.selectedNodeId;
    if (selectedNodeId) {
      return selectedNodeId;
    }

    // Get the last message's nodeId - every message should have one
    const messages = messagesState.messages;
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage.nodeId) {
        // Last message does not have a nodeId
        throw new Error(
          "Last message does not have a nodeId - this should not happen",
        );
      }
      return lastMessage.nodeId;
    }

    return null;
  },

  // Get the message ID to insert after for a specific node
  getInsertAfterIdForNode: (nodeId: string): string | null => {
    console.log(
      "[messagesStore.getInsertAfterIdForNode] Looking for insertion point for node:",
      nodeId,
    );
    const messages = messagesState.messages;

    // Find the last message that belongs to this node
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.nodeId === nodeId) {
        console.log(
          "[messagesStore.getInsertAfterIdForNode] Found last message in node:",
          msg.id,
        );
        return msg.id;
      }
    }

    console.log(
      "[messagesStore.getInsertAfterIdForNode] No messages found in node",
    );

    return null;
  },

  // Get the message ID to insert after for a specific chapter
  getInsertAfterIdForChapter: (chapterId: string): string | null => {
    const messages = messagesState.messages;
    let lastMessageIdInChapter: string | null = null;

    // Find the last message that belongs to this chapter
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (
        msg.chapterId === chapterId ||
        (msg.type === "chapter" && msg.chapterId === chapterId)
      ) {
        lastMessageIdInChapter = msg.id;
        break;
      }
    }

    // If we found a message in the chapter, return it
    if (lastMessageIdInChapter) {
      return lastMessageIdInChapter;
    }

    // If no messages in chapter yet, find the chapter marker
    const chapterMarkerIndex = messages.findIndex(
      (msg) => msg.type === "chapter" && msg.chapterId === chapterId,
    );

    if (chapterMarkerIndex !== -1) {
      return messages[chapterMarkerIndex].id;
    }

    // Chapter not found
    return null;
  },

  // Actions
  setMessages: (messages: Message[]) => {
    setMessagesState("messages", messages);
    const nodeMessages: Record<string, Record<string, number>> = {};
    messages.forEach((msg) => {
      if (msg.nodeId) {
        if (!nodeMessages[msg.nodeId]) {
          nodeMessages[msg.nodeId] = {};
        }
        nodeMessages[msg.nodeId][msg.id] = msg.content.split(" ").length;
      }
    });

    for (const nodeId in nodeMessages) {
      nodeStore.updateNodeNoSave(nodeId, {
        messageWordCounts: nodeMessages[nodeId],
        wordCount: Object.values(nodeMessages[nodeId]).reduce(
          (acc, val) => acc + val,
          0,
        ),
      });
    }
  },

  // Attach all orphaned messages (without nodeId) to a specific node
  attachOrphanedMessagesToNode: (targetNodeId: string) => {
    const messages = messagesState.messages;
    const orphanedMessages = messages.filter((m) => !m.nodeId && !m.chapterId);

    if (orphanedMessages.length === 0) {
      console.log(
        "[messagesStore.attachOrphanedMessagesToNode] No orphaned messages found",
      );
      return;
    }

    console.log(
      "[messagesStore.attachOrphanedMessagesToNode] Found orphaned messages:",
      orphanedMessages.length,
    );

    // Get the highest order in the target node
    const targetNodeMessages = messages.filter(
      (m) => m.nodeId === targetNodeId,
    );
    const maxOrder =
      targetNodeMessages.length > 0
        ? Math.max(...targetNodeMessages.map((m) => m.order))
        : -1;

    // Update all orphaned messages with the target nodeId and new order values
    const updates: Array<{ messageId: string; nodeId: string; order: number }> =
      [];
    const updatedMessages = messages.map((msg) => {
      if (!msg.nodeId && !msg.chapterId) {
        const orphanIndex = orphanedMessages.indexOf(msg);
        const newOrder = maxOrder + 1 + orphanIndex;
        updates.push({
          messageId: msg.id,
          nodeId: targetNodeId,
          order: newOrder,
        });
        return {
          ...msg,
          nodeId: targetNodeId,
          order: newOrder,
        };
      }
      return msg;
    });

    setMessagesState("messages", updatedMessages);

    // Save the updates through saveService
    const storyId = currentStoryStore.id;
    if (
      storyId &&
      currentStoryStore.storageMode === "server" &&
      updates.length > 0
    ) {
      saveService.reorderMessages(storyId, updates);
    }

    console.log(
      "[messagesStore.attachOrphanedMessagesToNode] Attached",
      updates.length,
      "messages to node:",
      targetNodeId,
    );
  },

  appendMessage: (message: Message) => {
    console.log("[messagesStore.addMessage] Adding message:", {
      id: message.id,
      chapterId: message.chapterId,
      nodeId: message.nodeId,
      isQuery: message.isQuery,
      type: message.type,
    });
    // Use the no-save version for the actual add
    messagesStore.appendMessageNoSave(message);
    // The new message will be at the end of the array
    const order = messagesState.messages.length - 1;
    const messageWithOrder = { ...message, order };
    // Use immediate save for new messages (not during generation)
    // Don't await to avoid blocking
    triggerMessageSave(message.id, messageWithOrder, "insert", false);
  },

  // Version for WebSocket updates that doesn't trigger save
  appendMessageNoSave: (message: Message) => {
    setMessagesState("messages", (prev) => [...prev, message]);
  },

  insertMessage: (afterMessageId: string | null, message: Message) => {
    console.log("[messagesStore.insertMessage] Inserting message:", {
      id: message.id,
      afterMessageId,
      chapterId: message.chapterId,
      nodeId: message.nodeId,
      isQuery: message.isQuery,
      type: message.type,
    });

    // Calculate the correct order for the new message
    let insertOrder = 0;
    const targetNodeId = message.nodeId || message.chapterId;

    if (afterMessageId) {
      // Find the message we're inserting after
      const afterMessage = messagesState.messages.find(
        (m) => m.id === afterMessageId,
      );
      if (afterMessage) {
        console.log("[insertMessage] afterMessage found:", {
          id: afterMessage.id.substring(0, 8),
          order: afterMessage.order,
          nodeId: afterMessage.nodeId,
          targetNodeId,
        });
        insertOrder = afterMessage.order + 1;

        // Update orders for messages in the same node that come after the insertion point
        setMessagesState("messages", (messages) =>
          messages.map((msg) => {
            // Only update messages in the same node/chapter that have order >= insertOrder
            const msgNodeId = msg.nodeId || msg.chapterId;
            if (msgNodeId === targetNodeId && msg.order >= insertOrder) {
              return { ...msg, order: msg.order + 1 };
            }
            return msg;
          }),
        );
      }
    } else {
      // Inserting at the beginning of the node
      // Shift all messages in this node up by 1
      setMessagesState("messages", (messages) =>
        messages.map((msg) => {
          const msgNodeId = msg.nodeId || msg.chapterId;
          if (msgNodeId === targetNodeId) {
            return { ...msg, order: msg.order + 1 };
          }
          return msg;
        }),
      );
    }

    // Set the correct order on the message
    const messageWithOrder = { ...message, order: insertOrder };

    console.log("[insertMessage] Calculated order:", {
      messageId: message.id,
      insertOrder,
      afterMessageId,
      nodeId: targetNodeId,
    });

    // Use the no-save version for the actual insert
    messagesStore.insertMessageNoSave(afterMessageId, messageWithOrder);

    // Then trigger the save with the afterMessageId
    // The backend insert endpoint will handle shifting orders properly
    triggerMessageSave(
      message.id,
      messageWithOrder,
      "insert",
      false,
      afterMessageId,
    );
  },

  // Version for WebSocket updates that doesn't trigger save
  insertMessageNoSave: (afterMessageId: string | null, message: Message) => {
    // Inserting message without save

    try {
      setMessagesState("messages", (prev) => {
        if (afterMessageId === null) {
          // Insert at the beginning
          // Inserting at beginning
          return [message, ...prev];
        }

        const index = prev.findIndex((msg) => msg.id === afterMessageId);
        if (index === -1) {
          // Message not found for insertion
          return prev;
        }

        // Insert after the specified message
        // Inserting at specific index
        const newMessages = [...prev];
        newMessages.splice(index + 1, 0, message);
        return newMessages;
      });
    } catch (error) {
      // Error inserting message
      throw error;
    }
  },

  updateMessage: (id: string, updates: Partial<Message>) => {
    if (updates.chapterId !== undefined || updates.nodeId !== undefined) {
      console.log(
        "[messagesStore.updateMessage] Updating message chapter/node:",
        {
          messageId: id,
          chapterId: updates.chapterId,
          nodeId: updates.nodeId,
        },
      );
    }
    // Use the no-save version for the actual update
    messagesStore.updateMessageNoSave(id, updates);

    // Then trigger the save if the message was found
    const index = messagesState.messages.findIndex((msg) => msg.id === id);
    if (index !== -1) {
      const updatedMessage = messagesState.messages[index];
      const currentOrder =
        updatedMessage.order !== undefined ? updatedMessage.order : index;
      // Preserve the current order for persistence
      const messageWithOrder = { ...updatedMessage, order: currentOrder };
      // Use debounced save for updates (especially during generation)
      triggerMessageSave(id, messageWithOrder, "update", true);
    }
  },

  // Version for WebSocket updates that doesn't trigger save
  updateMessageNoSave: (id: string, updates: Partial<Message>) => {
    const index = messagesState.messages.findIndex((msg) => msg.id === id);
    if (index !== -1) {
      let mergedUpdates = updates;
      // Only auto-split content into paragraphs if paragraphs weren't explicitly provided
      if (updates.content !== undefined && updates.paragraphs === undefined) {
        const paragraphs = updates.content
          .split(/\r?\n\s*\n+/)
          .map((paragraph) => paragraph.replace(/\r/g, "").trim())
          .filter((paragraph) => paragraph.length > 0);
        mergedUpdates = {
          ...updates,
          paragraphs,
        };
      }
      // Use spread to merge updates
      setMessagesState("messages", index, (prev) => ({
        ...prev,
        ...mergedUpdates,
      }));
    } else {
      // Message not found
    }
  },

  setInput: (input: string) => {
    setMessagesState("input", input);
    // Persist input to localStorage
    localStorage.setItem("story-input", input);
  },

  setIsLoading: (loading: boolean) => setMessagesState("isLoading", loading),

  setIsSaving: (saving: boolean) => setMessagesState("isSaving", saving),

  setIsAnalyzing: (analyzing: boolean) =>
    setMessagesState("isAnalyzing", analyzing),

  setShowStorageFullModal: (show: boolean) =>
    setMessagesState("showStorageFullModal", show),

  setShowConflictDialog: (show: boolean) =>
    setMessagesState("showConflictDialog", show),

  clearInput: () => {
    setMessagesState("input", "");
    // Clear from localStorage as well
    localStorage.removeItem("story-input");
  },

  clearMessages: async () => {
    // Import currentStoryStore dynamically to avoid circular dependency
    const { currentStoryStore } = await import("./currentStoryStore");
    const storyId = currentStoryStore.id;

    setMessagesState("messages", []);
    await storage.remove(`story-messages-${storyId}`);
    await storage.remove(`story-input-${storyId}`);
    // Start a new story
    currentStoryStore.newStory();
  },

  clearQueries: () => {
    // Get all query messages
    const queryMessages = messagesState.messages.filter((msg) => msg.isQuery);

    // Delete each query message - this removes from local state and
    // triggers the DELETE API call which soft deletes on the server
    queryMessages.forEach((msg) => {
      messagesStore.deleteMessage(msg.id);
    });
  },

  deleteMessage: (messageId: string) => {
    // Get the message before deletion for the save operation
    const messageIndex = messagesState.messages.findIndex(
      (msg) => msg.id === messageId,
    );
    if (messageIndex === -1) return;

    const message = messagesState.messages[messageIndex];

    // Use the no-save version for the actual deletion
    messagesStore.deleteMessageNoSave(messageId);

    // Save the deletion
    triggerMessageSave(messageId, message, "delete", false);
  },

  // Version for WebSocket updates that doesn't trigger save
  deleteMessageNoSave: (messageId: string) => {
    const messageIndex = messagesState.messages.findIndex(
      (msg) => msg.id === messageId,
    );
    if (messageIndex === -1) return;

    // Simply remove the message
    setMessagesState("messages", (prev) =>
      prev.filter((_, index) => index !== messageIndex),
    );
  },

  // Move a message to a new position (after targetMessageId)
  moveMessage: async (
    messageId: string,
    targetMessageId: string | null,
    targetNodeId: string,
  ) => {
    console.log("[messagesStore.moveMessage] Moving message:", {
      messageId,
      targetMessageId,
      targetNodeId,
    });

    const messages = messagesState.messages;
    const messageToMove = messages.find((m) => m.id === messageId);

    if (!messageToMove) {
      console.error(
        "[messagesStore.moveMessage] Message not found:",
        messageId,
      );
      return;
    }

    const sourceNodeId = messageToMove.nodeId;
    const isMovingBetweenNodes = sourceNodeId !== targetNodeId;

    // Get messages for affected nodes
    const sourceNodeMessages = sourceNodeId
      ? messages
          .filter((m) => m.nodeId === sourceNodeId)
          .sort((a, b) => a.order - b.order)
      : [];

    let targetNodeMessages = messages
      .filter((m) => m.nodeId === targetNodeId)
      .sort((a, b) => a.order - b.order);

    // Track all messages that need order updates
    const updates: Array<{ messageId: string; nodeId: string; order: number }> =
      [];

    // Remove message from source node and reorder remaining messages
    if (isMovingBetweenNodes && sourceNodeId) {
      const remainingSourceMessages = sourceNodeMessages.filter(
        (m) => m.id !== messageId,
      );
      remainingSourceMessages.forEach((msg, index) => {
        updates.push({
          messageId: msg.id,
          nodeId: sourceNodeId,
          order: index,
        });
      });
    }

    // Find insertion point in target node
    let insertIndex = 0;
    if (targetMessageId) {
      const targetIndex = targetNodeMessages.findIndex(
        (m) => m.id === targetMessageId,
      );
      if (targetIndex !== -1) {
        insertIndex = targetIndex + 1;
      }
    }

    console.log("[messagesStore.moveMessage] Insert position:", {
      targetMessageId,
      insertIndex,
      targetNodeMessagesCount: targetNodeMessages.length,
    });

    // If moving within same node, remove from current position first
    if (!isMovingBetweenNodes) {
      targetNodeMessages = targetNodeMessages.filter((m) => m.id !== messageId);
    }

    // Insert message at new position
    targetNodeMessages.splice(insertIndex, 0, {
      ...messageToMove,
      nodeId: targetNodeId,
    });

    // Reorder target node messages
    targetNodeMessages.forEach((msg, index) => {
      updates.push({
        messageId: msg.id,
        nodeId: targetNodeId,
        order: index,
      });
    });

    console.log(
      "[messagesStore.moveMessage] Order updates for target node:",
      updates
        .filter((u) => u.nodeId === targetNodeId)
        .map((u) => ({
          id: u.messageId.substring(0, 8),
          order: u.order,
          isMovedMsg: u.messageId === messageId,
        })),
    );

    // Update local state immediately
    // Create new objects for all messages to ensure SolidJS detects the changes
    const updatedMessages = messages.map((msg) => {
      const update = updates.find((u) => u.messageId === msg.id);
      if (update) {
        return {
          ...msg,
          nodeId: update.nodeId,
          order: update.order,
        };
      }
      // Even for unchanged messages, create a new object to force re-render
      // This ensures the UI properly reflects the new ordering
      return { ...msg };
    });

    const movedMessage = updatedMessages.find((m) => m.id === messageId);
    console.log(
      "[messagesStore.moveMessage] Setting updated messages, total:",
      updatedMessages.length,
    );
    console.log("[messagesStore.moveMessage] Moved message details:", {
      id: movedMessage?.id,
      nodeId: movedMessage?.nodeId,
      chapterId: movedMessage?.chapterId,
      order: movedMessage?.order,
      content: movedMessage?.content?.substring(0, 50),
    });
    setMessagesState("messages", updatedMessages);

    // Send batch update through saveService
    const storyId = currentStoryStore.id;
    if (storyId && currentStoryStore.storageMode === "server") {
      // Queue the reorder operation through saveService
      saveService.reorderMessages(
        storyId,
        updates.map((u) => ({
          messageId: u.messageId,
          nodeId: u.nodeId,
          order: u.order,
        })),
      );
    }
  },

  clearAssistantContent: (messageId: string) => {
    const messageIndex = messagesState.messages.findIndex(
      (msg) => msg.id === messageId,
    );
    if (messageIndex === -1) return;

    const message = messagesState.messages[messageIndex];

    // Only clear if it's an assistant message and not a query
    if (message.role === "assistant" && !message.isQuery) {
      setMessagesState("messages", (msg) => msg.id === messageId, {
        content: "",
        sentenceSummary: undefined,
        summary: undefined,
        paragraphSummary: undefined,
        paragraphs: undefined,
        tokensPerSecond: undefined,
        totalTokens: undefined,
        promptTokens: undefined,
      });
    }
  },

  canRegenerate: () => {
    const lastMessage =
      messagesState.messages[messagesState.messages.length - 1];
    return (
      lastMessage &&
      lastMessage.role === "assistant" &&
      !lastMessage.isQuery &&
      lastMessage.instruction &&
      !messagesState.isLoading
    );
  },

  canRegenerateFromMessage: (messageId: string) => {
    const messageIndex = messagesState.messages.findIndex(
      (msg) => msg.id === messageId,
    );
    if (messageIndex === -1) return false;

    const message = messagesState.messages[messageIndex];

    // Must have an instruction and not be a query
    return (
      !!message.instruction && !message.isQuery && !messagesState.isLoading
    );
  },

  canRegenerateAssistantMessage: (messageId: string) => {
    const message = messagesState.messages.find((msg) => msg.id === messageId);
    if (!message) return false;

    // Must be an assistant message that's not a query, has an instruction, but no content
    return (
      !message.isQuery &&
      message.instruction &&
      (!message.content || !message.content.trim()) &&
      !messagesState.isLoading
    );
  },

  setSummarizing: (messageId: string, isSummarizing: boolean) =>
    setMessagesState("messages", (msg) => msg.id === messageId, {
      isSummarizing,
    }),

  setAnalyzing: (messageId: string, isAnalyzing: boolean) =>
    setMessagesState("messages", (msg) => msg.id === messageId, {
      isAnalyzing,
    }),

  getMessagesNeedingAnalysis: () => {
    return messagesState.messages.filter(
      (msg) =>
        msg.role === "assistant" &&
        !msg.isQuery &&
        !msg.sceneAnalysis &&
        msg.content.trim(),
    );
  },

  getMissingAnalysisCount: () => {
    const messages = messagesState.messages.filter(
      (msg) =>
        msg.role === "assistant" &&
        !msg.isQuery &&
        !msg.sceneAnalysis &&
        msg.content.trim(),
    );
    // Found messages needing analysis
    return messages.length;
  },

  migrateInstructionsToAssistantMessages: () => {
    let migrationCount = 0;

    // Migration no longer needed since we only have assistant messages
    // This function is kept for backwards compatibility but does nothing

    // Migrated instructions to assistant messages
    return migrationCount;
  },

  getNeedsMigrationCount: () => {
    let count = 0;

    // No user messages exist anymore, so nothing to count

    return count;
  },

  removeStandaloneUserMessages: () => {
    const messagesToKeep = messagesState.messages.filter((_msg) => {
      // Keep all assistant messages (since we only have assistant messages now)
      return true;
    });

    const removedCount = messagesState.messages.length - messagesToKeep.length;
    setMessagesState("messages", messagesToKeep);

    // Removed standalone user messages
    return removedCount;
  },

  getStandaloneUserMessageCount: () => {
    return 0; // No user messages exist anymore
  },

  // Replace text in a message's content, instruction, or think section
  replaceInMessage: (
    messageId: string,
    searchText: string,
    replaceText: string,
    sections: Array<"content" | "instruction" | "think">,
  ) => {
    const message = messagesState.messages.find((msg) => msg.id === messageId);
    if (!message) return false;

    const updates: Partial<Message> = {};
    let hasChanges = false;

    // Replace in each requested section
    for (const section of sections) {
      if (
        section === "content" &&
        message.content &&
        message.content.includes(searchText)
      ) {
        updates.content = message.content.replace(searchText, replaceText);
        hasChanges = true;
      }
      if (
        section === "instruction" &&
        message.instruction &&
        message.instruction.includes(searchText)
      ) {
        updates.instruction = message.instruction.replace(
          searchText,
          replaceText,
        );
        hasChanges = true;
      }
      if (
        section === "think" &&
        message.think &&
        message.think.includes(searchText)
      ) {
        updates.think = message.think.replace(searchText, replaceText);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      messagesStore.updateMessage(messageId, updates);
    }

    return hasChanges;
  },

  // Replace all occurrences of text in a message's sections
  replaceAllInMessage: (
    messageId: string,
    searchText: string,
    replaceText: string,
    sections: Array<"content" | "instruction" | "think">,
  ) => {
    const message = messagesState.messages.find((msg) => msg.id === messageId);
    if (!message) return 0;

    const updates: Partial<Message> = {};
    let replacementCount = 0;

    // Replace in each requested section
    for (const section of sections) {
      if (section === "content" && message.content) {
        const matches = (
          message.content.match(
            new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
          ) || []
        ).length;
        if (matches > 0) {
          updates.content = message.content.split(searchText).join(replaceText);
          replacementCount += matches;
        }
      }
      if (section === "instruction" && message.instruction) {
        const matches = (
          message.instruction.match(
            new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
          ) || []
        ).length;
        if (matches > 0) {
          updates.instruction = message.instruction
            .split(searchText)
            .join(replaceText);
          replacementCount += matches;
        }
      }
      if (section === "think" && message.think) {
        const matches = (
          message.think.match(
            new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
          ) || []
        ).length;
        if (matches > 0) {
          updates.think = message.think.split(searchText).join(replaceText);
          replacementCount += matches;
        }
      }
    }

    if (replacementCount > 0) {
      messagesStore.updateMessage(messageId, updates);
    }

    return replacementCount;
  },

  cleanupThinkTags: () => {
    // Helper function to clean think tags - copied from useOllama
    const extractThinkTags = (
      content: string,
    ): { cleanedContent: string; thinkContent: string | undefined } => {
      const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
      const matches = Array.from(content.matchAll(thinkRegex));

      // Extract all think content
      const thinkContent =
        matches.length > 0
          ? matches.map((match) => match[1].trim()).join("\n\n")
          : undefined;

      // Remove think tags and their content from the main content
      let cleanedContent = content.replace(thinkRegex, "").trim();

      // Clean up unwanted system tags (but keep orphaned think tags visible)
      cleanedContent = cleanedContent
        .replace(/<\/s>/g, "")
        .replace(/<\|im_end\|>/g, "")
        .replace(/<\|im_start\|>/g, "")
        // Clean up multiple consecutive newlines
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      return {
        cleanedContent,
        thinkContent,
      };
    };

    let cleanedCount = 0;

    // Process each message
    messagesState.messages.forEach((message, index) => {
      if (
        message.content &&
        message.content.includes("<think>") &&
        message.content.includes("</think>")
      ) {
        const { cleanedContent, thinkContent } = extractThinkTags(
          message.content,
        );

        if (cleanedContent !== message.content || thinkContent) {
          setMessagesState("messages", index, {
            content: cleanedContent,
            think: thinkContent || message.think,
          });
          cleanedCount++;
        }
      }
    });

    // Cleaned up corrupted think tags
    return cleanedCount;
  },

  // Get visible messages
  getVisibleMessages: () => visibleMessages(),
  // Get total story turns
  getTotalStoryTurns: () => totalStoryTurns(),
  // Get story turn numbers map
  getStoryTurnNumbers: () => storyTurnNumbers(),

  // Manual save function for UI (only for server stories)
  saveManually: async () => {
    if (currentStoryStore.storageMode !== "server") {
      // Local stories save automatically already
      return;
    }

    setMessagesState("isManualSaving", true);
    try {
      await saveFullStory();
    } finally {
      setMessagesState("isManualSaving", false);
    }
  },

  // Force save after conflict
  forceSave: async () => {
    // Import dependencies dynamically to avoid circular imports
    const { currentStoryStore } = await import("./currentStoryStore");

    // Don't save if we're already saving or loading
    if (messagesState.isSaving || messagesState.isLoading) return;

    // Don't save empty stories
    if (messagesState.messages.length === 0) return;

    setMessagesState("isSaving", true);
    setMessagesState("lastSaveError", null);
    setMessagesState("showConflictDialog", false);

    try {
      // Create consistent save payload with force flag
      const storyData = {
        ...createSavePayload(),
        force: true, // Force the save
      };

      if (currentStoryStore.storageMode === "server") {
        // Force update existing story
        const response = await apiClient.updateStory(
          currentStoryStore.id,
          storyData,
        );
        // Update the last known updatedAt timestamp
        currentStoryStore.setLastKnownUpdatedAt(response.updatedAt);
        // Story force-saved to server
      }

      currentStoryStore.updateAutoSaveTime();
    } catch (error) {
      console.error("Failed to force-save story:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setMessagesState("lastSaveError", errorMessage);
      errorStore.addError(`Force save failed: ${errorMessage}`);
    } finally {
      setMessagesState("isSaving", false);
    }
  },

  // Move all messages from one chapter before/after another chapter
  async moveChapterUp(chapterId: string) {
    const messages = [...messagesState.messages];

    // Find all messages for this chapter (including the chapter marker)
    const chapterMessages = messages.filter(
      (msg) =>
        (msg.type === "chapter" && msg.chapterId === chapterId) ||
        msg.chapterId === chapterId,
    );

    if (chapterMessages.length === 0) return;

    // Find the chapter marker for this chapter
    const chapterMarker = chapterMessages.find((msg) => msg.type === "chapter");
    if (!chapterMarker) return;

    // Find the previous chapter marker
    const chapterMarkerIndex = messages.indexOf(chapterMarker);
    let previousChapterMarkerIndex = -1;

    // Search backwards for the previous chapter marker
    for (let i = chapterMarkerIndex - 1; i >= 0; i--) {
      if (messages[i].type === "chapter") {
        previousChapterMarkerIndex = i;
        break;
      }
    }

    if (previousChapterMarkerIndex === -1) return; // Can't move up if no previous chapter

    // Remove all chapter messages from their current positions
    const remainingMessages = messages.filter(
      (msg) =>
        !(
          (msg.type === "chapter" && msg.chapterId === chapterId) ||
          msg.chapterId === chapterId
        ),
    );

    // Insert chapter messages before the previous chapter
    remainingMessages.splice(previousChapterMarkerIndex, 0, ...chapterMessages);

    // Update the messages with new order values
    const reorderedMessages = remainingMessages.map((msg, index) => ({
      ...msg,
      order: index,
    }));

    setMessagesState("messages", reorderedMessages);

    // Save the new order to the server
    const { currentStoryStore } = await import("./currentStoryStore");
    if (currentStoryStore.storageMode === "server" && currentStoryStore.id) {
      const items = reorderedMessages.map((msg) => ({
        messageId: msg.id,
        nodeId: msg.nodeId || msg.chapterId || "",
        order: msg.order, // Include the explicit order field
      }));
      saveService.reorderMessages(currentStoryStore.id, items);
    }
  },

  async moveChapterDown(chapterId: string) {
    const messages = [...messagesState.messages];

    // Find all messages for this chapter (including the chapter marker)
    const chapterMessages = messages.filter(
      (msg) =>
        (msg.type === "chapter" && msg.chapterId === chapterId) ||
        msg.chapterId === chapterId,
    );

    if (chapterMessages.length === 0) return;

    // Find the chapter marker for this chapter
    const chapterMarker = chapterMessages.find((msg) => msg.type === "chapter");
    if (!chapterMarker) return;

    // Find the next chapter marker
    const chapterMarkerIndex = messages.indexOf(chapterMarker);
    let nextChapterMarkerIndex = -1;
    let nextChapterId = null;

    // Search forwards for the next chapter marker
    for (let i = chapterMarkerIndex + 1; i < messages.length; i++) {
      if (messages[i].type === "chapter") {
        nextChapterMarkerIndex = i;
        nextChapterId = messages[i].chapterId;
        break;
      }
    }

    if (nextChapterMarkerIndex === -1) return; // Can't move down if no next chapter

    // Find all messages for the next chapter
    const nextChapterMessages = messages.filter(
      (msg) =>
        (msg.type === "chapter" && msg.chapterId === nextChapterId) ||
        msg.chapterId === nextChapterId,
    );

    // Remove all chapter messages from their current positions
    const remainingMessages = messages.filter(
      (msg) =>
        !(
          (msg.type === "chapter" && msg.chapterId === chapterId) ||
          msg.chapterId === chapterId
        ),
    );

    // Find where the next chapter ends in the remaining messages
    const lastNextChapterMessage =
      nextChapterMessages[nextChapterMessages.length - 1];
    const insertIndex = remainingMessages.indexOf(lastNextChapterMessage) + 1;

    // Insert chapter messages after the next chapter
    remainingMessages.splice(insertIndex, 0, ...chapterMessages);

    // Update the messages with new order values
    const reorderedMessages = remainingMessages.map((msg, index) => ({
      ...msg,
      order: index,
    }));

    setMessagesState("messages", reorderedMessages);

    // Save the new order to the server
    const { currentStoryStore } = await import("./currentStoryStore");
    if (currentStoryStore.storageMode === "server" && currentStoryStore.id) {
      const items = reorderedMessages.map((msg) => ({
        messageId: msg.id,
        nodeId: msg.nodeId || msg.chapterId || "",
        order: msg.order, // Include the explicit order field
      }));
      saveService.reorderMessages(currentStoryStore.id, items);
    }
  },

  // Create an event message for script execution
  createEventMessage: (
    afterMessageId: string | null,
    content: string,
    script: string,
  ) => {
    // Get the nodeId from the message we're inserting after, or use the selected node
    let targetNodeId: string | undefined;

    if (afterMessageId) {
      const afterMessage = messagesState.messages.find(
        (m) => m.id === afterMessageId,
      );
      targetNodeId = afterMessage?.nodeId;
    }

    // If we still don't have a nodeId, use the selected node
    if (!targetNodeId) {
      targetNodeId = nodeStore.selectedNodeId || undefined;
    }

    const eventMessage: Message = {
      id: generateMessageId(),
      role: "assistant",
      type: "event",
      content,
      script,
      order: 0, // Will be set properly by insertMessage
      nodeId: targetNodeId,
      timestamp: new Date(),
      isQuery: false,
    };

    // Always use insertMessage, which handles null afterMessageId correctly
    messagesStore.insertMessage(afterMessageId, eventMessage);

    return eventMessage.id;
  },

  // Create a branch message for story branching
  createBranchMessage: (
    afterMessageId: string | null,
    content: string,
    nodeId?: string,
  ) => {
    // Get the nodeId from the message we're inserting after, or use the provided/selected node
    let targetNodeId: string | undefined = nodeId;

    if (!targetNodeId && afterMessageId) {
      const afterMessage = messagesState.messages.find(
        (m) => m.id === afterMessageId,
      );
      targetNodeId = afterMessage?.nodeId;
    }

    // If we still don't have a nodeId, use the selected node
    if (!targetNodeId) {
      targetNodeId = nodeStore.selectedNodeId || undefined;
    }

    const branchMessage: Message = {
      id: generateMessageId(),
      role: "assistant",
      type: "branch",
      content,
      options: [], // Start with no options, user will add them
      order: 0, // Will be set properly by insertMessage
      nodeId: targetNodeId,
      timestamp: new Date(),
      isQuery: false,
    };

    console.log("[createBranchMessage] Creating branch:", {
      id: branchMessage.id,
      afterMessageId,
      nodeId: targetNodeId,
    });

    // Always use insertMessage, which handles null afterMessageId correctly
    messagesStore.insertMessage(afterMessageId, branchMessage);

    // Log the final order after insertion
    const inserted = messagesState.messages.find(
      (m) => m.id === branchMessage.id,
    );
    console.log(
      "[createBranchMessage] After insertion, order:",
      inserted?.order,
    );

    return branchMessage.id;
  },

  // Refresh messages from current story
  refreshMessages: async () => {
    const { currentStoryStore } = await import("./currentStoryStore");
    const storyId = currentStoryStore.id;

    if (!storyId) return;

    // For server stories, reload from server
    if (currentStoryStore.storageMode === "server") {
      const { apiClient } = await import("../utils/apiClient");
      try {
        const story = await apiClient.getStory(storyId);
        if (story) {
          messagesStore.setMessages(story.messages);
        }
      } catch (error) {
        console.error("Failed to refresh messages from server:", error);
      }
    } else {
      // For local stories, reload from storyManager
      const { storyManager } = await import("../utils/storyManager");
      const story = await storyManager.loadStory(storyId);
      if (story) {
        messagesStore.setMessages(story.messages);
      }
    }
  },
};
