import { io, Socket } from 'socket.io-client';
import { createSignal } from 'solid-js';
import { messagesStore } from '../stores/messagesStore';
import { nodeStore } from '../stores/nodeStore';
import { errorStore } from '../stores/errorStore';
import { Message } from '../types/core';

let socket: Socket | null = null;
let currentStoryId: string | null = null;
let reconnectAttempts = 0;
let hasConnectedOnce = false;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_BASE = 1000; // Start with 1 second
const RECONNECT_DELAY_MAX = 30000; // Max 30 seconds

// Signal for connection status
const [isConnected, setIsConnected] = createSignal(false);

export const websocketManager = {
    isConnected,
    
    connect(storyId: string) {
        // If already connected to this story, do nothing
        if (socket && currentStoryId === storyId && isConnected()) {
            return;
        }
        
        // Disconnect from previous story if connected
        if (socket && currentStoryId !== storyId) {
            this.disconnect();
        }
        
        currentStoryId = storyId;
        reconnectAttempts = 0;
        
        // Connecting to server
        
        // Connect to the backend WebSocket server
        socket = io('http://localhost:3001', {
            reconnection: false, // We'll handle reconnection manually
            transports: ['websocket'],
        });
        
        // Set up event handlers
        socket.on('connect', () => {
            // Connected to server
            setIsConnected(true);
            hasConnectedOnce = true;
            reconnectAttempts = 0;
            
            // Join the story room
            socket!.emit('join-story', storyId);
        });
        
        socket.on('disconnect', () => {
            // Disconnected from server
            setIsConnected(false);
            
            // Attempt reconnection
            this.attemptReconnect();
        });
        
        socket.on('connect_error', (_error: Error) => {
            // Connection error
            setIsConnected(false);
            
            // Attempt reconnection
            this.attemptReconnect();
        });
        
        // Handle story update events
        socket.on('message:updated', (data: any) => {
            // Message updated
            this.handleMessageUpdated(data);
        });
        
        socket.on('message:created', (data: any) => {
            // Message created
            this.handleMessageCreated(data);
        });
        
        socket.on('message:deleted', (data: any) => {
            // Message deleted
            this.handleMessageDeleted(data);
        });

        socket.on('node:created', (data: any) => {
            // Node created
            this.handleNodeCreated(data);
        });

        socket.on('node:updated', (data: any) => {
            // Node updated
            this.handleNodeUpdated(data);
        });

        socket.on('node:deleted', (data: any) => {
            // Node deleted
            this.handleNodeDeleted(data);
        });
        
        // Chapters are now handled through nodes
        // socket.on('chapter:updated', (data: any) => {
        //     this.handleChapterUpdated(data);
        // });
        
        socket.on('story:reloaded', (data: any) => {
            // Story reloaded
            this.handleStoryReloaded(data);
        });
    },
    
    disconnect() {
        if (socket) {
            // Leave the current story room
            if (currentStoryId) {
                socket.emit('leave-story', currentStoryId);
            }
            
            socket.disconnect();
            socket = null;
            currentStoryId = null;
            setIsConnected(false);
            // WebSocket disconnected
        }
    },
    
    attemptReconnect() {
        // If we've never connected and exceeded max attempts, stop trying
        if (!hasConnectedOnce && reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            // Max reconnection attempts reached
            errorStore.addError('Unable to connect to sync server. Changes from MCP will not be reflected in real-time.');
            return;
        }
        
        reconnectAttempts++;
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
            RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttempts - 1),
            RECONNECT_DELAY_MAX
        );
        
        // Attempting reconnect
        
        setTimeout(() => {
            if (currentStoryId && !isConnected()) {
                this.connect(currentStoryId);
            }
        }, delay);
    },
    
    handleMessageUpdated(data: { storyId: string; message: any }) {
        // Check if this is for the current story
        if (data.storyId !== currentStoryId) return;

        // Convert timestamp to Date object and ensure nodeId is set
        const message: Message = {
            ...data.message,
            timestamp: new Date(data.message.timestamp),
            // If message has chapterId but no nodeId, use chapterId as nodeId
            nodeId: data.message.nodeId || data.message.chapterId,
        };

        // Check if the message is currently being edited by the user
        const currentMessage = messagesStore.messages.find(m => m.id === message.id);
        if (currentMessage && messagesStore.isLoading) {
            // User is actively generating/editing, show alert but don't update
            errorStore.addError(`Message ${message.id} was updated from MCP but local edit takes priority`);
            return;
        }

        // Update the message in the store without triggering save
        messagesStore.updateMessageNoSave(message.id, message);
    },
    
    handleMessageCreated(data: { storyId: string; message: any; afterMessageId: string | null }) {
        // Check if this is for the current story
        if (data.storyId !== currentStoryId) return;

        // Convert timestamp to Date object and ensure nodeId is set
        const message: Message = {
            ...data.message,
            timestamp: new Date(data.message.timestamp),
            // If message has chapterId but no nodeId, use chapterId as nodeId
            nodeId: data.message.nodeId || data.message.chapterId,
        };

        // Insert the message at the correct position without triggering save
        messagesStore.insertMessageNoSave(data.afterMessageId, message);
    },
    
    handleMessageDeleted(data: { storyId: string; messageId: string }) {
        // Check if this is for the current story
        if (data.storyId !== currentStoryId) return;
        
        // Delete the message from the store without triggering save
        messagesStore.deleteMessageNoSave(data.messageId);
    },

    handleNodeCreated(data: { storyId: string; node: unknown }) {
        if (data.storyId !== currentStoryId || !data.node) return;

        nodeStore.upsertNodeFromServer(data.node as any);
    },

    handleNodeUpdated(data: { storyId: string; node: unknown }) {
        if (data.storyId !== currentStoryId || !data.node) return;

        nodeStore.upsertNodeFromServer(data.node as any);
    },

    handleNodeDeleted(data: { storyId: string; nodeId: string }) {
        if (data.storyId !== currentStoryId || !data.nodeId) return;

        nodeStore.deleteNodeNoSave(data.nodeId);
    },
    
    // Chapters are now handled through nodes
    // handleChapterUpdated(data: { storyId: string; chapter: any }) {
    //     // Check if this is for the current story
    //     if (data.storyId !== currentStoryId) return;
    //
    //     // Update the chapter in the store without triggering save
    //     const chapter = {
    //         ...data.chapter,
    //         createdAt: new Date(data.chapter.createdAt),
    //         updatedAt: new Date(data.chapter.updatedAt),
    //     };
    //
    //     chaptersStore.updateChapterNoSave(chapter.id, chapter);
    // },
    
    handleStoryReloaded(data: { storyId: string }) {
        // Check if this is for the current story
        if (data.storyId !== currentStoryId) return;
        
        // Reload the entire story
        errorStore.addError('Story has been significantly modified from MCP. Reloading...');
        messagesStore.reloadDataForStory(data.storyId);
    },
};
