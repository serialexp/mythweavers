import { useState, useRef, useEffect } from 'react';

export default function App() {
  const [memory, setMemory] = useState("# Adventure Memory\n\n*Edit this to track important details.*");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMemoryUpdate, setShowMemoryUpdate] = useState(false);
  const [suggestedMemory, setSuggestedMemory] = useState('');
  const [memoryDiff, setMemoryDiff] = useState(''); // Store the raw diff
  const [memoryDiffStats, setMemoryDiffStats] = useState({ added: 0, removed: 0 }); // Stats
  const [memoryUpdateTab, setMemoryUpdateTab] = useState('diff'); // 'diff' or 'result'
  const [messagesSinceUpdate, setMessagesSinceUpdate] = useState(0);
  const [showMemoryPanel, setShowMemoryPanel] = useState(true);
  const [toolStatus, setToolStatus] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editText, setEditText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [screen, setScreen] = useState('setup');
  const [adventurePitch, setAdventurePitch] = useState('');
  const [pitchLoading, setPitchLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [storageUsed, setStorageUsed] = useState(0);
  const [tokenCount, setTokenCount] = useState(null);
  const [compactions, setCompactions] = useState({});
  const [expandedCompactions, setExpandedCompactions] = useState({});
  const [compactingKeys, setCompactingKeys] = useState(new Set());
  const [protagonist, setProtagonist] = useState('');
  const [alwaysInstructions, setAlwaysInstructions] = useState('');
  const [memoryUpdateLoading, setMemoryUpdateLoading] = useState(false);
  const [claudeRequestInProgress, setClaudeRequestInProgress] = useState(false);
  const [claudeRequestProgress, setClaudeRequestProgress] = useState(0);
  const claudeProgressIntervalRef = useRef(null);
  const claudeProgressStopTimeoutRef = useRef(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [disablePromptCaching, setDisablePromptCaching] = useState(false); // TEMP: for debugging
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [currentStoryId, setCurrentStoryId] = useState(null);
  const [storyList, setStoryList] = useState([]);
  const [showStoryManager, setShowStoryManager] = useState(false);
  const [showStorageBrowser, setShowStorageBrowser] = useState(false);
  const [allStorageKeys, setAllStorageKeys] = useState({ local: [], cloud: [] });
  const [storageKeysLoading, setStorageKeysLoading] = useState(false);
  const [storageKeysLoaded, setStorageKeysLoaded] = useState(false);
  const [deletingKey, setDeletingKey] = useState(null);
  const [showAllLocalKeys, setShowAllLocalKeys] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const messagesEndRef = useRef(null);
  
  // Storage API queue (only allows one operation at a time)
  const storageQueueRef = useRef([]);
  const storageProcessingRef = useRef(false);
  
  // Claude API queue (only allows one request at a time to avoid rate limits)
  const claudeQueueRef = useRef([]);
  const claudeProcessingRef = useRef(false);
  
  const queueStorageOperation = async (operation) => {
    return new Promise((resolve, reject) => {
      storageQueueRef.current.push({ operation, resolve, reject });
      processStorageQueue();
    });
  };
  
  const processStorageQueue = async () => {
    if (storageProcessingRef.current || storageQueueRef.current.length === 0) {
      return;
    }
    
    storageProcessingRef.current = true;
    const { operation, resolve, reject } = storageQueueRef.current.shift();
    
    try {
      const result = await operation();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      storageProcessingRef.current = false;
      // Process next item in queue
      if (storageQueueRef.current.length > 0) {
        processStorageQueue();
      }
    }
  };
  
  const queueClaudeRequest = async (operation) => {
    return new Promise((resolve, reject) => {
      claudeQueueRef.current.push({ operation, resolve, reject });
      const queueLength = claudeQueueRef.current.length;
      if (queueLength > 1) {
        debugLog(`Claude API request queued (${queueLength} in queue)`);
      }
      processClaudeQueue();
    });
  };
  
  const processClaudeQueue = async () => {
    if (claudeProcessingRef.current || claudeQueueRef.current.length === 0) {
      return;
    }
    
    claudeProcessingRef.current = true;
    const { operation, resolve, reject } = claudeQueueRef.current.shift();
    
    // Start progress bar
    startClaudeProgress();
    
    try {
      const result = await operation();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      claudeProcessingRef.current = false;
      // Stop progress bar
      stopClaudeProgress();
      
      // Process next item in queue
      if (claudeQueueRef.current.length > 0) {
        // Small delay between requests to be nice to the API
        setTimeout(processClaudeQueue, 100);
      }
    }
  };
  
  const startClaudeProgress = () => {
    // Clear any existing interval
    if (claudeProgressIntervalRef.current) {
      clearInterval(claudeProgressIntervalRef.current);
    }
    
    // Clear any pending stop timeout from previous request
    if (claudeProgressStopTimeoutRef.current) {
      clearTimeout(claudeProgressStopTimeoutRef.current);
      claudeProgressStopTimeoutRef.current = null;
    }
    
    setClaudeRequestInProgress(true);
    setClaudeRequestProgress(0);
    
    const startTime = Date.now();
    const estimatedDuration = 20000; // 20 seconds
    
    claudeProgressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / estimatedDuration) * 100, 95); // Cap at 95% until actually done
      setClaudeRequestProgress(progress);
    }, 100); // Update every 100ms
  };
  
  const stopClaudeProgress = () => {
    if (claudeProgressIntervalRef.current) {
      clearInterval(claudeProgressIntervalRef.current);
      claudeProgressIntervalRef.current = null;
    }
    
    // Jump to 100% then fade out
    setClaudeRequestProgress(100);
    claudeProgressStopTimeoutRef.current = setTimeout(() => {
      setClaudeRequestInProgress(false);
      setClaudeRequestProgress(0);
      claudeProgressStopTimeoutRef.current = null;
    }, 500); // Show 100% briefly before hiding
  };
  
  // Queued storage operations
  const storageGet = (key) => queueStorageOperation(() => window.storage.get(key));
  const storageSet = (key, value) => queueStorageOperation(() => window.storage.set(key, value));
  const storageDelete = (key) => queueStorageOperation(() => window.storage.delete(key));
  
  // Cleanup progress interval on unmount
  useEffect(() => {
    return () => {
      if (claudeProgressIntervalRef.current) {
        clearInterval(claudeProgressIntervalRef.current);
      }
      if (claudeProgressStopTimeoutRef.current) {
        clearTimeout(claudeProgressStopTimeoutRef.current);
      }
    };
  }, []);
  
  // Capture console logs for mobile debugging
  const debugLog = (...args) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    setDebugLogs(prev => [...prev.slice(-200), { timestamp, message }]); // Keep last 200
    console.log(...args); // Still log to actual console
  };
  
  const MAX_STORAGE = 5 * 1024 * 1024;
  const VERBATIM_COUNT = 30; // Keep more messages verbatim to reduce compaction frequency

  useEffect(() => {
    const loadSaved = async () => {
      // Health check: Test if storage API is working at all
      try {
        debugLog('Testing storage API health...');
        const testResult = await window.storage.get('_health_check_nonexistent_key');
        debugLog('Storage API responded:', testResult === null ? 'null (key not found - API working)' : JSON.stringify(testResult));
      } catch (healthError) {
        debugLog('Storage API health check FAILED:', {
          message: healthError.message,
          name: healthError.name,
          constructor: healthError.constructor.name,
          string: String(healthError)
        });
      }
      
      try {
        // Load story list first to check if we've already migrated
        let listData = null;
        const localList = localStorage.getItem('cyoa-story-list');
        if (localList) {
          listData = JSON.parse(localList);
          debugLog('Loaded story list from localStorage');
        } else {
          try {
            const cloudList = await storageGet('cyoa-story-list');
            if (cloudList && cloudList.value) {
              listData = JSON.parse(cloudList.value);
              debugLog('Loaded story list from cloud');
            }
          } catch (cloudError) {
            debugLog('Cloud storage failed, using localStorage only:', cloudError.message || String(cloudError));
          }
        }
        
        // Check if we've already migrated (look for migrated- prefix in story list)
        const alreadyMigrated = listData?.stories?.some(s => s.id.startsWith('migrated-'));
        
        // First, check for and migrate old single-story format
        let migratedStory = null;
        const oldLocal = localStorage.getItem('cyoa-adventure');
        let oldCloud = null;
        
        try {
          oldCloud = await storageGet('cyoa-adventure');
        } catch (cloudError) {
          debugLog('Could not check cloud for old format:', cloudError.message || String(cloudError));
        }
        
        debugLog('Checking for old format - localStorage:', !!oldLocal, 'cloud:', !!(oldCloud && oldCloud.value), 'alreadyMigrated:', alreadyMigrated);
        
        if (!alreadyMigrated && (oldLocal || (oldCloud && oldCloud.value))) {
          debugLog('Found old format story - migrating...');
          
          try {
            // Determine which version is newer
            let oldData = null;
            if (oldLocal && oldCloud && oldCloud.value) {
              let localData, cloudData;
              try {
                localData = JSON.parse(oldLocal);
                debugLog('Local JSON parsed successfully');
              } catch (e) {
                debugLog('Failed to parse local JSON:', e.message);
                throw e;
              }
              try {
                cloudData = JSON.parse(oldCloud.value);
                debugLog('Cloud JSON parsed successfully');
              } catch (e) {
                debugLog('Failed to parse cloud JSON:', e.message);
                throw e;
              }
              const localTime = new Date(localData.savedAt || 0).getTime();
              const cloudTime = new Date(cloudData.savedAt || 0).getTime();
              oldData = localTime > cloudTime ? localData : cloudData;
              debugLog('Both versions found, using', localTime > cloudTime ? 'local' : 'cloud');
            } else {
              try {
                oldData = oldLocal ? JSON.parse(oldLocal) : JSON.parse(oldCloud.value);
                debugLog('Single version parsed successfully');
              } catch (e) {
                debugLog('Failed to parse single version JSON:', e.message);
                throw e;
              }
            }
            
            debugLog('Old data has', oldData.messages?.length || 0, 'messages');
            
            // Create migrated story entry with fixed ID (not Date.now())
            const migratedId = 'migrated-original';
            migratedStory = {
              id: migratedId,
              name: 'Adventure (Migrated)',
              lastSaved: oldData.savedAt || new Date().toISOString(),
              messageCount: oldData.messages?.length || 0
            };
            
            // Save migrated data under new key
            const storyKey = `cyoa-adventure-${migratedId}`;
            const migratedData = JSON.stringify(oldData);
            const sizeInMB = (new Blob([migratedData]).size / (1024 * 1024)).toFixed(2);
            debugLog('Story size:', sizeInMB, 'MB');
            
            // Always save to localStorage
            localStorage.setItem(storyKey, migratedData);
            debugLog('Saved to localStorage');
            
            // Try to save to cloud, but don't fail if quota exceeded
            try {
              await storageSet(storyKey, migratedData);
              debugLog('Saved to cloud storage');
            } catch (cloudError) {
              if (cloudError.message && cloudError.message.includes('quota')) {
                debugLog('Story too large for cloud storage (5MB limit), saved to localStorage only');
              } else {
                debugLog('Cloud save failed:', cloudError.message || String(cloudError));
              }
            }
            
            debugLog('Migration complete, story ID:', migratedId, 'messages:', oldData.messages?.length || 0);
          } catch (migrationError) {
            debugLog('Migration failed:', migrationError.message || String(migrationError));
            console.error('Migration error:', migrationError);
          }
        }
        
        // If we migrated a story, add it to the list
        if (migratedStory) {
          if (listData && listData.stories) {
            // Add migrated story if not already in list
            if (!listData.stories.find(s => s.id === migratedStory.id)) {
              listData.stories.unshift(migratedStory);
            }
          } else {
            listData = { stories: [migratedStory], lastOpenedStory: migratedStory.id };
          }
        }
        
        if (listData && listData.stories && listData.stories.length > 0) {
          debugLog('Setting story list:', listData.stories.length, 'stories');
          console.log('Setting story list to:', listData.stories);
          setStoryList(listData.stories);
          const lastStoryId = listData.lastOpenedStory || listData.stories[0].id;
          debugLog('Loading story:', lastStoryId);
          console.log('Setting currentStoryId to:', lastStoryId);
          setCurrentStoryId(lastStoryId);
          
          // Load that specific story
          await loadStory(lastStoryId);
          
          // Save updated list (in case migration happened)
          const updatedListData = JSON.stringify(listData);
          localStorage.setItem('cyoa-story-list', updatedListData);
          try {
            await storageSet('cyoa-story-list', updatedListData);
          } catch (cloudError) {
            debugLog('Could not save story list to cloud:', cloudError.message || String(cloudError));
          }
        } else {
          // No stories yet - create a default one
          debugLog('No stories found, creating default story');
          console.log('Creating default story');
          const newStoryId = Date.now().toString();
          const defaultStory = { id: newStoryId, name: 'Adventure', lastSaved: new Date().toISOString(), messageCount: 0 };
          console.log('Default story:', defaultStory);
          setCurrentStoryId(newStoryId);
          setStoryList([defaultStory]);
          debugLog('Created default story:', newStoryId);
          
          // Save the new story list
          const newListData = JSON.stringify({ stories: [defaultStory], lastOpenedStory: newStoryId });
          localStorage.setItem('cyoa-story-list', newListData);
          try {
            await storageSet('cyoa-story-list', newListData);
          } catch (cloudError) {
            debugLog('Could not save story list to cloud:', cloudError.message || String(cloudError));
          }
        }
      } catch (e) { 
        debugLog('Load error:', e.message || String(e)); 
        console.error('Load error details:', e);
      }
      setInitialLoading(false);
    };
    loadSaved();
  }, []);
  
  // Load storage keys on mount for the storage indicator
  useEffect(() => {
    if (storyList.length > 0 && !storageKeysLoaded && !storageKeysLoading) {
      loadAllStorageKeys();
    }
  }, [storyList.length, storageKeysLoaded, storageKeysLoading]);
  
  const loadStory = async (storyId) => {
    try {
      const storyKey = `cyoa-adventure-${storyId}`;
      
      // Load from both sources
      let localData = null;
      let cloudData = null;
      
      const localJson = localStorage.getItem(storyKey);
      if (localJson) {
        localData = JSON.parse(localJson);
        debugLog('Found localStorage version:', localData.savedAt);
      }
      
      try {
        const saved = await storageGet(storyKey);
        if (saved && saved.value) {
          try {
            cloudData = JSON.parse(saved.value);
            debugLog('Found Claude storage version:', cloudData.savedAt);
          } catch (parseError) {
            debugLog('Cloud storage data corrupt (invalid JSON):', parseError.message);
          }
        } else if (saved === null) {
          debugLog('Cloud storage key not found (null response)');
        } else if (saved && !saved.value) {
          debugLog('Cloud storage returned object but no value:', saved);
        }
      } catch (cloudError) {
        // Log the full error for debugging - Error objects don't serialize well
        debugLog('Cloud storage error details:', {
          message: cloudError.message,
          name: cloudError.name,
          stack: cloudError.stack?.split('\n')[0], // First line of stack
          type: typeof cloudError,
          keys: Object.keys(cloudError),
          stringified: String(cloudError)
        });
      }
      
      // Use whichever is newer
      let data = null;
      if (localData && cloudData) {
        const localTime = new Date(localData.savedAt || 0).getTime();
        const cloudTime = new Date(cloudData.savedAt || 0).getTime();
        if (localTime > cloudTime) {
          data = localData;
          debugLog('Using localStorage (newer)');
        } else {
          data = cloudData;
          debugLog('Using Claude storage (newer)');
        }
      } else {
        data = localData || cloudData;
        debugLog('Using only available version');
      }
      
      if (data) {
        setStorageUsed(new Blob([JSON.stringify(data)]).size);
        setMessages(data.messages || []);
        setMemory(data.memory || "# Adventure Memory\n\n*Edit this to track important details.*");
        setCompactions(data.compactions || {});
        setProtagonist(data.protagonist || '');
        setAlwaysInstructions(data.alwaysInstructions || '');
        setAdventurePitch(data.pitch || '');
        setMessagesSinceUpdate(data.messagesSinceUpdate || 0);
        if (data.messages?.length > 0) {
          setScreen('adventure');
          debugLog('Loaded story with', data.messages.length, 'messages');
        } else {
          setScreen('setup');
          debugLog('Loaded empty story, staying on setup screen');
        }
        setSaveStatus('Loaded');
        setTimeout(() => setSaveStatus(''), 2000);
      } else {
        debugLog('No data found for story', storyId);
        setSaveStatus('Story not found - data file missing!');
        setTimeout(() => setSaveStatus(''), 4000);
        // Reset to empty state
        setMessages([]);
        setMemory("# Adventure Memory\n\n*Edit this to track important details.*");
        setCompactions({});
        setProtagonist('');
        setAlwaysInstructions('');
        setAdventurePitch('');
        setMessagesSinceUpdate(0);
        setScreen('setup');
      }
    } catch (e) { debugLog('Story load error:', e); }
  };

  useEffect(() => {
    if (messages.length === 0 || !currentStoryId) return;
    
    // Debounce saves to avoid excessive writes
    const timeoutId = setTimeout(async () => {
      const saveTimestamp = new Date().toISOString();
      const storyKey = `cyoa-adventure-${currentStoryId}`;
      const saveData = JSON.stringify({ 
        messages, 
        memory, 
        compactions, 
        protagonist, 
        alwaysInstructions, 
        pitch: adventurePitch, 
        messagesSinceUpdate, 
        savedAt: saveTimestamp
      });
      
      // Track what succeeded
      let localSaved = false;
      let cloudSaved = false;
      
      try {
        // Check if cloud version is newer before saving
        try {
          const cloudSaved = await storageGet(storyKey);
          if (cloudSaved && cloudSaved.value) {
            const cloudData = JSON.parse(cloudSaved.value);
            const cloudTime = new Date(cloudData.savedAt || 0).getTime();
            const ourTime = new Date(saveTimestamp).getTime();
            
            if (cloudTime > ourTime + 1000) { // Cloud is >1s newer
              debugLog('Skipping save - cloud version is newer');
              setSaveStatus('Cloud version newer!');
              setTimeout(() => setSaveStatus(''), 2000);
              return;
            }
          }
        } catch (e) {
          debugLog('Cloud check failed, saving anyway:', e.message || String(e));
        }
        
        setStorageUsed(new Blob([saveData]).size);
        
        // Try localStorage first (most important)
        try {
          localStorage.setItem(storyKey, saveData);
          localSaved = true;
          debugLog('Saved to localStorage');
        } catch (localError) {
          const errorMsg = localError.message || String(localError);
          debugLog('localStorage save failed:', errorMsg);
          
          // Special handling for quota errors
          if (errorMsg.toLowerCase().includes('quota')) {
            setSaveStatus('Storage full! Open Storage Browser to free space');
          } else {
            setSaveStatus('Save failed: ' + errorMsg);
          }
          setTimeout(() => setSaveStatus(''), 5000);
          return; // If localStorage fails, don't continue
        }
        
        // Try cloud storage (nice to have, but not critical)
        try {
          await storageSet(storyKey, saveData);
          cloudSaved = true;
          debugLog('Saved to cloud storage');
        } catch (cloudError) {
          const errorMsg = cloudError.message || String(cloudError);
          debugLog('Cloud save failed (localStorage ok):', errorMsg);
          // Don't show status for cloud failures - localStorage is what matters
        }
        
        // Update story list (use functional update to avoid dependency)
        setStoryList(currentList => {
          const updatedList = currentList.map(s => 
            s.id === currentStoryId 
              ? { ...s, lastSaved: saveTimestamp, messageCount: messages.length }
              : s
          );
          
          const listData = JSON.stringify({ stories: updatedList, lastOpenedStory: currentStoryId });
          localStorage.setItem('cyoa-story-list', listData);
          
          // Try to save list to cloud
          if (cloudSaved) {
            storageSet('cyoa-story-list', listData).catch(cloudError => {
              debugLog('Failed to save story list to cloud:', cloudError.message || String(cloudError));
            });
          }
          
          return updatedList;
        });
        
        setSaveStatus('Saved');
        setTimeout(() => setSaveStatus(''), 1500);
      } catch (e) { 
        debugLog('Unexpected save error:', e.message || String(e), e);
        setSaveStatus('Save error: ' + (e.message || 'Unknown error'));
        setTimeout(() => setSaveStatus(''), 3000);
      }
    }, 500); // 500ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [messages, memory, compactions, protagonist, alwaysInstructions, adventurePitch, messagesSinceUpdate, currentStoryId]);

  // Estimate total tokens that would be sent
  useEffect(() => {
    if (messages.length === 0) { setTokenCount(null); return; }
    
    // Build what we'd actually send and estimate tokens
    let totalChars = memory.length;
    const ranges = getCompactionRanges();
    const recentStart = Math.max(0, messages.length - VERBATIM_COUNT);
    
    for (const range of ranges) {
      const comp = compactions[range.key];
      if (comp?.summary) {
        totalChars += comp.summary.length + 50; // summary + wrapper text
      } else {
        for (const m of messages.slice(range.start, range.end + 1)) {
          totalChars += m.content.length;
        }
      }
    }
    
    for (const m of messages.slice(recentStart)) {
      totalChars += m.content.length;
    }
    
    setTokenCount(Math.ceil(totalChars / 4)); // ~4 chars per token (calibrated from actual usage)
  }, [messages, memory, compactions]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);
  
  // Custom confirm dialog (browser confirm/alert don't work in artifacts)
  const showConfirmDialog = (message, onConfirm) => {
    return new Promise((resolve) => {
      setConfirmMessage(message);
      setConfirmAction(() => () => {
        onConfirm();
        resolve(true);
      });
      setShowConfirm(true);
    });
  };
  
  const handleConfirmYes = () => {
    if (confirmAction) confirmAction();
    setShowConfirm(false);
    setConfirmAction(null);
  };
  
  const handleConfirmNo = () => {
    setShowConfirm(false);
    setConfirmAction(null);
  };
  
  // Debug: Log stories that aren't found in storage
  useEffect(() => {
    if (storageKeysLoaded && storyList.length > 0) {
      storyList.forEach(story => {
        const location = getStoryStorageLocation(story.id);
        if (location === 'unknown') {
          const storyKey = `cyoa-adventure-${story.id}`;
          debugLog(`⚠️ Story "${story.name}" (${story.id}) not found in storage. Expected key: ${storyKey}`);
          debugLog(`  Local keys:`, allStorageKeys.local.map(k => k.key).join(', '));
          debugLog(`  Cloud keys:`, allStorageKeys.cloud.map(k => k.key).join(', '));
        }
      });
    }
  }, [storageKeysLoaded, storyList, allStorageKeys]);

  const formatMessageText = (text) => {
    if (!text || typeof text !== 'string') return <p style={{ margin: '0 0 12px 0' }}>{text || ''}</p>;
    
    // Split into paragraphs on double linebreaks
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    
    if (paragraphs.length === 0) return <p style={{ margin: '0 0 12px 0' }}>{text}</p>;
    
    return paragraphs.map((para, paraIdx) => {
      try {
        const parts = [];
        let remaining = para;
        let partIdx = 0;
        
        // Process bold first (**text**)
        while (remaining.includes('**')) {
          const start = remaining.indexOf('**');
          if (start === -1) break;
          
          const end = remaining.indexOf('**', start + 2);
          if (end === -1) break; // No closing **, treat as plain text
          
          // Add text before bold
          if (start > 0) {
            parts.push(remaining.substring(0, start));
          }
          
          // Add bold text
          const boldText = remaining.substring(start + 2, end);
          parts.push(<strong key={`b-${paraIdx}-${partIdx++}`}>{boldText}</strong>);
          
          remaining = remaining.substring(end + 2);
        }
        
        // Add any remaining text
        if (remaining) {
          parts.push(remaining);
        }
        
        // Now process italics in the parts array
        const finalParts = [];
        parts.forEach((part, idx) => {
          if (typeof part === 'string' && part.includes('*')) {
            let str = part;
            let strPartIdx = 0;
            while (str.includes('*')) {
              const start = str.indexOf('*');
              if (start === -1) break;
              
              const end = str.indexOf('*', start + 1);
              if (end === -1) break; // No closing *, treat as plain text
              
              // Add text before italic
              if (start > 0) {
                finalParts.push(str.substring(0, start));
              }
              
              // Add italic text
              const italicText = str.substring(start + 1, end);
              finalParts.push(<em key={`i-${paraIdx}-${idx}-${strPartIdx++}`}>{italicText}</em>);
              
              str = str.substring(end + 1);
            }
            if (str) finalParts.push(str);
          } else {
            finalParts.push(part);
          }
        });
        
        // Convert single newlines to <br /> tags for whitespace preservation
        const partsWithBreaks = [];
        finalParts.forEach((part, idx) => {
          if (typeof part === 'string' && part.includes('\n')) {
            const lines = part.split('\n');
            lines.forEach((line, lineIdx) => {
              if (lineIdx > 0) {
                partsWithBreaks.push(<br key={`br-${paraIdx}-${idx}-${lineIdx}`} />);
              }
              if (line) partsWithBreaks.push(line);
            });
          } else {
            partsWithBreaks.push(part);
          }
        });
        
        return <p key={paraIdx} style={{ margin: '0 0 12px 0' }}>{partsWithBreaks.length > 0 ? partsWithBreaks : para}</p>;
      } catch (e) {
        debugLog('Formatting error:', e);
        return <p key={paraIdx} style={{ margin: '0 0 12px 0' }}>{para}</p>;
      }
    });
  };

  const formatBytes = (b) => b < 1024 ? `${b} B` : b < 1024*1024 ? `${(b/1024).toFixed(1)} KB` : `${(b/(1024*1024)).toFixed(2)} MB`;
  const formatTokens = (t) => typeof t === 'string' ? t : t >= 1e6 ? `${(t/1e6).toFixed(1)}M` : t >= 1e3 ? `${(t/1e3).toFixed(1)}K` : t;
  
  // Calculate total storage from loaded keys (more accurate than storageUsed)
  const totalStorageUsed = storageKeysLoaded 
    ? allStorageKeys.local.reduce((sum, k) => sum + k.size, 0)
    : storageUsed;
  const storagePercent = (totalStorageUsed / MAX_STORAGE) * 100;

  const getCompactionRanges = () => {
    const ranges = [];
    const compactableCount = Math.max(0, messages.length - VERBATIM_COUNT);
    for (let i = 0; i < compactableCount; i += 20) {
      const end = Math.min(i + 19, compactableCount - 1);
      // Only create a range if we have at least 20 messages (end - i >= 19 means 20 messages)
      if (end - i >= 19) ranges.push({ start: i, end, key: `${i}-${end}` });
    }
    return ranges;
  };

  // Rough token estimate: ~4 chars per token (calibrated from actual usage: 750k chars ≈ 191k tokens)
  const estimateTokens = (text) => Math.ceil(text.length / 4);

  // Build messages to send to Claude: compacted summaries + recent verbatim
  // Add cache breakpoints using content block format
  const buildApiMessages = (msgs) => {
    const apiMessages = [];
    const ranges = getCompactionRanges();
    const recentStart = Math.max(0, msgs.length - VERBATIM_COUNT);
    
    // Find last compacted section (that has a summary)
    const compactedRanges = ranges.filter(r => compactions[r.key]?.summary);
    const lastCompactedIdx = compactedRanges.length - 1;
    
    // Add compacted summaries or original messages for older content
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i];
      const comp = compactions[range.key];
      if (comp?.summary) {
        // Use the compacted summary
        const compactedIdx = compactedRanges.findIndex(r => r.key === range.key);
        const isLastCompacted = compactedIdx === lastCompactedIdx;
        
        // Test cache_control on content block for last compacted section
        apiMessages.push({ 
          role: 'user', 
          content: (isLastCompacted && !disablePromptCaching) ? [
            { type: 'text', text: `[Previous events summary]: ${comp.summary}`, cache_control: { type: 'ephemeral' } }
          ] : `[Previous events summary]: ${comp.summary}`
        });
        apiMessages.push({ role: 'assistant', content: '[Acknowledged - continuing story]' });
      } else {
        // Not compacted yet - include original messages
        for (const m of msgs.slice(range.start, range.end + 1)) {
          apiMessages.push({ role: m.role, content: m.content });
        }
      }
    }
    
    // Add recent verbatim messages with cache breakpoints on last 3
    const recentMessages = msgs.slice(recentStart);
    for (let i = 0; i < recentMessages.length; i++) {
      const m = recentMessages[i];
      const positionFromEnd = recentMessages.length - 1 - i;
      
      // Add cache breakpoints on the last 3 messages (before the absolute newest)
      if (positionFromEnd >= 1 && positionFromEnd <= 3 && !disablePromptCaching) {
        apiMessages.push({ 
          role: m.role, 
          content: [{ type: 'text', text: m.content, cache_control: { type: 'ephemeral' } }]
        });
      } else {
        apiMessages.push({ role: m.role, content: m.content });
      }
    }
    
    return apiMessages;
  };

  const generateCompaction = async (key) => {
    const [start, end] = key.split('-').map(Number);
    const rangeMessages = messages.slice(start, end + 1);
    setCompactingKeys(prev => new Set([...prev, key]));
    try {
      const protagonistInstruction = protagonist 
        ? `The protagonist is named "${protagonist}". Use this name when referring to the player character (not "you" or "the player").`
        : 'Refer to the player character as "the protagonist" or use context clues for their name.';
      
      const customInstructions = alwaysInstructions ? `\nADDITIONAL CONTEXT:\n${alwaysInstructions}\n` : '';
      
      const system = `${customInstructions}You are summarizing a section of a choose-your-own-adventure story. Your task is to create a comprehensive summary that captures ALL events from the ENTIRE section, from beginning to end.

${protagonistInstruction}

CRITICAL FORMATTING RULES:
- DO NOT include ANY headers, titles, or labels (no "# Summary", "Story Summary:", etc.)
- DO NOT use markdown headers (#, ##, ###) anywhere in your response
- START IMMEDIATELY with the first sentence of the narrative
- Write ONLY plain paragraph text - no headers, no labels, no meta-text
- Your first word should be part of the story narrative itself

CONTENT RULES:
- Write in PRESENT TENSE (e.g., "Elena walks" not "Elena walked")
- Give equal attention to events at the start, middle, and end of the section
- Do not focus disproportionately on recent events

Include:
- All key plot events and story beats in chronological order
- Important decisions the protagonist made
- New characters introduced (with names)
- Locations visited
- Any items gained, lost, or used
- Significant dialogue or revelations
- Changes in the situation or stakes

Write 2-4 paragraphs as a flowing narrative summary in present tense. Be thorough - this summary will replace the original messages. Remember: NO HEADERS OR TITLES - start directly with the story narrative.`;
      
      const originalContent = rangeMessages.map((m, i) => `[${i + 1}/${rangeMessages.length}] ${m.role === 'user' ? 'PLAYER' : 'NARRATOR'}: ${m.content}`).join('\n\n---\n\n');
      
      const tokensBefore = estimateTokens(originalContent);
      
      const response = await callClaude([{ role: 'user', content: `Summarize ALL events in this story section (${rangeMessages.length} messages):\n\n${originalContent}` }], system, null);
      
      // Strip any headers that slipped through (defensive)
      let cleanedResponse = response;
      // Remove markdown headers at start
      cleanedResponse = cleanedResponse.replace(/^#+\s+[^\n]+\n+/gm, '');
      // Remove "Summary:" or "Story Summary:" style labels at start
      cleanedResponse = cleanedResponse.replace(/^(Story\s+)?Summary\s*:\s*/i, '');
      cleanedResponse = cleanedResponse.replace(/^(Story\s+)?Section\s+Summary\s*:\s*/i, '');
      // Trim whitespace
      cleanedResponse = cleanedResponse.trim();
      
      if (cleanedResponse !== response) {
        debugLog('Stripped unwanted headers from summary');
      }
      
      const tokensAfter = estimateTokens(cleanedResponse);
      
      setCompactions(prev => ({ ...prev, [key]: { 
        summary: cleanedResponse, 
        generatedAt: new Date().toISOString(),
        tokensBefore,
        tokensAfter
      } }));
    } catch (e) { debugLog('Compaction failed:', e); }
    setCompactingKeys(prev => { const next = new Set(prev); next.delete(key); return next; });
  };

  const toggleCompactionExpand = (key) => setExpandedCompactions(prev => ({ ...prev, [key]: !prev[key] }));

  const compactionRanges = getCompactionRanges();
  const uncompactedCount = compactionRanges.filter(r => !compactions[r.key]).length;
  
  // Calculate total token savings
  const totalTokensBefore = compactionRanges.reduce((sum, r) => sum + (compactions[r.key]?.tokensBefore || 0), 0);
  const totalTokensAfter = compactionRanges.reduce((sum, r) => sum + (compactions[r.key]?.tokensAfter || 0), 0);
  const totalSaved = totalTokensBefore - totalTokensAfter;

  const compactAll = async () => {
    const toCompact = compactionRanges.filter(r => !compactions[r.key]);
    // Start all compactions in parallel
    await Promise.all(toCompact.map(range => generateCompaction(range.key)));
  };
  
  // Check where a story is stored
  const getStoryStorageLocation = (storyId) => {
    const storyKey = `cyoa-adventure-${storyId}`;
    const inLocal = allStorageKeys.local.some(k => k.key === storyKey);
    const inCloud = allStorageKeys.cloud.some(k => k.key === storyKey);
    
    if (inLocal && inCloud) return 'both';
    if (inLocal) return 'local';
    if (inCloud) return 'cloud';
    return 'unknown';
  };

  const getRandomName = async (gender, count = 1) => {
    try {
      const genderParam = gender && gender !== 'neutral' ? `&gender=${gender}` : '';
      const res = await fetch(`https://randomuser.me/api/?nat=us,gb,fr,de,es,au,br,ca,mx,nz&inc=name&results=${count}${genderParam}`);
      const data = await res.json();
      const names = data.results.map(r => `${r.name.first} ${r.name.last}`);
      return count === 1 ? names[0] : names.join(', ');
    } catch (e) { return count === 1 ? 'Alex Chen' : 'Alex Chen, Jordan Santos'; }
  };

  const tools = [{ name: 'random_name', description: 'Generate random character name(s).', input_schema: { type: 'object', properties: { gender: { type: 'string', enum: ['male', 'female', 'neutral'] }, count: { type: 'integer', minimum: 1, maximum: 10 } } } }];

  const callClaudeInternal = async (msgs, system, onToolCall, retryCount = 0, maxTokens = 1000, thinkingBudget = null) => {
    const MAX_RETRIES = 2;
    let messages = [...msgs];
    
    while (true) {
      let requestBody = null;
      let requestBodyString = null;
      let responseText = null;
      
      try {
        // Build request
        requestBody = { 
          model: 'claude-sonnet-4-20250514', 
          max_tokens: maxTokens, 
          system,
          messages, 
          tools 
        };
        
        // Add thinking if budget provided
        if (thinkingBudget) {
          requestBody.thinking = {
            type: 'enabled',
            budget_tokens: thinkingBudget
          };
        }
        
        // Calculate request stats
        const messageCount = messages.length;
        const messagesWithCache = messages.filter(m => 
          Array.isArray(m.content) && m.content.some(c => c.cache_control)
        ).length;
        const systemLength = system?.length || 0;
        
        debugLog('Request stats:', {
          messageCount,
          messagesWithCache,
          systemLength,
          lastMessageRole: messages[messages.length - 1]?.role,
          lastMessageLength: messages[messages.length - 1]?.content?.length || 
            JSON.stringify(messages[messages.length - 1]?.content).length
        });
        
        // Log first and last few messages structure
        debugLog('Message structure:', {
          first3: messages.slice(0, 3).map(m => ({
            role: m.role,
            contentType: typeof m.content,
            isArray: Array.isArray(m.content),
            hasCache: Array.isArray(m.content) && m.content.some(c => c.cache_control)
          })),
          last3: messages.slice(-3).map(m => ({
            role: m.role,
            contentType: typeof m.content,
            isArray: Array.isArray(m.content),
            hasCache: Array.isArray(m.content) && m.content.some(c => c.cache_control)
          }))
        });
        
        // Serialize request
        try {
          requestBodyString = JSON.stringify(requestBody);
        } catch (stringifyError) {
          throw Object.assign(
            new Error(`Failed to serialize request: ${stringifyError.message}`),
            { 
              apiDetails: {
                message: `Request serialization failed: ${stringifyError.message}`,
                fullError: JSON.stringify({ error: stringifyError.message, requestBody }, null, 2),
                timestamp: new Date().toISOString()
              }
            }
          );
        }
        
        // Make request with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout
        const requestStartTime = Date.now();
        
        let res;
        try {
          res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST', 
            headers: { 
              'Content-Type': 'application/json',
              'Accept-Encoding': 'gzip, deflate'  // Disable Brotli - it's failing intermittently
            },
            body: requestBodyString,
            signal: controller.signal
          });
          const requestDuration = Date.now() - requestStartTime;
          const contentEncoding = res.headers.get('content-encoding');
          debugLog(`Request completed in ${requestDuration}ms, encoding: ${contentEncoding || 'none'}`);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          const requestDuration = Date.now() - requestStartTime;
          if (fetchError.name === 'AbortError') {
            throw Object.assign(
              new Error(`Request timed out after ${requestDuration}ms`),
              {
                apiDetails: {
                  message: `Request timed out after ${requestDuration}ms - your conversation may be too large`,
                  fullError: JSON.stringify({ error: 'Timeout', durationMs: requestDuration }, null, 2),
                  requestMessages: JSON.stringify(messages, null, 2),
                  timestamp: new Date().toISOString()
                }
              }
            );
          }
          throw fetchError;
        }
        clearTimeout(timeoutId);
        
        // Get response as text
        let responseText = '';
        let readError = null;
        
        try {
          debugLog('Response received:', {
            status: res.status,
            statusText: res.statusText,
            headers: Object.fromEntries(res.headers.entries()),
            bodyUsed: res.bodyUsed,
            hasBody: res.body !== null
          });
          
          // Read the stream directly with detailed logging
          if (!res.body) {
            readError = 'Response has no body stream';
          } else {
            const reader = res.body.getReader();
            const chunks = [];
            let totalBytes = 0;
            
            debugLog('Starting to read stream...');
            
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                debugLog('Stream complete. Total bytes:', totalBytes);
                break;
              }
              
              if (value) {
                chunks.push(value);
                totalBytes += value.length;
                
                // Log first chunk in detail to see if it starts properly
                if (chunks.length === 1) {
                  const preview = new TextDecoder('utf-8').decode(value.slice(0, 100));
                  debugLog('FIRST chunk:', value.length, 'bytes. Starts with:', preview);
                } else {
                  debugLog('Received chunk #' + chunks.length + ':', value.length, 'bytes. Total so far:', totalBytes);
                }
              }
            }
            
            debugLog('Received', chunks.length, 'chunks totaling', totalBytes, 'bytes');
            
            if (totalBytes === 0) {
              const requestDuration = Date.now() - requestStartTime;
              debugLog(`⚠️ Empty stream after ${requestDuration}ms processing time`);
              // Retry immediately
              if (retryCount < MAX_RETRIES) {
                debugLog(`Empty stream, retrying (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
                if (onToolCall) onToolCall(`⚠️ Empty response, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return callClaudeInternal(msgs, system, onToolCall, retryCount + 1, maxTokens);
              }
              throw new Error(`Stream completed with 0 bytes after all retries (request took ${requestDuration}ms)`);
            }
            
            // Combine chunks and decode
            const allBytes = new Uint8Array(totalBytes);
            let position = 0;
            for (const chunk of chunks) {
              allBytes.set(chunk, position);
              position += chunk.length;
            }
            
            // Decode as UTF-8
            const decoder = new TextDecoder('utf-8');
            responseText = decoder.decode(allBytes);
            
            debugLog('Decoded text length:', responseText.length, 'Preview:', responseText.substring(0, 100));
          }
        } catch (textError) {
          debugLog('Failed to read response:', textError);
          readError = textError.message;
        }
        
        // Handle read errors with retry logic
        if (readError) {
          if (retryCount < MAX_RETRIES) {
            debugLog(`Read error: ${readError}, retrying (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
            if (onToolCall) onToolCall(`⚠️ Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return callClaudeInternal(msgs, system, onToolCall, retryCount + 1);
          }
          
          // Out of retries - throw detailed error
          throw Object.assign(
            new Error(`Failed after ${MAX_RETRIES + 1} attempts: ${readError}`),
            {
              apiDetails: {
                message: `Response read failed after ${MAX_RETRIES + 1} attempts: ${readError}`,
                fullError: JSON.stringify({ 
                  error: readError,
                  httpStatus: res.status,
                  retriesAttempted: retryCount,
                  headers: Object.fromEntries(res.headers.entries())
                }, null, 2),
                timestamp: new Date().toISOString()
              }
            }
          );
        }
        
        // Handle HTTP errors
        if (!res.ok) {
          let errorObj;
          try {
            errorObj = JSON.parse(responseText);
          } catch (e) {
            errorObj = { raw: responseText };
          }
          
          throw Object.assign(
            new Error(`API HTTP ${res.status}: ${errorObj.error?.message || res.statusText}`),
            {
              apiDetails: {
                message: `HTTP ${res.status}: ${errorObj.error?.message || res.statusText}`,
                fullError: JSON.stringify(errorObj, null, 2),
                responseText: responseText,
                responseLength: responseText.length,
                requestMessages: JSON.stringify(messages, null, 2),
                requestSystem: system,
                httpStatus: res.status,
                timestamp: new Date().toISOString()
              }
            }
          );
        }
        
        // Check if response looks truncated (starts mid-JSON)
        if (responseText.length > 0 && !responseText.startsWith('{')) {
          debugLog('Response appears truncated - missing start of JSON:', {
            firstChars: responseText.substring(0, 50),
            length: responseText.length
          });
          
          // Retry if we haven't exhausted retries
          if (retryCount < MAX_RETRIES) {
            debugLog(`Truncated response, retrying (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
            if (onToolCall) onToolCall(`⚠️ Partial response, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return callClaudeInternal(msgs, system, onToolCall, retryCount + 1);
          }
        }
        
        // Parse response
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          throw Object.assign(
            new Error(`Failed to parse response: ${parseError.message}`),
            {
              apiDetails: {
                message: `JSON parse failed: ${parseError.message}`,
                fullError: JSON.stringify({ 
                  parseError: parseError.message,
                  responseLength: responseText.length,
                  responsePreview: responseText.substring(0, 500)
                }, null, 2),
                responseText: responseText,
                requestMessages: JSON.stringify(messages, null, 2),
                timestamp: new Date().toISOString()
              }
            }
          );
        }
        
        // Handle tool use
        const toolUse = data.content?.find(b => b.type === 'tool_use');
        if (toolUse?.name === 'random_name') {
          const count = toolUse.input?.count || 1;
          if (onToolCall) onToolCall(`🎲 Generating ${count > 1 ? count + ' names' : 'name'}...`);
          const names = await getRandomName(toolUse.input?.gender, count);
          if (onToolCall) onToolCall(`🎲 Generated: ${names}`);
          messages = [...messages, { role: 'assistant', content: data.content }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: names }] }];
          continue; // Loop to handle tool response
        }
        
        // Return successful response
        return data.content?.map(b => b.text || '').filter(Boolean).join('\n') || 'No response';
        
      } catch (error) {
        // Log to console
        debugLog('callClaude error:', error);
        debugLog('Error details:', {
          message: error.message,
          stack: error.stack,
          apiDetails: error.apiDetails
        });
        
        // Set error details for UI
        setErrorDetails(error.apiDetails || {
          message: error.message || 'Unknown error',
          stack: error.stack || 'No stack trace',
          fullError: JSON.stringify({ 
            name: error.name,
            message: error.message
          }, null, 2),
          timestamp: new Date().toISOString()
        });
        
        // Re-throw
        throw error;
      }
    }
  };
  
  // Wrapper that queues all Claude API calls
  const callClaude = async (msgs, system, onToolCall, retryCount = 0, maxTokens = 1000, thinkingBudget = null) => {
    return queueClaudeRequest(() => callClaudeInternal(msgs, system, onToolCall, retryCount, maxTokens, thinkingBudget));
  };

  const genres = ['Fantasy', 'Sci-Fi', 'Horror', 'Mystery', 'Post-Apocalyptic', 'Noir', 'Steampunk', 'Supernatural', 'Thriller', 'Western'];

  const generatePitch = async () => {
    setErrorDetails(null); // Clear any previous errors
    setPitchLoading(true);
    const genre = genres[Math.floor(Math.random() * genres.length)];
    const customInstructions = alwaysInstructions ? `${alwaysInstructions}\n\n` : '';
    try {
      setToolStatus('');
      const response = await callClaude([{ role: 'user', content: `Generate a ${genre} adventure pitch.` }], `${customInstructions}Generate pitch:\n\n**Genre:** [genre]\n**Character:** [One sentence]\n\nUse random_name tool.`, setToolStatus);
      setToolStatus('');
      setAdventurePitch(response);
    } catch (e) { setAdventurePitch(`Error: ${e.message}`); }
    setPitchLoading(false);
  };

  const startFromPitch = async () => {
    setErrorDetails(null); // Clear any previous errors
    setLoading(true); setScreen('adventure'); setMessages([]); setMessagesSinceUpdate(0);
    const customInstructions = alwaysInstructions ? `${alwaysInstructions}\n\n` : '';
    try {
      setToolStatus('');
      const protagonistName = protagonist || 'the protagonist';
      let response = await callClaude([
        { role: 'user', content: 'Begin this adventure.' },
        { role: 'assistant', content: 'I will start the adventure and end by asking what the protagonist does.' },
        { role: 'user', content: `REMINDER: End your response by asking "What does ${protagonistName} do?" - NOT what NPCs do. DO NOT add dramatic setup sentences before the question.` }
      ], `${customInstructions}You are narrating a choose-your-own-adventure story. The user controls ${protagonistName}. Start the adventure based on this premise:

${adventurePitch}

Introduce the situation and setting. Write naturally - use as many or as few paragraphs as needed. Use random_name tool for new characters.

FORBIDDEN - Do NOT end with:
❌ "The [time] is [adjective]. The [place] is [adjective]."
❌ "Somewhere [direction], [threat] [verb]."
❌ Dramatic fragment sentences before the question
❌ Poetic mood-setting before the question

CORRECT: [End narrative] → [blank line] → What does ${protagonistName} do?

CRITICAL: You MUST end with this exact question format: "What does ${protagonistName} do?"

Do NOT ask what NPCs do. Do NOT ask what happens. ONLY ask what ${protagonistName} does.`, setToolStatus, 0, 3000, 1500);
      
      // Post-process: Fix if Claude asks about NPCs instead of protagonist
      const lines = response.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      
      // Fix wrong question target
      if (lastLine && !lastLine.includes(protagonistName) && (
        lastLine.match(/What does .+ (do|say|respond|react)/i) ||
        lastLine.match(/What happens/i) ||
        lastLine.match(/How does .+ respond/i)
      )) {
        debugLog('Correcting narrator question to focus on protagonist');
        response = response.trim() + `\n\nWhat does ${protagonistName} do?`;
      }
      
      // Strip dramatic flourishes before the question
      if (lines.length >= 3) {
        const questionLine = lines[lines.length - 1];
        if (questionLine.startsWith('What does')) {
          let strippedLines = [...lines];
          let i = lines.length - 2;
          let strippedCount = 0;
          
          while (i >= 0 && strippedCount < 3) {
            const line = lines[i].trim();
            if (line === '') {
              i--;
              continue;
            }
            
            const isDramatic = (
              line.match(/^The .+ is .+\.$/) ||
              line.match(/^Somewhere .+\.$/) ||
              (line.length < 80 && line.match(/\.$/) && !line.match(/\w+, /))
            );
            
            if (isDramatic) {
              debugLog('Stripping dramatic flourish:', line);
              strippedLines.splice(i, 1);
              strippedCount++;
              i--;
            } else {
              break;
            }
          }
          
          if (strippedCount > 0) {
            response = strippedLines.join('\n');
          }
        }
      }
      
      setToolStatus('');
      setMessages([{ role: 'assistant', content: response }]);
    } catch (e) { setMessages([{ role: 'assistant', content: `Error: ${e.message}` }]); }
    setLoading(false);
  };

  const handleSend = async () => {
    if (!input.trim() || loading || showMemoryUpdate) return;
    setErrorDetails(null); // Clear any previous errors
    const userMsg = { role: 'user', content: input };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs); setInput(''); setLoading(true);
    const customInstructions = alwaysInstructions ? `${alwaysInstructions}\n\n` : '';
    try {
      setToolStatus('');
      const apiMessages = buildApiMessages(newMsgs);
      const protagonistName = protagonist || 'the protagonist';
      const userMessage = [...apiMessages, { 
        role: 'user', 
        content: `REMINDER: End your response by asking "What does ${protagonistName} do?" - NOT what NPCs do. DO NOT add dramatic setup sentences before the question.` 
      }];
      
      let response = await callClaude(userMessage, `${customInstructions}You are narrating a choose-your-own-adventure story. The user controls ${protagonistName}. The user's message is the action ${protagonistName} takes.

Describe what happens as a result of ${protagonistName}'s action. Write naturally - use as many or as few paragraphs as the moment needs. Use random_name tool for new characters.

## MEMORY:
${memory}

FORBIDDEN - Do NOT end with any of these patterns:
❌ "The [time] is [adjective]. The [place] is [adjective]." (e.g., "The night is cold. The road is long.")
❌ "Somewhere [direction], [threat] [verb]." (e.g., "Somewhere behind you, templars are mobilizing.")
❌ Short dramatic fragment sentences before the question
❌ Poetic mood-setting before the question
❌ Ominous statements before the question

CORRECT ending format:
✅ [End of narrative paragraph]
✅ 
✅ What does ${protagonistName} do?

Just end the narrative naturally, add a blank line, then ask the question. No drama before the question.

CRITICAL: You MUST end with this exact question format: "What does ${protagonistName} do?"

Do NOT ask what NPCs do. Do NOT ask what happens. ONLY ask what ${protagonistName} does.`, setToolStatus, 0, 3000, 1500);
      
      // Post-process: Fix common mistakes where Claude asks about NPCs instead of protagonist
      const lines = response.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      
      // Fix wrong question target
      if (lastLine && !lastLine.includes(protagonistName) && (
        lastLine.match(/What does .+ (do|say|respond|react)/i) ||
        lastLine.match(/What happens/i) ||
        lastLine.match(/How does .+ respond/i)
      )) {
        debugLog('Correcting narrator question to focus on protagonist');
        response = response.trim() + `\n\nWhat does ${protagonistName} do?`;
      }
      
      // Strip dramatic flourishes before the question
      // Pattern: last paragraph ends, then 1-3 short dramatic sentences, then the question
      if (lines.length >= 3) {
        const questionLine = lines[lines.length - 1];
        if (questionLine.startsWith('What does')) {
          // Check the 1-3 lines before the question
          let strippedLines = [...lines];
          let i = lines.length - 2;
          let strippedCount = 0;
          
          // Work backwards from the question
          while (i >= 0 && strippedCount < 3) {
            const line = lines[i].trim();
            
            // Empty line is fine, keep it
            if (line === '') {
              i--;
              continue;
            }
            
            // Check if it's a dramatic flourish
            const isDramatic = (
              line.match(/^The .+ is .+\.$/) || // "The night is cold."
              line.match(/^Somewhere .+\.$/) ||  // "Somewhere behind you..."
              (line.length < 80 && line.match(/\.$/) && !line.match(/\w+, /)) // Short dramatic sentence
            );
            
            if (isDramatic) {
              debugLog('Stripping dramatic flourish:', line);
              strippedLines.splice(i, 1);
              strippedCount++;
              i--;
            } else {
              // Hit actual narrative content, stop
              break;
            }
          }
          
          if (strippedCount > 0) {
            response = strippedLines.join('\n');
          }
        }
      }
      
      setToolStatus('');
      const updated = [...newMsgs, { role: 'assistant', content: response }];
      setMessages(updated);
      const newCount = messagesSinceUpdate + 1;
      setMessagesSinceUpdate(newCount);
      if (newCount >= 10) triggerMemoryUpdate(updated);
    } catch (e) { setMessages([...newMsgs, { role: 'assistant', content: `Error: ${e.message}` }]); }
    setLoading(false);
  };

  const regenerateFrom = async (index, newText = null) => {
    if (loading) return;
    setErrorDetails(null); // Clear any previous errors
    let newMsgs = newText !== null ? [...messages.slice(0, index), { role: 'user', content: newText }] : messages.slice(0, index + 1);
    setMessages(newMsgs); setEditingIndex(null); setEditText(''); setLoading(true);
    const customInstructions = alwaysInstructions ? `${alwaysInstructions}\n\n` : '';
    try {
      setToolStatus('');
      const apiMessages = buildApiMessages(newMsgs);
      const protagonistName = protagonist || 'the protagonist';
      
      // Add reminder to the last message in the compacted API messages
      const userMessage = [...apiMessages, { 
        role: 'user', 
        content: `REMINDER: End your response by asking "What does ${protagonistName} do?" - NOT what NPCs do. DO NOT add dramatic setup sentences before the question.` 
      }];
      
      let response = await callClaude(userMessage, `${customInstructions}You are narrating a choose-your-own-adventure story. The user controls ${protagonistName}. The user's message is the action ${protagonistName} takes.

Describe what happens. Write naturally - use as many or as few paragraphs as the moment needs. Use random_name tool for new characters.

## MEMORY:
${memory}

FORBIDDEN - Do NOT end with:
❌ "The [time] is [adjective]. The [place] is [adjective]."
❌ "Somewhere [direction], [threat] [verb]."
❌ Dramatic fragment sentences before the question
❌ Poetic mood-setting before the question

CORRECT: [End narrative] → [blank line] → What does ${protagonistName} do?

CRITICAL: You MUST end with this exact question format: "What does ${protagonistName} do?"

Do NOT ask what NPCs do. Do NOT ask what happens. ONLY ask what ${protagonistName} does.`, setToolStatus, 0, 3000, 1500);
      
      // Post-process: Fix if Claude asks about NPCs instead of protagonist
      const lines = response.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      
      // Fix wrong question target
      if (lastLine && !lastLine.includes(protagonistName) && (
        lastLine.match(/What does .+ (do|say|respond|react)/i) ||
        lastLine.match(/What happens/i) ||
        lastLine.match(/How does .+ respond/i)
      )) {
        debugLog('Correcting narrator question to focus on protagonist');
        response = response.trim() + `\n\nWhat does ${protagonistName} do?`;
      }
      
      // Strip dramatic flourishes before the question
      if (lines.length >= 3) {
        const questionLine = lines[lines.length - 1];
        if (questionLine.startsWith('What does')) {
          let strippedLines = [...lines];
          let i = lines.length - 2;
          let strippedCount = 0;
          
          while (i >= 0 && strippedCount < 3) {
            const line = lines[i].trim();
            if (line === '') {
              i--;
              continue;
            }
            
            const isDramatic = (
              line.match(/^The .+ is .+\.$/) ||
              line.match(/^Somewhere .+\.$/) ||
              (line.length < 80 && line.match(/\.$/) && !line.match(/\w+, /))
            );
            
            if (isDramatic) {
              debugLog('Stripping dramatic flourish:', line);
              strippedLines.splice(i, 1);
              strippedCount++;
              i--;
            } else {
              break;
            }
          }
          
          if (strippedCount > 0) {
            response = strippedLines.join('\n');
          }
        }
      }
      
      setToolStatus('');
      setMessages([...newMsgs, { role: 'assistant', content: response }]);
    } catch (e) { setMessages([...newMsgs, { role: 'assistant', content: `Error: ${e.message}` }]); }
    setLoading(false);
  };

  // Calculate diff statistics
  const calculateDiffStats = (diffText) => {
    const lines = diffText.split('\n');
    let added = 0;
    let removed = 0;
    
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        added++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        removed++;
      }
    }
    
    return { added, removed };
  };

  // Apply standard unified diff to memory
  const applyMemoryDiff = (originalMemory, diffText) => {
    const originalLines = originalMemory.split('\n');
    const diffLines = diffText.trim().split('\n');
    
    const result = [];
    let originalIndex = 0;
    let i = 0;
    
    while (i < diffLines.length) {
      const line = diffLines[i];
      
      // Parse hunk header: @@ -start,count +start,count @@
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (match) {
          const oldStart = parseInt(match[1]) - 1; // Convert to 0-indexed
          
          // Copy any lines before this hunk that weren't touched
          while (originalIndex < oldStart) {
            result.push(originalLines[originalIndex]);
            originalIndex++;
          }
        }
        i++;
        continue;
      }
      
      // Handle diff content lines
      if (line.startsWith('-')) {
        // Skip this line in original (it's being deleted)
        originalIndex++;
        i++;
      } else if (line.startsWith('+')) {
        // Add new line to result
        result.push(line.substring(1)); // Remove '+'
        i++;
      } else if (line.startsWith(' ')) {
        // Context line - copy from original
        result.push(originalLines[originalIndex]);
        originalIndex++;
        i++;
      } else {
        // Unrecognized line (diff header, etc.) - skip
        i++;
      }
    }
    
    // Copy any remaining lines from original that weren't part of hunks
    while (originalIndex < originalLines.length) {
      result.push(originalLines[originalIndex]);
      originalIndex++;
    }
    
    return result.join('\n');
  };

  const triggerMemoryUpdate = async (allMsgs) => {
    setMemoryUpdateLoading(true);
    const last10 = allMsgs.slice(-10);
    const customInstructions = alwaysInstructions ? `${alwaysInstructions}\n\n` : '';
    
    // Prepare line-numbered memory for diff generation
    const memoryLines = memory.split('\n');
    const numberedMemory = memoryLines.map((line, i) => `${i + 1}| ${line}`).join('\n');
    
    try {
      const system = `${customInstructions}You are updating a story memory document based on recent events.

Output a standard UNIFIED DIFF to update the memory. Use this exact format:

@@ -<old_line>,<old_count> +<new_line>,<new_count> @@
 context line (unchanged, prefix with space)
-line to remove (prefix with minus)
+line to add (prefix with plus)
 context line (unchanged)

Example to replace line 5:
@@ -5,1 +5,1 @@
-Has a sword
+Has a magic sword and a shield

Example to add lines after line 10:
@@ -10,0 +11,3 @@
+## Recent Events
+Confronted Inquisitor Ash
+

Example to delete lines 7-9:
@@ -7,3 +7,0 @@
-Line to delete
-Another line to delete
-Third line to delete

Rules:
- Line numbers are 1-indexed (first line is 1)
- Include minimal context (1-2 lines before/after changes)
- Prefix unchanged lines with a space
- Prefix removed lines with -
- Prefix added lines with +
- You can have multiple @@ hunks for different sections
- If no changes needed, output: NO_CHANGES

YOUR TASKS (in priority order):

1. REMOVE OUTDATED INFORMATION:
   - Delete events/details that are no longer relevant (happened many turns ago with no lasting impact)
   - Remove temporary states that have been resolved
   - Delete contradicted or superseded information

2. UPDATE EXISTING ENTRIES:
   - REPLACE old character descriptions with updated ones (don't duplicate)
   - UPDATE location info if it's changed
   - MODIFY relationship statuses rather than adding duplicates

3. ADD NEW INFORMATION:
   - Important decisions made
   - New characters met (with names)
   - Character development or relationship changes
   - Plot developments that advance the story
   - Items gained/lost, locations discovered
   - Mysteries revealed

4. RESTRUCTURE IF NEEDED:
   - Move information to more appropriate sections
   - Consolidate scattered information about the same topic

DO NOT:
- Just append to the end without cleaning up
- Keep old information that contradicts new events
- Duplicate information that's already there
- Add transient actions currently happening
- Add minor details that don't affect the story

CRITICAL: Return ONLY the unified diff. No preamble, no explanation, no markdown code blocks.`;
      
      const response = await callClaude([...last10, { 
        role: 'user', 
        content: `Current memory (with line numbers):\n\n${numberedMemory}\n\nGenerate a unified diff to update this memory based on recent events. Remember to:\n1. DELETE outdated information\n2. UPDATE existing entries (don't duplicate)\n3. ADD new important information\n4. RESTRUCTURE if needed\n\nReturn ONLY the diff with no preamble.` 
      }], system, null, 0, 4000);
      
      // Try to apply the diff
      let updatedMemory;
      let diffToShow = '';
      let stats = { added: 0, removed: 0 };
      
      try {
        // Check for NO_CHANGES
        if (response.trim() === 'NO_CHANGES') {
          debugLog('Memory update: no changes needed');
          updatedMemory = memory;
          diffToShow = 'NO_CHANGES';
        } else {
          // Strip markdown code blocks if present
          let cleanedDiff = response.trim();
          if (cleanedDiff.startsWith('```')) {
            cleanedDiff = cleanedDiff.replace(/^```(?:diff)?\n/, '').replace(/\n```$/, '');
          }
          
          updatedMemory = applyMemoryDiff(memory, cleanedDiff);
          diffToShow = cleanedDiff;
          stats = calculateDiffStats(cleanedDiff);
          debugLog('Successfully applied memory diff');
        }
      } catch (diffError) {
        debugLog('Diff parsing failed:', diffError.message);
        // Fall back to showing raw response for manual editing
        updatedMemory = response;
        diffToShow = response;
      }
      
      setMemoryDiff(diffToShow);
      setMemoryDiffStats(stats);
      setSuggestedMemory(updatedMemory);
      setMemoryUpdateTab('diff'); // Default to diff view
      setMessagesSinceUpdate(0); // Reset counter NOW, not when modal is dismissed
      setShowMemoryUpdate(true);
    } catch (e) { 
      debugLog('Memory update failed:', e);
    } finally {
      setMemoryUpdateLoading(false);
    }
  };

  const triggerFullMemoryUpdate = async () => {
    setMemoryUpdateLoading(true);
    const customInstructions = alwaysInstructions ? `${alwaysInstructions}\n\n` : '';
    const apiMessages = buildApiMessages(messages);
    try {
      const system = `${customInstructions}You are creating a comprehensive story memory document based on the ENTIRE story so far.

Create a well-organized memory document that includes:
- Protagonist details (name, key abilities, personality traits, important background)
- Key relationships and NPCs (with names and their role in the story)
- Current situation and objectives
- Major plot points and story developments
- Important locations visited
- Significant items or possessions
- Unresolved threads or mysteries
- Established world rules or mechanics

Focus on LASTING information and COMPLETED events:
- What has happened, not what is currently happening
- Permanent changes and developments
- Important decisions and their consequences

DO NOT include:
- Transient actions ("is eating", "is walking")
- Temporary emotional states unless they're significant character development
- Minor details that don't affect the story

CRITICAL: Be thorough but concise. Return ONLY the memory document. Do not include any preamble, explanation, or commentary. Your entire response should be the memory document itself.`;
      
      const response = await callClaude([...apiMessages, { role: 'user', content: `Current memory:\n${memory}\n\nCreate a comprehensive updated memory based on the full story context above. Return ONLY the updated memory document with no preamble or explanation.` }], system, null, 0, 8000);
      setSuggestedMemory(response);
      setMemoryDiff(''); // No diff for full update
      setMemoryDiffStats({ added: 0, removed: 0 });
      setMemoryUpdateTab('result'); // Show result tab for full updates
      setMessagesSinceUpdate(0); // Reset counter when showing modal
      setShowMemoryUpdate(true);
    } catch (e) { 
      debugLog('Full memory update failed:', e);
    } finally {
      setMemoryUpdateLoading(false);
    }
  };

  // Export story to MythWeavers format
  const exportToMythWeavers = () => {
    if (messages.length === 0) {
      debugLog('No messages to export');
      return;
    }

    // Generate IDs in the format MythWeavers expects (cuid-like)
    const generateId = () => {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let id = 'clx';
      for (let i = 0; i < 21; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
      }
      return id;
    };

    const storyId = generateId();
    const bookId = generateId();
    const arcId = generateId();
    const chapterId = generateId();
    const sceneId = generateId();

    // Find current story name from storyList
    const currentStory = storyList.find(s => s.id === currentStoryId);
    const storyName = currentStory?.name || 'Imported Adventure';

    // Group messages into pairs (user action + assistant response)
    const messagePairs = [];
    for (let i = 0; i < messages.length; i += 2) {
      const userMsg = messages[i];
      const assistantMsg = messages[i + 1];
      if (userMsg && assistantMsg) {
        messagePairs.push({ user: userMsg, assistant: assistantMsg });
      } else if (userMsg) {
        // Orphaned user message at the end
        messagePairs.push({ user: userMsg, assistant: null });
      }
    }

    // Build messages with paragraphs
    const exportMessages = messagePairs.map((pair, idx) => {
      const messageId = generateId();
      const revisionId = generateId();

      // Split assistant content into paragraphs
      const assistantText = pair.assistant?.content || '';
      const paragraphTexts = assistantText.split(/\n\n+/).filter(p => p.trim());

      const paragraphs = paragraphTexts.map((text, pIdx) => {
        const paragraphId = generateId();
        const paragraphRevisionId = generateId();
        return {
          id: paragraphId,
          sortOrder: pIdx,
          currentParagraphRevisionId: paragraphRevisionId,
          paragraphRevisions: [{
            id: paragraphRevisionId,
            body: text.trim(),
            contentSchema: null,
            version: 1,
            state: 'FINAL',
            script: null,
            plotPointActions: null,
            inventoryActions: null,
            paragraphComments: []
          }]
        };
      });

      return {
        id: messageId,
        sortOrder: idx,
        instruction: pair.user.content,
        script: null,
        type: 'CONTINUE',
        options: null,
        currentMessageRevisionId: revisionId,
        plotPointStates: [],
        messageRevisions: [{
          id: revisionId,
          version: 1,
          versionType: 'GENERATION',
          model: 'claude-sonnet-4-20250514',
          tokensPerSecond: null,
          totalTokens: null,
          promptTokens: null,
          cacheCreationTokens: null,
          cacheReadTokens: null,
          think: null,
          showThink: false,
          paragraphs
        }]
      };
    });

    // Create protagonist character if specified
    const characters = [];
    if (protagonist) {
      const charId = generateId();
      const nameParts = protagonist.trim().split(/\s+/);
      characters.push({
        id: charId,
        pictureFileId: null,
        firstName: nameParts[0] || protagonist,
        middleName: nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : null,
        lastName: nameParts.length > 1 ? nameParts[nameParts.length - 1] : null,
        nickname: null,
        description: null,
        background: null,
        personality: null,
        personalityQuirks: null,
        likes: null,
        dislikes: null,
        age: null,
        gender: null,
        sexualOrientation: null,
        height: null,
        hairColor: null,
        eyeColor: null,
        distinguishingFeatures: null,
        writingStyle: null,
        isMainCharacter: true,
        laterVersionOfId: null,
        significantActions: null,
        birthdate: null,
        inventory: []
      });
    }

    // Create context items from memory if it has content
    const contextItems = [];
    if (memory && memory !== "# Adventure Memory\n\n*Edit this to track important details.*") {
      contextItems.push({
        id: generateId(),
        type: 'SETTING',
        name: 'Story Memory',
        description: memory,
        isGlobal: true
      });
    }

    // Add always instructions as context item
    if (alwaysInstructions) {
      contextItems.push({
        id: generateId(),
        type: 'SETTING',
        name: 'Story Instructions',
        description: alwaysInstructions,
        isGlobal: true
      });
    }

    // Build the export data structure
    const exportData = {
      story: {
        name: storyName,
        summary: adventurePitch || null,
        status: 'DRAFT',
        type: 'PROSE',
        published: false,
        wordsPerWeek: null,
        spellingLevel: 'AMERICAN',
        chapters: 1,
        firstChapterReleasedAt: null,
        lastChapterReleasedAt: null,
        coverArtFileId: null,
        coverColor: null,
        coverTextColor: null,
        coverFontFamily: null,
        defaultPerspective: 'SECOND',
        defaultTense: 'PRESENT',
        genre: 'FANTASY',
        paragraphsPerTurn: 3,
        format: 'STANDARD',
        defaultProtagonistId: characters.length > 0 ? characters[0].id : null,
        defaultCalendarId: null,
        sortOrder: 0,
        pages: null,
        timelineStartTime: null,
        timelineEndTime: null,
        timelineGranularity: null,
        branchChoices: null,
        selectedNodeId: sceneId,
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        globalScript: null,
        plotPointDefaults: null
      },
      tags: ['imported', 'cyoa'],
      books: [{
        id: bookId,
        name: 'Book 1',
        summary: null,
        coverArtFileId: null,
        spineArtFileId: null,
        pages: null,
        sortOrder: 0,
        nodeType: 'BOOK',
        arcs: [{
          id: arcId,
          name: 'Arc 1',
          summary: null,
          sortOrder: 0,
          nodeType: 'ARC',
          chapters: [{
            id: chapterId,
            name: 'Chapter 1',
            summary: null,
            publishedOn: null,
            sortOrder: 0,
            nodeType: 'CHAPTER',
            status: 'DRAFT',
            publishingStatus: [],
            scenes: [{
              id: sceneId,
              name: 'Adventure',
              summary: adventurePitch || null,
              sortOrder: 0,
              status: 'DRAFT',
              includeInFull: true,
              perspective: 'SECOND',
              viewpointCharacterId: characters.length > 0 ? characters[0].id : null,
              activeCharacterIds: characters.map(c => c.id),
              activeContextItemIds: contextItems.map(c => c.id),
              goal: null,
              storyTime: null,
              mediaLinks: [],
              messages: exportMessages
            }]
          }]
        }]
      }],
      characters,
      contextItems,
      calendars: [],
      maps: [],
      mediaAttachments: [],
      plotPointStates: [],
      files: []
    };

    // Calculate checksum
    const storyJson = JSON.stringify(exportData);
    // Simple checksum (browser doesn't have crypto.createHash)
    let hash = 0;
    for (let i = 0; i < storyJson.length; i++) {
      const char = storyJson.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const checksum = Math.abs(hash).toString(16).padStart(64, '0');

    // Create manifest
    const manifest = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      exportedBy: 'CYOA Artifact Export',
      storyId: storyId,
      storyName: storyName,
      checksum
    };

    // Create ZIP file using JSZip-like approach (but simplified since we don't have JSZip)
    // Instead, we'll create a JSON bundle that can be imported
    // For now, export as a JSON file that MythWeavers can process
    const bundle = {
      manifest,
      story: exportData
    };

    // Download the file
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mythweavers-${storyName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    debugLog('Exported', messages.length, 'messages to MythWeavers format');
    setSaveStatus(`Exported ${messages.length} messages`);
    setTimeout(() => setSaveStatus(''), 3000);
  };

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportError('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const importedMessages = [];
      
      debugLog('Import keys:', Object.keys(data));
      
      if (data.chat_messages && Array.isArray(data.chat_messages)) {
        debugLog('Claude format, messages:', data.chat_messages.length);
        
        const msgMap = {};
        for (const msg of data.chat_messages) msgMap[msg.uuid] = msg;
        
        let leafUuid = data.current_leaf_message_uuid;
        if (!leafUuid || !msgMap[leafUuid]) {
          const childCount = {};
          for (const msg of data.chat_messages) {
            if (msg.parent_message_uuid && msg.parent_message_uuid !== '00000000-0000-4000-8000-000000000000') {
              childCount[msg.parent_message_uuid] = (childCount[msg.parent_message_uuid] || 0) + 1;
            }
          }
          const leaves = data.chat_messages.filter(m => !childCount[m.uuid]);
          leaves.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          leafUuid = leaves[0]?.uuid;
        }
        
        debugLog('Leaf:', leafUuid);
        if (!leafUuid || !msgMap[leafUuid]) throw new Error('Could not find conversation end');
        
        const chain = [];
        let cur = msgMap[leafUuid];
        const rootUuid = '00000000-0000-4000-8000-000000000000';
        while (cur) {
          chain.push(cur);
          cur = (cur.parent_message_uuid && cur.parent_message_uuid !== rootUuid) ? msgMap[cur.parent_message_uuid] : null;
        }
        debugLog('Chain length:', chain.length);
        chain.reverse();
        
        for (const msg of chain) {
          const t = msg.content?.map(c => c.text || '').filter(Boolean).join('') || msg.text || '';
          if (t && (msg.sender === 'human' || msg.sender === 'assistant')) {
            importedMessages.push({ role: msg.sender === 'human' ? 'user' : 'assistant', content: t });
          }
        }
      } else if (data.messages) {
        debugLog('App format');
        importedMessages.push(...data.messages);
        if (data.memory) setMemory(data.memory);
        if (data.compactions) setCompactions(data.compactions);
      }
      
      debugLog('Importing', importedMessages.length, 'messages');
      if (importedMessages.length === 0) throw new Error('No messages found');
      
      setMessages(importedMessages);
      if (!data.compactions) setCompactions({});
      setScreen('adventure');
      setShowImport(false);
      setSaveStatus(`Imported ${importedMessages.length}`);
    } catch (e) { debugLog(e); setImportError(e.message); }
    setImportLoading(false);
    e.target.value = '';
  };

  const clearSaved = async () => {
    if (!currentStoryId) return;
    try { 
      const storyKey = `cyoa-adventure-${currentStoryId}`;
      await storageDelete(storyKey); 
      localStorage.removeItem(storyKey);
    } catch (e) {}
    setMessages([]); setCompactions({}); setExpandedCompactions({}); setAdventurePitch('');
    setMemory("# Adventure Memory\n\n*Edit this to track important details.*");
    setMessagesSinceUpdate(0); setTokenCount(null); setProtagonist(''); setAlwaysInstructions(''); 
    setScreen('setup');
  };
  
  const createNewStory = async () => {
    const newStoryId = Date.now().toString();
    const newStory = { 
      id: newStoryId, 
      name: `Adventure ${storyList.length + 1}`, 
      lastSaved: new Date().toISOString(), 
      messageCount: 0 
    };
    
    const updatedList = [...storyList, newStory];
    setStoryList(updatedList);
    setCurrentStoryId(newStoryId);
    
    // Save updated list
    const listData = JSON.stringify({ stories: updatedList, lastOpenedStory: newStoryId });
    localStorage.setItem('cyoa-story-list', listData);
    try {
      await storageSet('cyoa-story-list', listData);
    } catch (e) {
      debugLog('Could not save new story list to cloud:', e.message || String(e));
    }
    
    // Reset state for new story
    setMessages([]); setCompactions({}); setExpandedCompactions({}); setAdventurePitch('');
    setMemory("# Adventure Memory\n\n*Edit this to track important details.*");
    setMessagesSinceUpdate(0); setTokenCount(null); setProtagonist(''); setAlwaysInstructions(''); 
    setScreen('setup');
    setShowStoryManager(false);
  };
  
  // Scan localStorage for orphaned stories and add them to the list
  const recoverOrphanedStories = () => {
    debugLog('Scanning for orphaned stories...');
    const orphanedStories = [];
    
    // Find all cyoa-adventure-* keys in localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cyoa-adventure-') && key !== 'cyoa-adventure') {
        const storyId = key.replace('cyoa-adventure-', '');
        
        // Check if this story is in the list
        const inList = storyList.some(s => s.id === storyId);
        if (!inList) {
          // Found an orphaned story!
          try {
            const data = JSON.parse(localStorage.getItem(key));
            orphanedStories.push({
              id: storyId,
              name: `Recovered Story (${storyId.slice(-6)})`,
              lastSaved: data.savedAt || new Date().toISOString(),
              messageCount: data.messages?.length || 0
            });
            debugLog(`Found orphaned story: ${storyId} with ${data.messages?.length || 0} messages`);
          } catch (e) {
            debugLog(`Failed to parse orphaned story ${storyId}:`, e);
          }
        }
      }
    }
    
    if (orphanedStories.length > 0) {
      const updatedList = [...storyList, ...orphanedStories];
      setStoryList(updatedList);
      
      const listData = JSON.stringify({ stories: updatedList, lastOpenedStory: currentStoryId });
      localStorage.setItem('cyoa-story-list', listData);
      try {
        storageSet('cyoa-story-list', listData);
      } catch (e) {
        debugLog('Could not save recovered stories to cloud:', e.message || String(e));
      }
      
      setSaveStatus(`Recovered ${orphanedStories.length} orphaned ${orphanedStories.length === 1 ? 'story' : 'stories'}`);
      setTimeout(() => setSaveStatus(''), 3000);
    } else {
      setSaveStatus('No orphaned stories found');
      setTimeout(() => setSaveStatus(''), 2000);
    }
  };
  
  const switchStory = async (storyId) => {
    setCurrentStoryId(storyId);
    await loadStory(storyId);
    setShowStoryManager(false);
    
    // Update last opened
    const listData = JSON.stringify({ stories: storyList, lastOpenedStory: storyId });
    localStorage.setItem('cyoa-story-list', listData);
    try {
      await storageSet('cyoa-story-list', listData);
    } catch (e) {
      debugLog('Could not update last opened in cloud:', e.message || String(e));
    }
  };
  
  const deleteStory = async (storyId) => {
    console.log('deleteStory called!', storyId);
    debugLog('deleteStory called for:', storyId);
    
    if (storyList.length === 1) {
      setSaveStatus('Cannot delete last story');
      setTimeout(() => setSaveStatus(''), 3000);
      return;
    }
    
    try {
      // Delete story data
      const storyKey = `cyoa-adventure-${storyId}`;
      debugLog('Deleting story data:', storyKey);
      
      try {
        await storageDelete(storyKey);
        debugLog('Deleted from cloud storage');
      } catch (e) {
        debugLog('Could not delete from cloud:', e.message || String(e));
      }
      
      localStorage.removeItem(storyKey);
      debugLog('Deleted from localStorage');
      
      // Update list
      const updatedList = storyList.filter(s => s.id !== storyId);
      setStoryList(updatedList);
      debugLog('Updated story list, new count:', updatedList.length);
      
      // If deleting current story, switch to first available
      if (storyId === currentStoryId) {
        debugLog('Deleted current story, switching to:', updatedList[0].id);
        await switchStory(updatedList[0].id);
      }
      
      // Save updated list
      const listData = JSON.stringify({ stories: updatedList, lastOpenedStory: currentStoryId });
      localStorage.setItem('cyoa-story-list', listData);
      try {
        await storageSet('cyoa-story-list', listData);
      } catch (e) {
        debugLog('Could not save list to cloud:', e.message || String(e));
      }
      
      // Reload storage keys to update badges
      await loadAllStorageKeys();
      
      setSaveStatus('Story deleted');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (e) {
      debugLog('Delete story error:', e.message || String(e), e);
      setSaveStatus('Delete failed: ' + (e.message || String(e)));
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };
  
  const renameStory = async (storyId, newName) => {
    const updatedList = storyList.map(s => s.id === storyId ? { ...s, name: newName } : s);
    setStoryList(updatedList);
    
    const listData = JSON.stringify({ stories: updatedList, lastOpenedStory: currentStoryId });
    localStorage.setItem('cyoa-story-list', listData);
    try {
      await storageSet('cyoa-story-list', listData);
    } catch (e) {
      debugLog('Could not save rename to cloud:', e.message || String(e));
    }
  };
  
  const loadAllStorageKeys = async () => {
    if (storageKeysLoading) return; // Don't load if already loading
    
    setStorageKeysLoading(true);
    try {
      // Get localStorage keys
      const localKeys = [];
      const cyoaKeys = [];
      let totalLocalSize = 0;
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          const size = new Blob([value]).size;
          totalLocalSize += size;
          
          const keyData = { key, size, exists: true };
          
          if (key.startsWith('cyoa-')) {
            cyoaKeys.push(keyData);
          }
          localKeys.push(keyData);
        }
      }
      
      debugLog(`localStorage total: ${totalLocalSize} bytes (${localKeys.length} keys, ${cyoaKeys.length} cyoa keys)`);
      
      // Get cloud storage keys by trying common patterns
      const cloudKeys = [];
      const keysToCheck = [
        'cyoa-adventure',
        'cyoa-story-list',
        'cyoa-adventure-migrated-original',
        ...storyList.map(s => `cyoa-adventure-${s.id}`)
      ];
      
      // Deduplicate keys to avoid checking the same key twice
      const uniqueKeys = [...new Set(keysToCheck)];
      
      for (const key of uniqueKeys) {
        try {
          const result = await storageGet(key);
          if (result && result.value) {
            cloudKeys.push({
              key,
              size: new Blob([result.value]).size,
              exists: true
            });
          }
        } catch (e) {
          // Key doesn't exist or error
        }
      }
      
      setAllStorageKeys({ local: localKeys, cloud: cloudKeys });
      setStorageKeysLoaded(true);
      debugLog('Loaded storage keys:', localKeys.length, 'local,', cloudKeys.length, 'cloud');
    } finally {
      setStorageKeysLoading(false);
    }
  };
  
  const deleteStorageKey = async (key, location) => {
    console.log('deleteStorageKey called!', key, location);
    debugLog('deleteStorageKey called:', key, location);
    
    setDeletingKey(key);
    debugLog(`Deleting ${key} from ${location}...`);
    
    try {
      if (location === 'local') {
        localStorage.removeItem(key);
        debugLog(`Deleted ${key} from localStorage`);
      } else {
        const result = await storageDelete(key);
        debugLog(`Delete result for ${key}:`, result);
      }
      
      // Reload keys to refresh the list
      await loadAllStorageKeys();
      
      setSaveStatus(`Deleted ${key}`);
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (e) {
      const errorMsg = e.message || String(e);
      debugLog(`Failed to delete ${key}:`, errorMsg, e);
      setSaveStatus(`Delete failed: ${errorMsg}`);
      setTimeout(() => setSaveStatus(''), 3000);
    } finally {
      setDeletingKey(null);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: 'Georgia, serif', background: '#faf9f5', color: '#141413', overflow: 'hidden' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes progressPulse { 
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
      `}</style>
      
      {/* Claude API Progress Bar - Always visible */}
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        height: '3px', 
        background: '#d0cec6', 
        zIndex: 9999,
        opacity: claudeRequestInProgress ? 1 : 0,
        transition: 'opacity 0.3s ease'
      }}>
        <div style={{ 
          height: '100%', 
          width: `${claudeRequestProgress}%`, 
          background: 'linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%)',
          transition: 'width 0.1s linear',
          boxShadow: claudeRequestProgress > 10 ? '0 0 10px rgba(124, 58, 237, 0.5)' : 'none',
          animation: claudeRequestProgress < 95 ? 'progressPulse 2s ease-in-out infinite' : 'none'
        }} />
      </div>
      
      {initialLoading ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #d0cec6', borderTopColor: '#141413', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#666', fontSize: '0.9rem' }}>Loading adventure...</p>
        </div>
      ) : (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
        {/* Header - Full Width */}
        <div style={{ padding: '16px', paddingBottom: '0', borderBottom: '1px solid #e8e6de' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', overflowX: 'auto', minWidth: 0, scrollbarWidth: 'thin', scrollbarColor: '#d0cec6 transparent' }}>
            <div style={{ minWidth: 0, flex: '0 0 auto' }}>
              <h1 style={{ margin: 0, fontSize: '1.4rem', color: '#141413', whiteSpace: 'nowrap' }}>Choose Your Own Adventure</h1>
              {currentStoryId && storyList.length > 0 && (
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#666', whiteSpace: 'nowrap' }}>
                  {storyList.find(s => s.id === currentStoryId)?.name || 'Untitled'}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', flex: '0 0 auto' }}>
              {screen === 'adventure' && <button onClick={() => setShowMemoryPanel(!showMemoryPanel)} style={{ background: '#141413', border: 'none', color: '#faf9f5', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>{showMemoryPanel ? 'Hide' : 'Show'} Memory</button>}
              <button onClick={async () => { if (!storageKeysLoaded && !storageKeysLoading) await loadAllStorageKeys(); setShowStoryManager(true); }} style={{ background: 'transparent', border: '1px solid #141413', color: '#141413', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>📚 Stories ({storyList.length})</button>
            </div>
          </div>
        </div>
        
        {/* Content Row: Main Content + Memory Panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', minWidth: 0 }}>
        {screen === 'setup' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px', padding: '20px' }}>
            <p style={{ color: '#141413' }}>Generate a random adventure pitch or write your own:</p>
            <textarea value={adventurePitch} onChange={e => setAdventurePitch(e.target.value)} placeholder="Click 'Random Pitch' or write your own..." style={{ width: '100%', maxWidth: '500px', height: '120px', background: '#f0eee6', border: '1px solid #d0cec6', color: '#141413', padding: '12px', borderRadius: '6px', resize: 'none', fontFamily: 'inherit' }} />
            {toolStatus && <p style={{ color: '#141413', fontSize: '0.85rem' }}>{toolStatus}</p>}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button onClick={generatePitch} disabled={pitchLoading} style={{ background: '#141413', border: 'none', color: '#faf9f5', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', opacity: pitchLoading ? 0.5 : 1 }}>{pitchLoading ? 'Generating...' : '🎲 Random Pitch'}</button>
              <button onClick={startFromPitch} disabled={loading || !adventurePitch.trim()} style={{ background: '#141413', border: 'none', color: '#faf9f5', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', opacity: (loading || !adventurePitch.trim()) ? 0.5 : 1 }}>{loading ? 'Starting...' : '▶ Start'}</button>
              <button onClick={() => setShowImport(true)} style={{ background: 'transparent', border: '1px solid #141413', color: '#141413', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer' }}>📥 Import</button>
              <button onClick={exportToMythWeavers} disabled={messages.length === 0} style={{ background: 'transparent', border: '1px solid #141413', color: '#141413', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', opacity: messages.length === 0 ? 0.5 : 1 }}>📤 Export MW</button>
              <button onClick={() => setShowDebugLogs(true)} style={{ background: 'transparent', border: '1px solid #141413', color: '#141413', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer' }}>🔍 Logs</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', background: '#faf9f5', borderRadius: '8px', padding: '16px', marginBottom: '12px', border: '1px solid #e8e6de', scrollbarWidth: 'thin', scrollbarColor: '#1f1e1d59 transparent' }}>
              {compactionRanges.map(({ start, end, key }) => {
                const comp = compactions[key];
                const expanded = expandedCompactions[key];
                const ratio = comp?.tokensBefore && comp?.tokensAfter ? ((1 - comp.tokensAfter / comp.tokensBefore) * 100).toFixed(0) : null;
                return (
                  <div key={key} style={{ marginBottom: '16px', border: '1px solid #d0cec6', borderRadius: '8px', overflow: 'hidden' }}>
                    <div onClick={() => toggleCompactionExpand(key)} style={{ padding: '12px', background: '#f0eee6', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#141413', fontSize: '0.85rem' }}>
                        📦 Messages {start + 1}-{end + 1}
                        {comp?.tokensBefore && comp?.tokensAfter && (
                          <span style={{ marginLeft: '8px', color: '#16a34a', fontSize: '0.75rem' }}>
                            {comp.tokensBefore}→{comp.tokensAfter} ({ratio}% saved)
                          </span>
                        )}
                      </span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {!comp && <span style={{ color: '#ea580c', fontSize: '0.75rem' }}>Needs compaction</span>}
                        <button onClick={(e) => { e.stopPropagation(); generateCompaction(key); }} disabled={compactingKeys.has(key)} style={{ background: '#141413', border: 'none', color: '#faf9f5', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>{compactingKeys.has(key) ? '⏳' : '🔄'}</button>
                        <span style={{ color: '#666' }}>{expanded ? '▼' : '▶'}</span>
                      </div>
                    </div>
                    {comp && !expanded && <div style={{ padding: '12px', borderTop: '1px solid #d0cec6' }}><div style={{ lineHeight: 1.6, color: '#666', fontStyle: 'italic' }}>{formatMessageText(comp.summary)}</div></div>}
                    {expanded && (
                      <div style={{ padding: '12px', borderTop: '1px solid #d0cec6', maxHeight: '400px', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#1f1e1d59 transparent' }}>
                        {comp && <div style={{ marginBottom: '12px', padding: '8px', background: '#f0eee6', borderRadius: '4px' }}><div style={{ fontSize: '0.75rem', color: '#141413', marginBottom: '4px' }}>SUMMARY</div><div style={{ color: '#666', fontStyle: 'italic' }}>{formatMessageText(comp.summary)}</div></div>}
                        <div style={{ fontSize: '0.75rem', color: '#141413', marginBottom: '8px' }}>ORIGINAL</div>
                        {messages.slice(start, end + 1).map((m, i) => <div key={i} style={{ marginBottom: '8px', padding: '8px', background: m.role === 'user' ? '#f0eee6' : 'transparent', borderRadius: '4px', fontSize: '0.85rem' }}><div style={{ fontFamily: m.role === 'user' ? 'system-ui, sans-serif' : 'inherit', whiteSpace: m.role === 'user' ? 'pre-wrap' : 'normal' }}>{formatMessageText(m.content)}</div></div>)}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {messages.slice(Math.max(0, messages.length - VERBATIM_COUNT)).map((m, i) => {
                const idx = Math.max(0, messages.length - VERBATIM_COUNT) + i;
                const isLastMessage = idx === messages.length - 1;
                return (
                  <div key={idx} style={{ marginBottom: '16px', padding: '12px', background: m.role === 'user' ? '#f0eee6' : 'transparent', borderRadius: '6px' }}>
                    {m.role === 'user' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#666' }}>YOU</span>
                        {!loading && editingIndex !== idx && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => { setEditingIndex(idx); setEditText(m.content); }} style={{ background: 'transparent', border: 'none', color: '#141413', cursor: 'pointer', fontSize: '0.7rem' }}>✏️</button>
                            {idx === messages.length - 2 && <button onClick={() => regenerateFrom(idx)} style={{ background: 'transparent', border: 'none', color: '#141413', cursor: 'pointer', fontSize: '0.7rem' }}>🔄</button>}
                            {isLastMessage && <button onClick={() => setMessages(messages.slice(0, -1))} style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.7rem' }} title="Delete this message">🗑️</button>}
                          </div>
                        )}
                      </div>
                    )}
                    {m.role === 'assistant' && isLastMessage && !loading && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#666' }}>NARRATOR</span>
                        <button onClick={() => setMessages(messages.slice(0, -1))} style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.7rem' }} title="Delete this message">🗑️</button>
                      </div>
                    )}
                    {editingIndex === idx ? (
                      <div>
                        <textarea value={editText} onChange={e => setEditText(e.target.value)} style={{ width: '100%', background: '#fff', border: '1px solid #141413', color: '#141413', padding: '8px', borderRadius: '4px', minHeight: '60px', fontFamily: 'system-ui, sans-serif', whiteSpace: 'pre-wrap' }} />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <button onClick={() => editText.trim() && regenerateFrom(idx, editText.trim())} style={{ background: '#141413', border: 'none', color: '#faf9f5', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Submit</button>
                          <button onClick={() => { setEditingIndex(null); setEditText(''); }} style={{ background: 'transparent', border: '1px solid #141413', color: '#141413', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Cancel</button>
                        </div>
                      </div>
                    ) : <div style={{ lineHeight: 1.6, fontFamily: m.role === 'user' ? 'system-ui, sans-serif' : 'inherit', whiteSpace: m.role === 'user' ? 'pre-wrap' : 'normal' }}>{formatMessageText(m.content)}</div>}
                  </div>
                );
              })}
              
              {loading && <div style={{ color: '#141413', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid #141413', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />{toolStatus || 'The story unfolds...'}</div>}
              <div ref={messagesEndRef} />
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}} placeholder="What do you do?" disabled={loading || showMemoryUpdate} style={{ flex: 1, background: '#fff', border: '1px solid #d0cec6', color: '#141413', padding: '12px', borderRadius: '6px', fontSize: '1rem', minHeight: '48px', maxHeight: '200px', resize: 'vertical', fontFamily: 'system-ui, sans-serif', whiteSpace: 'pre-wrap' }} />
              <button onClick={handleSend} disabled={loading || !input.trim() || showMemoryUpdate} style={{ background: '#141413', border: 'none', color: '#faf9f5', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', opacity: (loading || !input.trim() || showMemoryUpdate) ? 0.5 : 1 }}>Go</button>
            </div>
            
            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '8px', overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'thin', scrollbarColor: '#d0cec6 transparent' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', minWidth: 'max-content' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Memory: 
                  <input 
                    type="number" 
                    min="0" 
                    max="10" 
                    value={10 - messagesSinceUpdate} 
                    onChange={e => {
                      const newRemaining = parseInt(e.target.value) || 0;
                      setMessagesSinceUpdate(Math.max(0, Math.min(10, 10 - newRemaining)));
                    }}
                    style={{ 
                      width: '40px', 
                      background: '#fff', 
                      border: '1px solid #d0cec6', 
                      color: '#141413', 
                      padding: '2px 6px', 
                      borderRadius: '3px', 
                      fontSize: '0.75rem',
                      textAlign: 'center'
                    }}
                    title="Messages remaining before memory update (editable)"
                  />
                  <button 
                    onClick={() => setMessagesSinceUpdate(0)} 
                    style={{ 
                      background: 'transparent', 
                      border: 'none', 
                      color: '#666', 
                      cursor: 'pointer', 
                      fontSize: '0.7rem',
                      padding: '0 2px'
                    }}
                    title="Reset counter to 10"
                  >↻</button>
                  {tokenCount && <span style={{ marginLeft: '4px', color: '#141413' }}>~{formatTokens(tokenCount)}</span>}
                  {compactionRanges.length > 0 && <span style={{ marginLeft: '8px', color: uncompactedCount ? '#ea580c' : '#16a34a' }}>📦{compactionRanges.length - uncompactedCount}/{compactionRanges.length}{totalSaved > 0 && ` (-${formatTokens(totalSaved)})`}</span>}
                  {saveStatus && <span style={{ marginLeft: '8px', color: '#141413' }}>• {saveStatus}</span>}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {uncompactedCount > 0 && <button onClick={compactAll} disabled={compactingKeys.size > 0} style={{ background: 'transparent', border: '1px solid #ea580c', color: '#ea580c', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Compact All ({uncompactedCount}){compactingKeys.size > 0 && ` ⏳${compactingKeys.size}`}</button>}
                  <button onClick={() => setDisablePromptCaching(!disablePromptCaching)} style={{ background: 'transparent', border: `1px solid ${disablePromptCaching ? '#dc2626' : '#141413'}`, color: disablePromptCaching ? '#dc2626' : '#141413', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }} title="Disable prompt caching to test if it's causing empty responses">{disablePromptCaching ? '🚫' : '💾'} Cache</button>
                  <button onClick={() => setShowDebugLogs(true)} style={{ background: 'transparent', border: '1px solid #141413', color: '#141413', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }} title="View debug logs">🔍 Logs {debugLogs.length > 0 && `(${debugLogs.length})`}</button>
                  <button onClick={exportToMythWeavers} style={{ background: 'transparent', border: '1px solid #141413', color: '#141413', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }} title="Export to MythWeavers format">📤 MW</button>
                  <button onClick={clearSaved} style={{ background: 'transparent', border: '1px solid #141413', color: '#141413', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>New</button>
                </div>
              </div>
              {totalStorageUsed > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, height: '4px', background: '#e8e6de', borderRadius: '2px' }}><div style={{ width: `${Math.min(storagePercent, 100)}%`, height: '100%', background: storagePercent > 80 ? '#dc2626' : storagePercent > 50 ? '#ea580c' : '#141413' }} /></div>
                  <span style={{ minWidth: '120px', fontSize: '0.7rem' }}>
                    {storageKeysLoading ? '⏳ Loading...' : (
                      <>
                        {formatBytes(totalStorageUsed)} / 5MB
                        {storageKeysLoaded && ` (${allStorageKeys.local.length} keys)`}
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
          </div>
          
          {/* Memory Panel - Inside Content Row */}
          {screen === 'adventure' && showMemoryPanel && (
            <div style={{ flex: '0 0 280px', width: '280px', background: '#f0eee6', padding: '16px', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #d0cec6', minWidth: 0 }}>
              <h2 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#141413' }}>Memory</h2>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '0.75rem', color: '#666', display: 'block', marginBottom: '4px' }}>Protagonist</label>
            <input value={protagonist} onChange={e => setProtagonist(e.target.value)} placeholder="Name..." style={{ width: '100%', background: '#fff', border: '1px solid #d0cec6', color: '#141413', padding: '8px', borderRadius: '4px', fontSize: '0.85rem' }} />
          </div>
          <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '0.75rem', color: '#666' }}>Always Instructions</label>
              {alwaysInstructions.length > 0 && (
                <span style={{ fontSize: '0.7rem', color: '#999' }}>
                  {alwaysInstructions.length} chars (~{Math.ceil(alwaysInstructions.length / 4)} tokens)
                </span>
              )}
            </div>
            <textarea value={alwaysInstructions} onChange={e => setAlwaysInstructions(e.target.value)} placeholder="e.g., The protagonist is female. Write in a gothic style..." style={{ width: '100%', height: '60px', background: '#fff', border: '1px solid #d0cec6', color: '#141413', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', resize: 'none', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label style={{ fontSize: '0.75rem', color: '#666' }}>Story Memory</label>
            <span style={{ fontSize: '0.7rem', color: '#999' }}>
              {memory.length} chars (~{Math.ceil(memory.length / 4)} tokens)
            </span>
          </div>
          <textarea value={memory} onChange={e => setMemory(e.target.value)} style={{ flex: 1, background: '#fff', border: '1px solid #d0cec6', color: '#141413', padding: '12px', borderRadius: '6px', resize: 'none', fontFamily: 'inherit', fontSize: '0.85rem' }} />
          <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
            <button onClick={() => triggerMemoryUpdate(messages)} disabled={messages.length < 2 || memoryUpdateLoading} style={{ flex: 1, background: '#141413', border: 'none', color: '#faf9f5', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', opacity: (messages.length < 2 || memoryUpdateLoading) ? 0.5 : 1 }}>
              {memoryUpdateLoading ? '⏳ Updating...' : 'Update (Recent)'}
            </button>
            <button onClick={triggerFullMemoryUpdate} disabled={messages.length < 2 || memoryUpdateLoading} style={{ flex: 1, background: '#141413', border: 'none', color: '#faf9f5', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', opacity: (messages.length < 2 || memoryUpdateLoading) ? 0.5 : 1 }}>
              {memoryUpdateLoading ? '⏳ Updating...' : 'Update (Full)'}
            </button>
          </div>
        </div>
        )}
        </div>
        {/* End Content Row */}
      </div>
      )}

      {showImport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', zIndex: 100 }}>
          <div style={{ background: '#faf9f5', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '100%', border: '1px solid #d0cec6' }}>
            <h2 style={{ margin: '0 0 16px 0', color: '#141413' }}>Import Adventure</h2>
            <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '16px' }}>Import JSON from Claude (Network tab) or exported adventure.</p>
            <label style={{ display: 'block', background: '#f0eee6', border: '2px dashed #d0cec6', borderRadius: '8px', padding: '32px', textAlign: 'center', cursor: 'pointer', marginBottom: '16px' }}>
              <input type="file" accept=".json" onChange={handleFileImport} style={{ display: 'none' }} />
              <div style={{ color: '#141413' }}>📁 Click to select JSON</div>
            </label>
            {importLoading && <p style={{ color: '#141413' }}>Importing...</p>}
            {importError && <p style={{ color: '#dc2626', marginBottom: '12px' }}>{importError}</p>}
            <button onClick={() => { setShowImport(false); setImportError(''); }} style={{ width: '100%', background: '#141413', border: 'none', color: '#faf9f5', padding: '12px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {showMemoryUpdate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', zIndex: 100 }}>
          <div style={{ background: '#faf9f5', borderRadius: '12px', padding: '24px', maxWidth: '700px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', border: '1px solid #d0cec6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, color: '#141413' }}>Memory Update</h2>
              {memoryDiffStats.added + memoryDiffStats.removed > 0 && (
                <span style={{ fontSize: '0.85rem', color: '#666' }}>
                  <span style={{ color: '#16a34a' }}>+{memoryDiffStats.added}</span>
                  {' '}
                  <span style={{ color: '#dc2626' }}>-{memoryDiffStats.removed}</span>
                </span>
              )}
            </div>
            
            {/* Tabs - only show if we have a diff */}
            {memoryDiff && memoryDiff !== 'NO_CHANGES' && (
              <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', borderBottom: '1px solid #d0cec6' }}>
                <button 
                  onClick={() => setMemoryUpdateTab('diff')}
                  style={{ 
                    background: memoryUpdateTab === 'diff' ? '#141413' : 'transparent',
                    color: memoryUpdateTab === 'diff' ? '#faf9f5' : '#666',
                    border: 'none',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    borderRadius: '4px 4px 0 0',
                    fontWeight: memoryUpdateTab === 'diff' ? 'bold' : 'normal'
                  }}
                >
                  Diff
                </button>
                <button 
                  onClick={() => setMemoryUpdateTab('result')}
                  style={{ 
                    background: memoryUpdateTab === 'result' ? '#141413' : 'transparent',
                    color: memoryUpdateTab === 'result' ? '#faf9f5' : '#666',
                    border: 'none',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    borderRadius: '4px 4px 0 0',
                    fontWeight: memoryUpdateTab === 'result' ? 'bold' : 'normal'
                  }}
                >
                  Result
                </button>
              </div>
            )}
            
            {/* Content area */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px' }}>
              {memoryUpdateTab === 'diff' && memoryDiff ? (
                memoryDiff === 'NO_CHANGES' ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
                    No changes needed - memory is up to date
                  </div>
                ) : (
                  <div style={{ background: '#f0eee6', padding: '12px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: 1.5 }}>
                    {memoryDiff.split('\n').map((line, i) => {
                      let style = { margin: 0, padding: '2px 4px' };
                      if (line.startsWith('+') && !line.startsWith('+++')) {
                        style.background = '#dcfce7';
                        style.color = '#166534';
                      } else if (line.startsWith('-') && !line.startsWith('---')) {
                        style.background = '#fee2e2';
                        style.color = '#991b1b';
                      } else if (line.startsWith('@@')) {
                        style.background = '#e0e7ff';
                        style.color = '#3730a3';
                        style.fontWeight = 'bold';
                      }
                      return <div key={i} style={style}>{line || '\u00A0'}</div>;
                    })}
                  </div>
                )
              ) : (
                <textarea 
                  value={suggestedMemory} 
                  onChange={e => setSuggestedMemory(e.target.value)} 
                  style={{ 
                    width: '100%', 
                    height: '100%',
                    minHeight: '300px',
                    background: '#f0eee6', 
                    border: '1px solid #d0cec6', 
                    color: '#141413', 
                    padding: '12px', 
                    borderRadius: '6px', 
                    fontFamily: 'inherit',
                    resize: 'none'
                  }} 
                />
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setMemory(suggestedMemory); setShowMemoryUpdate(false); }} style={{ flex: 1, background: '#141413', border: 'none', color: '#faf9f5', padding: '12px', borderRadius: '6px', cursor: 'pointer' }}>Accept</button>
              <button onClick={() => { setShowMemoryUpdate(false); }} style={{ flex: 1, background: 'transparent', border: '1px solid #141413', color: '#141413', padding: '12px', borderRadius: '6px', cursor: 'pointer' }}>Skip</button>
            </div>
          </div>
        </div>
      )}

      {errorDetails && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', zIndex: 200 }}>
          <div style={{ background: '#faf9f5', borderRadius: '12px', padding: '24px', maxWidth: '600px', width: '100%', maxHeight: '80vh', overflowY: 'auto', border: '1px solid #dc2626' }}>
            <h2 style={{ margin: '0 0 16px 0', color: '#dc2626' }}>Error Details</h2>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '8px' }}>Time: {errorDetails.timestamp}</div>
              
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '8px', color: '#141413' }}>Message:</div>
              <div style={{ background: '#f0eee6', padding: '12px', borderRadius: '4px', marginBottom: '12px', fontFamily: 'monospace', fontSize: '0.85rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{errorDetails.message}</div>
              
              {errorDetails.fullError && (
                <>
                  <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '8px', color: '#141413' }}>Full Error Response:</div>
                  <div style={{ background: '#f0eee6', padding: '12px', borderRadius: '4px', marginBottom: '12px', fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '200px', overflowY: 'auto' }}>{errorDetails.fullError}</div>
                </>
              )}
              
              {errorDetails.responseText && (
                <>
                  <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '8px', color: '#141413' }}>Raw Response Text:</div>
                  <div style={{ background: '#f0eee6', padding: '12px', borderRadius: '4px', marginBottom: '12px', fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '200px', overflowY: 'auto' }}>{errorDetails.responseText}</div>
                </>
              )}
              
              {errorDetails.requestMessages && (
                <>
                  <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '8px', color: '#141413' }}>Request Messages:</div>
                  <div style={{ background: '#f0eee6', padding: '12px', borderRadius: '4px', marginBottom: '12px', fontFamily: 'monospace', fontSize: '0.65rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '200px', overflowY: 'auto' }}>{errorDetails.requestMessages}</div>
                </>
              )}
              
              {errorDetails.stack && (
                <>
                  <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '8px', color: '#141413' }}>Stack Trace:</div>
                  <div style={{ background: '#f0eee6', padding: '12px', borderRadius: '4px', marginBottom: '12px', fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '200px', overflowY: 'auto' }}>{errorDetails.stack}</div>
                </>
              )}
            </div>
            <button onClick={() => setErrorDetails(null)} style={{ width: '100%', background: '#141413', border: 'none', color: '#faf9f5', padding: '12px', borderRadius: '6px', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}

      {showDebugLogs && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', zIndex: 200 }}>
          <div style={{ background: '#faf9f5', borderRadius: '12px', padding: '24px', maxWidth: '700px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', border: '1px solid #141413' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, color: '#141413' }}>Debug Logs ({debugLogs.length})</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => {
                  const last50 = debugLogs.slice(-50).map(l => `[${l.timestamp}] ${l.message}`).join('\n');
                  navigator.clipboard.writeText(last50);
                }} style={{ background: '#141413', border: 'none', color: '#faf9f5', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Copy Last 50</button>
                <button onClick={() => {
                  const all = debugLogs.map(l => `[${l.timestamp}] ${l.message}`).join('\n');
                  navigator.clipboard.writeText(all);
                }} style={{ background: '#141413', border: 'none', color: '#faf9f5', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Copy All</button>
                <button onClick={() => setDebugLogs([])} style={{ background: 'transparent', border: '1px solid #dc2626', color: '#dc2626', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Clear</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', background: '#f0eee6', padding: '12px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {debugLogs.length === 0 ? (
                <div style={{ color: '#666', fontStyle: 'italic' }}>No logs yet...</div>
              ) : (
                debugLogs.map((log, i) => (
                  <div key={i} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: i < debugLogs.length - 1 ? '1px solid #d0cec6' : 'none' }}>
                    <span style={{ color: '#666' }}>[{log.timestamp}]</span> {log.message}
                  </div>
                ))
              )}
            </div>
            <button onClick={() => setShowDebugLogs(false)} style={{ marginTop: '16px', background: '#141413', border: 'none', color: '#faf9f5', padding: '12px', borderRadius: '6px', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}
      
      {showStoryManager && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', zIndex: 200 }}>
          <div style={{ background: '#faf9f5', borderRadius: '12px', padding: '24px', maxWidth: '600px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', border: '1px solid #141413' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, color: '#141413' }}>My Stories</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={recoverOrphanedStories} style={{ background: 'transparent', border: '1px solid #16a34a', color: '#16a34a', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>🔍 Find Missing</button>
                <button onClick={async () => { await loadAllStorageKeys(); setShowStorageBrowser(true); }} disabled={storageKeysLoading} style={{ background: 'transparent', border: '1px solid #141413', color: '#141413', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', opacity: storageKeysLoading ? 0.5 : 1 }}>{storageKeysLoading ? '⏳' : '🗄️'} Storage</button>
                <button onClick={createNewStory} style={{ background: '#141413', border: 'none', color: '#faf9f5', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>+ New Story</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {storyList.map(story => (
                <div key={story.id} style={{ background: story.id === currentStoryId ? '#f0eee6' : '#fff', border: story.id === currentStoryId ? '2px solid #141413' : '1px solid #d0cec6', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <input 
                      value={story.name} 
                      onChange={(e) => renameStory(story.id, e.target.value)}
                      style={{ background: 'transparent', border: 'none', color: '#141413', fontSize: '1rem', fontWeight: 'bold', width: '100%', marginBottom: '4px' }}
                    />
                    <div style={{ fontSize: '0.75rem', color: '#666', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>{story.messageCount} messages • Last saved: {new Date(story.lastSaved).toLocaleString()}</span>
                      {storageKeysLoaded && (() => {
                        const location = getStoryStorageLocation(story.id);
                        if (location === 'both') {
                          return <span style={{ background: '#16a34a', color: '#fff', padding: '2px 6px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 'bold' }}>💾 Local + Cloud</span>;
                        } else if (location === 'local') {
                          return <span style={{ background: '#ea580c', color: '#fff', padding: '2px 6px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 'bold' }}>💾 Local only</span>;
                        } else if (location === 'cloud') {
                          return <span style={{ background: '#6366f1', color: '#fff', padding: '2px 6px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 'bold' }}>☁️ Cloud only</span>;
                        } else if (location === 'unknown') {
                          return <span style={{ background: '#dc2626', color: '#fff', padding: '2px 6px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 'bold' }}>⚠️ Not found</span>;
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {story.id !== currentStoryId && (
                      <button onClick={() => switchStory(story.id)} style={{ background: '#141413', border: 'none', color: '#faf9f5', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Open</button>
                    )}
                    {story.id === currentStoryId && (
                      <span style={{ color: '#22c55e', fontSize: '0.85rem', padding: '6px 12px' }}>• Active</span>
                    )}
                    <button onClick={() => { 
                      console.log('Delete button clicked!', story.id, story.name); 
                      showConfirmDialog(`Delete "${story.name}"? This cannot be undone.`, () => deleteStory(story.id));
                    }} style={{ background: 'transparent', border: '1px solid #dc2626', color: '#dc2626', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowStoryManager(false)} style={{ marginTop: '16px', background: '#141413', border: 'none', color: '#faf9f5', padding: '12px', borderRadius: '6px', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}
      
      {showStorageBrowser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', zIndex: 300 }}>
          <div style={{ background: '#faf9f5', borderRadius: '12px', padding: '24px', maxWidth: '700px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', border: '1px solid #141413' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, color: '#141413' }}>Storage Browser</h2>
              <button onClick={loadAllStorageKeys} disabled={storageKeysLoading} style={{ background: 'transparent', border: '1px solid #141413', color: '#141413', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', opacity: storageKeysLoading ? 0.5 : 1 }}>
                {storageKeysLoading ? '⏳' : '🔄'} Refresh
              </button>
            </div>
            {storageKeysLoading ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '40px' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid #d0cec6', borderTopColor: '#141413', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <p style={{ color: '#666', fontSize: '0.9rem' }}>Loading storage keys...</p>
              </div>
            ) : (
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                    localStorage ({allStorageKeys.local.filter(k => showAllLocalKeys || k.key.startsWith('cyoa-')).length} keys)
                    {allStorageKeys.local.length > 0 && (
                      <span style={{ marginLeft: '8px', color: '#999', fontSize: '0.8rem' }}>
                        Total: {formatBytes(allStorageKeys.local.reduce((sum, k) => sum + k.size, 0))} / ~5MB
                      </span>
                    )}
                  </h3>
                  <button onClick={() => setShowAllLocalKeys(!showAllLocalKeys)} style={{ background: 'transparent', border: '1px solid #141413', color: '#141413', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>
                    {showAllLocalKeys ? 'Show CYOA only' : 'Show ALL keys'}
                  </button>
                </div>
                {allStorageKeys.local.length === 0 ? (
                  <p style={{ color: '#666', fontSize: '0.85rem', fontStyle: 'italic' }}>No keys found</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {allStorageKeys.local.filter(k => showAllLocalKeys || k.key.startsWith('cyoa-')).map(item => (
                      <div key={item.key} style={{ background: item.key.startsWith('cyoa-') ? '#fff' : '#fff9e6', border: `1px solid ${item.key.startsWith('cyoa-') ? '#d0cec6' : '#f59e0b'}`, borderRadius: '6px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#141413', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.key}
                            {!item.key.startsWith('cyoa-') && <span style={{ marginLeft: '6px', color: '#f59e0b', fontSize: '0.7rem' }}>⚠️ Other app</span>}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#666' }}>{formatBytes(item.size)}</div>
                        </div>
                        <button onClick={() => { 
                          console.log('Storage delete button clicked!', item.key); 
                          showConfirmDialog(`Delete "${item.key}" from localStorage? This cannot be undone.`, () => deleteStorageKey(item.key, 'local'));
                        }} disabled={deletingKey === item.key} style={{ background: 'transparent', border: '1px solid #dc2626', color: '#dc2626', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', opacity: deletingKey === item.key ? 0.5 : 1 }}>{deletingKey === item.key ? '⏳' : 'Delete'}</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#666' }}>Claude Storage ({allStorageKeys.cloud.length} keys)</h3>
                {allStorageKeys.cloud.length === 0 ? (
                  <p style={{ color: '#666', fontSize: '0.85rem', fontStyle: 'italic' }}>No keys found</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {allStorageKeys.cloud.map(item => (
                      <div key={item.key} style={{ background: '#fff', border: '1px solid #d0cec6', borderRadius: '6px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#141413', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.key}</div>
                          <div style={{ fontSize: '0.75rem', color: '#666' }}>{formatBytes(item.size)}</div>
                        </div>
                        <button onClick={() => { 
                          console.log('Cloud delete button clicked!', item.key); 
                          showConfirmDialog(`Delete "${item.key}" from Claude storage? This cannot be undone.`, () => deleteStorageKey(item.key, 'cloud'));
                        }} disabled={deletingKey === item.key} style={{ background: 'transparent', border: '1px solid #dc2626', color: '#dc2626', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', opacity: deletingKey === item.key ? 0.5 : 1 }}>{deletingKey === item.key ? '⏳' : 'Delete'}</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            )}
            <button onClick={() => setShowStorageBrowser(false)} style={{ marginTop: '16px', background: '#141413', border: 'none', color: '#faf9f5', padding: '12px', borderRadius: '6px', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}
      
      {/* Confirmation Modal */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', zIndex: 500 }}>
          <div style={{ background: '#faf9f5', borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '100%', border: '1px solid #141413' }}>
            <h2 style={{ margin: '0 0 16px 0', color: '#141413', fontSize: '1.2rem' }}>Confirm</h2>
            <p style={{ color: '#666', marginBottom: '24px', lineHeight: 1.6 }}>{confirmMessage}</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={handleConfirmNo} style={{ background: 'transparent', border: '1px solid #d0cec6', color: '#141413', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleConfirmYes} style={{ background: '#dc2626', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
