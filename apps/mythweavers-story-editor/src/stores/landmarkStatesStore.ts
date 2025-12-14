import { createStore, reconcile } from "solid-js/store";
import { batch } from "solid-js";
import { LandmarkState } from "../types/core";
import { apiClient } from "../utils/apiClient";
import { saveService } from "../services/saveService";
import { getMessagesInStoryOrder } from "../utils/nodeTraversal";
import { messagesStore } from "./messagesStore";
import { nodeStore } from "./nodeStore";

interface LandmarkStatesStore {
  // All states for the current story
  states: LandmarkState[];
  // Accumulated states at current timeline position (key: "mapId:landmarkId:field")
  accumulatedStates: Record<string, LandmarkState>;
  // Loading state
  isLoading: boolean;
  // Current message ID for timeline position
  currentMessageId: string | null;
}

const [statesStore, setStatesStore] = createStore<LandmarkStatesStore>({
  states: [],
  accumulatedStates: {},
  isLoading: false,
  currentMessageId: null,
});

// Helper to build a state key
const buildStateKey = (mapId: string, landmarkId: string, field: string) =>
  `${mapId}:${landmarkId}:${field}`;

export const landmarkStatesStore = {
  // Getters
  get states() {
    return statesStore.states;
  },
  get accumulatedStates() {
    return statesStore.accumulatedStates;
  },
  get isLoading() {
    return statesStore.isLoading;
  },
  get currentMessageId() {
    return statesStore.currentMessageId;
  },

  // Efficient getter for message IDs that have landmark states
  // Returns a Set for O(1) lookup instead of requiring array scanning
  get messageIdsWithStates(): Set<string> {
    return new Set(statesStore.states.map(s => s.messageId).filter((id): id is string => id != null));
  },

  // Get the current value for a specific landmark and field
  getLandmarkState(
    mapId: string,
    landmarkId: string,
    field: string,
  ): string | null {
    const key = buildStateKey(mapId, landmarkId, field);
    return statesStore.accumulatedStates[key]?.value || null;
  },

  // Load all states for a story
  async loadStates(storyId: string) {
    if (!storyId) return;

    setStatesStore("isLoading", true);
    try {
      const states = await apiClient.getLandmarkStates(storyId);
      setStatesStore("states", states);
    } catch (error) {
      console.error("Failed to load landmark states:", error);
    } finally {
      setStatesStore("isLoading", false);
    }
  },

  // Load accumulated states for a specific message (accumulate on frontend)
  async loadAccumulatedStates(storyId: string, messageId: string) {
    if (!storyId || !messageId) return;

    setStatesStore("isLoading", true);
    try {
      // Get all messages in story order up to and including the target message
      const messagesInOrder = getMessagesInStoryOrder(
        messagesStore.messages,
        nodeStore.nodesArray,
        messageId,
      );

      // Build a set of message IDs that are at or before the target
      const messageIds = new Set(messagesInOrder.map((m) => m.id));

      // Filter states to only those at or before the target message
      const relevantStates = statesStore.states.filter((state) =>
        state.messageId && messageIds.has(state.messageId),
      );

      // Accumulate states (last value for each landmark/field wins)
      const accumulated: Record<string, LandmarkState> = {};

      for (const state of relevantStates) {
        const key = buildStateKey(state.mapId, state.landmarkId, state.field);
        accumulated[key] = state;
      }

      batch(() => {
        setStatesStore("accumulatedStates", reconcile(accumulated));
        setStatesStore("currentMessageId", messageId);
      });
    } catch (error) {
      console.error("Failed to load accumulated states:", error);
    } finally {
      setStatesStore("isLoading", false);
    }
  },

  // Set a landmark state (updates both local and server)
  async setLandmarkState(
    storyId: string,
    mapId: string,
    landmarkId: string,
    messageId: string,
    field: string,
    value: string | null,
  ) {
    if (!storyId || !messageId) return;

    // Safety: Don't delete states if we haven't loaded them yet
    // This prevents accidental mass-deletion during initialization or HMR
    if (value === null && statesStore.states.length === 0 && !statesStore.isLoading) {
      console.warn('[LandmarkStatesStore] Attempted to delete state before states were loaded. Ignoring.');
      return;
    }

    const key = buildStateKey(mapId, landmarkId, field);

    // Optimistically update local state
    if (value) {
      setStatesStore("accumulatedStates", key, {
        storyId,
        mapId,
        landmarkId,
        messageId,
        field,
        value,
      });
    } else {
      // Remove state if value is null
      setStatesStore("accumulatedStates", (prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }

    try {
      // Update on server
      saveService.saveLandmarkState(
        storyId,
        mapId,
        landmarkId,
        messageId,
        field,
        value,
      );

      // For now, we'll assume success and update the local state
      // The actual server response will come through the save queue
      const result = {
        storyId,
        mapId,
        landmarkId,
        messageId,
        field,
        value,
        deleted: !value,
      };

      // Update local states array
      if (result && result.deleted) {
        // Remove from states array
        setStatesStore("states", (prev) =>
          prev.filter(
            (s) =>
              !(
                s.mapId === mapId &&
                s.landmarkId === landmarkId &&
                s.messageId === messageId &&
                s.field === field
              ),
          ),
        );
        // Also ensure it's removed from accumulated states
        const key = buildStateKey(mapId, landmarkId, field);
        setStatesStore("accumulatedStates", (prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      } else if (result) {
        // Add or update in states array
        setStatesStore("states", (prev) => {
          const existing = prev.findIndex(
            (s) =>
              s.mapId === mapId &&
              s.landmarkId === landmarkId &&
              s.messageId === messageId &&
              s.field === field,
          );

          if (existing >= 0) {
            const next = [...prev];
            next[existing] = result;
            return next;
          } else {
            return [...prev, result];
          }
        });
      }
    } catch (error) {
      console.error("Failed to set landmark state:", error);

      // Revert optimistic update on error
      if (statesStore.currentMessageId) {
        await this.loadAccumulatedStates(storyId, statesStore.currentMessageId);
      }
    }
  },

  // Batch set multiple states
  async batchSetStates(
    storyId: string,
    states: Array<{
      mapId: string;
      landmarkId: string;
      messageId: string;
      field: string;
      value: string | null;
    }>,
  ) {
    if (!storyId || states.length === 0) return;

    try {
      const results = await apiClient.batchSetLandmarkStates(storyId, states);

      // Reload states after batch update
      await this.loadStates(storyId);

      // Reload accumulated states if we have a current message
      if (statesStore.currentMessageId) {
        await this.loadAccumulatedStates(storyId, statesStore.currentMessageId);
      }

      return results;
    } catch (error) {
      console.error("Failed to batch set landmark states:", error);
      throw error;
    }
  },

  // Clear all states
  clearStates() {
    batch(() => {
      setStatesStore("states", []);
      setStatesStore("accumulatedStates", {});
      setStatesStore("currentMessageId", null);
    });
  },
};
