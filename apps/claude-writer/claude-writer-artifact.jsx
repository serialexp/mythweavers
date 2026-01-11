import { useState, useRef, useEffect, useCallback } from "react";

// MythWeavers API configuration
const MYTHWEAVERS_API = "https://api.mythweavers.io";

export default function App() {
  const [memory, setMemory] = useState(
    "# Adventure Memory\n\n*Edit this to track important details.*",
  );
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMemoryUpdate, setShowMemoryUpdate] = useState(false);
  const [suggestedMemory, setSuggestedMemory] = useState("");
  const [messagesSinceUpdate, setMessagesSinceUpdate] = useState(0);
  const [showMemoryPanel, setShowMemoryPanel] = useState(true);
  const [toolStatus, setToolStatus] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);
  const [editText, setEditText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [screen, setScreen] = useState("setup");
  const [adventurePitch, setAdventurePitch] = useState("");
  const [pitchLoading, setPitchLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [storageUsed, setStorageUsed] = useState(0);
  const [tokenCount, setTokenCount] = useState(null);
  const [compactions, setCompactions] = useState({});
  const [expandedCompactions, setExpandedCompactions] = useState({});
  const [compactingKeys, setCompactingKeys] = useState(new Set());
  const [protagonist, setProtagonist] = useState("");
  const [alwaysInstructions, setAlwaysInstructions] = useState("");
  const messagesEndRef = useRef(null);

  // MythWeavers Auth State
  const [mwAccessToken, setMwAccessToken] = useState(null);
  const [mwUser, setMwUser] = useState(null);
  const [showMwAuth, setShowMwAuth] = useState(false);
  const [mwAuthStatus, setMwAuthStatus] = useState("idle"); // idle, polling, connected, error
  const [mwDeviceCode, setMwDeviceCode] = useState(null);
  const [mwUserCode, setMwUserCode] = useState(null);
  const [mwVerificationUri, setMwVerificationUri] = useState(null);
  const [mwAuthError, setMwAuthError] = useState("");
  const pollIntervalRef = useRef(null);

  // MythWeavers Adventure Sync State
  const [mwAdventureId, setMwAdventureId] = useState(null);
  const [mwAdventures, setMwAdventures] = useState([]);
  const [showMwAdventures, setShowMwAdventures] = useState(false);
  const [mwSyncStatus, setMwSyncStatus] = useState(""); // "", "saving", "saved", "error"
  const mwSaveTimeoutRef = useRef(null);

  const MAX_STORAGE = 5 * 1024 * 1024;
  const VERBATIM_COUNT = 30; // Keep more messages verbatim to reduce compaction frequency

  useEffect(() => {
    const loadSaved = async () => {
      try {
        // Try localStorage first (persists across artifact versions)
        let data = null;
        const localData = localStorage.getItem("cyoa-adventure");
        if (localData) {
          data = JSON.parse(localData);
          console.log("Loaded from localStorage");
        } else {
          // Fall back to Claude storage
          const saved = await window.storage.get("cyoa-adventure");
          if (saved && saved.value) {
            data = JSON.parse(saved.value);
            console.log("Loaded from Claude storage");
          }
        }

        if (data) {
          setStorageUsed(new Blob([JSON.stringify(data)]).size);
          setMessages(data.messages || []);
          setMemory(data.memory || memory);
          setCompactions(data.compactions || {});
          setProtagonist(data.protagonist || "");
          setAlwaysInstructions(data.alwaysInstructions || "");
          setAdventurePitch(data.pitch || "");
          setMessagesSinceUpdate(data.messagesSinceUpdate || 0);
          if (data.messages?.length > 0) setScreen("adventure");
          setSaveStatus("Loaded");
          setTimeout(() => setSaveStatus(""), 2000);
        }
      } catch (e) {
        console.log("No saved adventure:", e);
      }
    };
    loadSaved();
  }, []);

  // Load MythWeavers token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("mw-access-token");
    if (savedToken) {
      setMwAccessToken(savedToken);
      // Verify the token is still valid
      checkMwAuth(savedToken);
    }
  }, []);

  // Check if MythWeavers token is valid
  const checkMwAuth = async (token) => {
    try {
      const res = await fetch(`${MYTHWEAVERS_API}/auth/session`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setMwUser(data.user);
          setMwAuthStatus("connected");
          // Load adventures list
          loadMwAdventures(token);
          return true;
        }
      }
      // Token invalid, clear it
      localStorage.removeItem("mw-access-token");
      setMwAccessToken(null);
      setMwUser(null);
      setMwAuthStatus("idle");
      return false;
    } catch (e) {
      console.error("MythWeavers auth check failed:", e);
      return false;
    }
  };

  // Start MythWeavers device flow
  const startMwAuth = async () => {
    setMwAuthError("");
    setMwAuthStatus("polling");
    try {
      const res = await fetch(`${MYTHWEAVERS_API}/oauth/device`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to start device flow");
      const data = await res.json();
      setMwDeviceCode(data.device_code);
      setMwUserCode(data.user_code);
      setMwVerificationUri(data.verification_uri);

      // Start polling for token
      pollIntervalRef.current = setInterval(() => {
        pollMwToken(data.device_code);
      }, 5000);
    } catch (e) {
      setMwAuthError(e.message);
      setMwAuthStatus("error");
    }
  };

  // Poll for MythWeavers token
  const pollMwToken = async (deviceCode) => {
    try {
      const res = await fetch(`${MYTHWEAVERS_API}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: deviceCode,
        }),
      });
      const data = await res.json();

      if (data.access_token) {
        // Success! Stop polling and save token
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        localStorage.setItem("mw-access-token", data.access_token);
        setMwAccessToken(data.access_token);
        setMwAuthStatus("connected");
        setShowMwAuth(false);
        // Get user info
        checkMwAuth(data.access_token);
      } else if (data.error === "expired_token") {
        // Device code expired
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setMwAuthError("Code expired. Please try again.");
        setMwAuthStatus("error");
      }
      // If authorization_pending, just keep polling
    } catch (e) {
      console.error("Token poll error:", e);
    }
  };

  // Disconnect from MythWeavers
  const disconnectMw = () => {
    localStorage.removeItem("mw-access-token");
    setMwAccessToken(null);
    setMwUser(null);
    setMwAuthStatus("idle");
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // Cancel auth flow
  const cancelMwAuth = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setShowMwAuth(false);
    setMwAuthStatus("idle");
    setMwDeviceCode(null);
    setMwUserCode(null);
    setMwAuthError("");
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (mwSaveTimeoutRef.current) {
        clearTimeout(mwSaveTimeoutRef.current);
      }
    };
  }, []);

  // Load adventures list when connected
  const loadMwAdventures = async (token) => {
    try {
      const res = await fetch(`${MYTHWEAVERS_API}/my/adventures`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMwAdventures(data.adventures || []);
      }
    } catch (e) {
      console.error("Failed to load adventures:", e);
    }
  };

  // Save adventure to MythWeavers
  const saveToMythWeavers = async (adventureData, adventureId = null) => {
    if (!mwAccessToken) return null;

    setMwSyncStatus("saving");
    try {
      const url = adventureId
        ? `${MYTHWEAVERS_API}/my/adventures/${adventureId}`
        : `${MYTHWEAVERS_API}/my/adventures`;

      const res = await fetch(url, {
        method: adventureId ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${mwAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: adventureData.pitch?.slice(0, 100) || "Untitled Adventure",
          data: adventureData,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMwSyncStatus("saved");
        setTimeout(() => setMwSyncStatus(""), 2000);
        return data.adventure;
      } else {
        setMwSyncStatus("error");
        setTimeout(() => setMwSyncStatus(""), 3000);
        return null;
      }
    } catch (e) {
      console.error("Failed to save to MythWeavers:", e);
      setMwSyncStatus("error");
      setTimeout(() => setMwSyncStatus(""), 3000);
      return null;
    }
  };

  // Load adventure from MythWeavers
  const loadFromMythWeavers = async (adventureId) => {
    if (!mwAccessToken) return;

    try {
      const res = await fetch(`${MYTHWEAVERS_API}/my/adventures/${adventureId}`, {
        headers: { Authorization: `Bearer ${mwAccessToken}` },
      });

      if (res.ok) {
        const { adventure } = await res.json();
        const data = adventure.data;

        // Load all the state
        setMessages(data.messages || []);
        setMemory(data.memory || "# Adventure Memory\n\n*Edit this to track important details.*");
        setCompactions(data.compactions || {});
        setProtagonist(data.protagonist || "");
        setAlwaysInstructions(data.alwaysInstructions || "");
        setAdventurePitch(data.pitch || "");
        setMessagesSinceUpdate(data.messagesSinceUpdate || 0);
        setMwAdventureId(adventureId);
        setShowMwAdventures(false);

        if (data.messages?.length > 0) {
          setScreen("adventure");
        }

        setSaveStatus(`Loaded from MythWeavers`);
        setTimeout(() => setSaveStatus(""), 2000);
      }
    } catch (e) {
      console.error("Failed to load from MythWeavers:", e);
    }
  };

  // Delete adventure from MythWeavers
  const deleteFromMythWeavers = async (adventureId) => {
    if (!mwAccessToken) return;

    try {
      const res = await fetch(`${MYTHWEAVERS_API}/my/adventures/${adventureId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${mwAccessToken}` },
      });

      if (res.ok) {
        setMwAdventures((prev) => prev.filter((a) => a.id !== adventureId));
        if (mwAdventureId === adventureId) {
          setMwAdventureId(null);
        }
      }
    } catch (e) {
      console.error("Failed to delete from MythWeavers:", e);
    }
  };

  useEffect(() => {
    if (messages.length === 0) return;

    const adventureData = {
      messages,
      memory,
      compactions,
      protagonist,
      alwaysInstructions,
      pitch: adventurePitch,
      messagesSinceUpdate,
      savedAt: new Date().toISOString(),
    };

    // Debounce saves to avoid excessive writes
    const timeoutId = setTimeout(async () => {
      try {
        const saveData = JSON.stringify(adventureData);
        setStorageUsed(new Blob([saveData]).size);

        // Save to both localStorage and Claude storage
        localStorage.setItem("cyoa-adventure", saveData);
        await window.storage.set("cyoa-adventure", saveData);

        setSaveStatus("Saved");
        setTimeout(() => setSaveStatus(""), 1500);
      } catch (e) {
        console.error("Save error:", e);
        setSaveStatus("Save failed!");
      }
    }, 500); // 500ms debounce

    // Also sync to MythWeavers with longer debounce
    if (mwAccessToken) {
      if (mwSaveTimeoutRef.current) {
        clearTimeout(mwSaveTimeoutRef.current);
      }
      mwSaveTimeoutRef.current = setTimeout(async () => {
        const result = await saveToMythWeavers(adventureData, mwAdventureId);
        if (result && !mwAdventureId) {
          setMwAdventureId(result.id);
        }
      }, 2000); // 2s debounce for cloud saves
    }

    return () => {
      clearTimeout(timeoutId);
      if (mwSaveTimeoutRef.current) {
        clearTimeout(mwSaveTimeoutRef.current);
      }
    };
  }, [
    messages,
    memory,
    compactions,
    protagonist,
    alwaysInstructions,
    adventurePitch,
    messagesSinceUpdate,
    mwAccessToken,
    mwAdventureId,
  ]);

  // Estimate total tokens that would be sent
  useEffect(() => {
    if (messages.length === 0) {
      setTokenCount(null);
      return;
    }

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

    setTokenCount(Math.ceil(totalChars / 5)); // ~5 chars per token
  }, [messages, memory, compactions]);

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatMessageText = (text) => {
    // Split into paragraphs on double linebreaks
    const paragraphs = text.split("\n\n").filter((p) => p.trim());

    return paragraphs.map((para, i) => {
      // Replace **text** with bold and *text* with italic
      const parts = [];
      let lastIndex = 0;
      // Match **text** (bold) or *text* (italic) - bold must come first in regex to match before single *
      const regex = /(\*\*.*?\*\*|\*.*?\*)/g;
      let match;

      while ((match = regex.exec(para)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
          parts.push(para.substring(lastIndex, match.index));
        }

        const matchedText = match[1];
        if (matchedText.startsWith("**") && matchedText.endsWith("**")) {
          // Bold text
          const content = matchedText.slice(2, -2);
          parts.push(
            <strong key={`bold-${i}-${match.index}`}>{content}</strong>,
          );
        } else if (matchedText.startsWith("*") && matchedText.endsWith("*")) {
          // Italic text
          const content = matchedText.slice(1, -1);
          parts.push(<em key={`em-${i}-${match.index}`}>{content}</em>);
        }

        lastIndex = match.index + match[0].length;
      }
      // Add remaining text
      if (lastIndex < para.length) {
        parts.push(para.substring(lastIndex));
      }

      return (
        <p key={i} style={{ margin: "0 0 12px 0" }}>
          {parts.length > 0 ? parts : para}
        </p>
      );
    });
  };

  const formatBytes = (b) =>
    b < 1024
      ? `${b} B`
      : b < 1024 * 1024
        ? `${(b / 1024).toFixed(1)} KB`
        : `${(b / (1024 * 1024)).toFixed(2)} MB`;
  const formatTokens = (t) =>
    typeof t === "string"
      ? t
      : t >= 1e6
        ? `${(t / 1e6).toFixed(1)}M`
        : t >= 1e3
          ? `${(t / 1e3).toFixed(1)}K`
          : t;
  const storagePercent = (storageUsed / MAX_STORAGE) * 100;

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

  // Rough token estimate: ~5 chars per token (calibrated against actual API counts)
  const estimateTokens = (text) => Math.ceil(text.length / 5);

  // Build messages to send to Claude: compacted summaries + recent verbatim
  // Add cache breakpoints using content block format
  const buildApiMessages = (msgs) => {
    const apiMessages = [];
    const ranges = getCompactionRanges();
    const recentStart = Math.max(0, msgs.length - VERBATIM_COUNT);

    // Find last compacted section (that has a summary)
    const compactedRanges = ranges.filter((r) => compactions[r.key]?.summary);
    const lastCompactedIdx = compactedRanges.length - 1;

    // Add compacted summaries or original messages for older content
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i];
      const comp = compactions[range.key];
      if (comp?.summary) {
        // Use the compacted summary
        const compactedIdx = compactedRanges.findIndex(
          (r) => r.key === range.key,
        );
        const isLastCompacted = compactedIdx === lastCompactedIdx;

        apiMessages.push({
          role: "user",
          content: isLastCompacted
            ? [
                {
                  type: "text",
                  text: `[Previous events summary]: ${comp.summary}`,
                  cache_control: { type: "ephemeral" },
                },
              ]
            : `[Previous events summary]: ${comp.summary}`,
        });
        apiMessages.push({
          role: "assistant",
          content: "[Acknowledged - continuing story]",
        });
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
      if (positionFromEnd >= 1 && positionFromEnd <= 3) {
        apiMessages.push({
          role: m.role,
          content: [
            {
              type: "text",
              text: m.content,
              cache_control: { type: "ephemeral" },
            },
          ],
        });
      } else {
        apiMessages.push({ role: m.role, content: m.content });
      }
    }

    return apiMessages;
  };

  const generateCompaction = async (key) => {
    const [start, end] = key.split("-").map(Number);
    const rangeMessages = messages.slice(start, end + 1);
    setCompactingKeys((prev) => new Set([...prev, key]));
    try {
      const protagonistInstruction = protagonist
        ? `The protagonist is named "${protagonist}". Use this name when referring to the player character (not "you" or "the player").`
        : 'Refer to the player character as "the protagonist" or use context clues for their name.';

      const customInstructions = alwaysInstructions
        ? `\nADDITIONAL CONTEXT:\n${alwaysInstructions}\n`
        : "";

      const system = `${customInstructions}You are summarizing a section of a choose-your-own-adventure story. Your task is to create a comprehensive summary that captures ALL events from the ENTIRE section, from beginning to end.

${protagonistInstruction}

IMPORTANT RULES:
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

Write 2-4 paragraphs as a flowing narrative summary in present tense. Be thorough - this summary will replace the original messages.`;

      const originalContent = rangeMessages
        .map(
          (m, i) =>
            `[${i + 1}/${rangeMessages.length}] ${m.role === "user" ? "PLAYER" : "NARRATOR"}: ${m.content}`,
        )
        .join("\n\n---\n\n");

      const tokensBefore = estimateTokens(originalContent);

      const response = await callClaude(
        [
          {
            role: "user",
            content: `Summarize ALL events in this story section (${rangeMessages.length} messages):\n\n${originalContent}`,
          },
        ],
        system,
        null,
      );

      const tokensAfter = estimateTokens(response);

      setCompactions((prev) => ({
        ...prev,
        [key]: {
          summary: response,
          generatedAt: new Date().toISOString(),
          tokensBefore,
          tokensAfter,
        },
      }));
    } catch (e) {
      console.error("Compaction failed:", e);
    }
    setCompactingKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const toggleCompactionExpand = (key) =>
    setExpandedCompactions((prev) => ({ ...prev, [key]: !prev[key] }));

  const compactionRanges = getCompactionRanges();
  const uncompactedCount = compactionRanges.filter(
    (r) => !compactions[r.key],
  ).length;

  // Calculate total token savings
  const totalTokensBefore = compactionRanges.reduce(
    (sum, r) => sum + (compactions[r.key]?.tokensBefore || 0),
    0,
  );
  const totalTokensAfter = compactionRanges.reduce(
    (sum, r) => sum + (compactions[r.key]?.tokensAfter || 0),
    0,
  );
  const totalSaved = totalTokensBefore - totalTokensAfter;

  const compactAll = async () => {
    const toCompact = compactionRanges.filter((r) => !compactions[r.key]);
    // Start all compactions in parallel
    await Promise.all(toCompact.map((range) => generateCompaction(range.key)));
  };

  const getRandomName = async (gender, count = 1) => {
    try {
      const genderParam =
        gender && gender !== "neutral" ? `&gender=${gender}` : "";
      const res = await fetch(
        `https://randomuser.me/api/?nat=us,gb,fr,de,es,au,br,ca,mx,nz&inc=name&results=${count}${genderParam}`,
      );
      const data = await res.json();
      const names = data.results.map((r) => `${r.name.first} ${r.name.last}`);
      return count === 1 ? names[0] : names.join(", ");
    } catch (e) {
      return count === 1 ? "Alex Chen" : "Alex Chen, Jordan Santos";
    }
  };

  const tools = [
    {
      name: "random_name",
      description: "Generate random character name(s).",
      input_schema: {
        type: "object",
        properties: {
          gender: { type: "string", enum: ["male", "female", "neutral"] },
          count: { type: "integer", minimum: 1, maximum: 10 },
        },
      },
    },
  ];

  const callClaude = async (msgs, system, onToolCall) => {
    let messages = [...msgs];
    while (true) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system,
          messages,
          tools,
        }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const toolUse = data.content?.find((b) => b.type === "tool_use");
      if (toolUse?.name === "random_name") {
        const count = toolUse.input?.count || 1;
        if (onToolCall)
          onToolCall(
            `ðŸŽ² Generating ${count > 1 ? count + " names" : "name"}...`,
          );
        const names = await getRandomName(toolUse.input?.gender, count);
        if (onToolCall) onToolCall(`ðŸŽ² Generated: ${names}`);
        messages = [
          ...messages,
          { role: "assistant", content: data.content },
          {
            role: "user",
            content: [
              { type: "tool_result", tool_use_id: toolUse.id, content: names },
            ],
          },
        ];
      } else {
        return (
          data.content
            ?.map((b) => b.text || "")
            .filter(Boolean)
            .join("\n") || "No response"
        );
      }
    }
  };

  const genres = [
    "Fantasy",
    "Sci-Fi",
    "Horror",
    "Mystery",
    "Post-Apocalyptic",
    "Noir",
    "Steampunk",
    "Supernatural",
    "Thriller",
    "Western",
  ];

  const generatePitch = async () => {
    setPitchLoading(true);
    const genre = genres[Math.floor(Math.random() * genres.length)];
    const customInstructions = alwaysInstructions
      ? `${alwaysInstructions}\n\n`
      : "";
    try {
      setToolStatus("");
      const response = await callClaude(
        [{ role: "user", content: `Generate a ${genre} adventure pitch.` }],
        `${customInstructions}Generate pitch:\n\n**Genre:** [genre]\n**Character:** [One sentence]\n\nUse random_name tool.`,
        setToolStatus,
      );
      setToolStatus("");
      setAdventurePitch(response);
    } catch (e) {
      setAdventurePitch(`Error: ${e.message}`);
    }
    setPitchLoading(false);
  };

  const startFromPitch = async () => {
    setLoading(true);
    setScreen("adventure");
    setMessages([]);
    setMessagesSinceUpdate(0);
    const customInstructions = alwaysInstructions
      ? `${alwaysInstructions}\n\n`
      : "";
    try {
      setToolStatus("");
      const response = await callClaude(
        [{ role: "user", content: "Begin this adventure." }],
        `${customInstructions}Narrator. Start based on:\n\n${adventurePitch}\n\n2-3 paragraphs. Use random_name for new characters.`,
        setToolStatus,
      );
      setToolStatus("");
      setMessages([{ role: "assistant", content: response }]);
    } catch (e) {
      setMessages([{ role: "assistant", content: `Error: ${e.message}` }]);
    }
    setLoading(false);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    const customInstructions = alwaysInstructions
      ? `${alwaysInstructions}\n\n`
      : "";
    try {
      setToolStatus("");
      const apiMessages = buildApiMessages(newMsgs);
      const response = await callClaude(
        apiMessages,
        `${customInstructions}Narrator. 2-3 paragraphs. Use random_name for new characters.\n\n## MEMORY:\n${memory}`,
        setToolStatus,
      );
      setToolStatus("");
      const updated = [...newMsgs, { role: "assistant", content: response }];
      setMessages(updated);
      const newCount = messagesSinceUpdate + 1;
      setMessagesSinceUpdate(newCount);
      if (newCount >= 10) triggerMemoryUpdate(updated);
    } catch (e) {
      setMessages([
        ...newMsgs,
        { role: "assistant", content: `Error: ${e.message}` },
      ]);
    }
    setLoading(false);
  };

  const regenerateFrom = async (index, newText = null) => {
    if (loading) return;
    let newMsgs =
      newText !== null
        ? [...messages.slice(0, index), { role: "user", content: newText }]
        : messages.slice(0, index + 1);
    setMessages(newMsgs);
    setEditingIndex(null);
    setEditText("");
    setLoading(true);
    const customInstructions = alwaysInstructions
      ? `${alwaysInstructions}\n\n`
      : "";
    try {
      setToolStatus("");
      const apiMessages = buildApiMessages(newMsgs);
      const response = await callClaude(
        apiMessages,
        `${customInstructions}Narrator. 2-3 paragraphs. Use random_name.\n\n## MEMORY:\n${memory}`,
        setToolStatus,
      );
      setToolStatus("");
      setMessages([...newMsgs, { role: "assistant", content: response }]);
    } catch (e) {
      setMessages([
        ...newMsgs,
        { role: "assistant", content: `Error: ${e.message}` },
      ]);
    }
    setLoading(false);
  };

  const triggerMemoryUpdate = async (allMsgs) => {
    const last10 = allMsgs.slice(-10);
    const customInstructions = alwaysInstructions
      ? `${alwaysInstructions}\n\n`
      : "";
    try {
      const response = await callClaude(
        [
          ...last10,
          {
            role: "user",
            content: `Current memory:\n${memory}\n\nUpdate based on recent events.`,
          },
        ],
        `${customInstructions}Update memory doc. Return ONLY updated memory.`,
        null,
      );
      setSuggestedMemory(response);
      setShowMemoryUpdate(true);
    } catch (e) {
      console.error("Memory update failed:", e);
    }
  };

  const triggerFullMemoryUpdate = async () => {
    const customInstructions = alwaysInstructions
      ? `${alwaysInstructions}\n\n`
      : "";
    const apiMessages = buildApiMessages(messages);
    try {
      const system = `${customInstructions}You are creating a comprehensive story memory document based on the ENTIRE story so far.

Create a well-organized memory document that includes:
- Protagonist details (name, abilities, personality, current state)
- Key relationships and NPCs (with names and their role)
- Current situation and immediate goals
- Major plot points and story arc
- Important locations
- Inventory/possessions if relevant
- Unresolved threads or mysteries
- Any rules or world-building established

Be thorough but concise. This document will be used to maintain continuity. Return ONLY the memory document.`;

      const response = await callClaude(
        [
          ...apiMessages,
          {
            role: "user",
            content: `Current memory:\n${memory}\n\nCreate a comprehensive updated memory based on the full story context above.`,
          },
        ],
        system,
        null,
      );
      setSuggestedMemory(response);
      setShowMemoryUpdate(true);
    } catch (e) {
      console.error("Full memory update failed:", e);
    }
  };

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportError("");
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const importedMessages = [];

      console.log("Import keys:", Object.keys(data));

      if (data.chat_messages && Array.isArray(data.chat_messages)) {
        console.log("Claude format, messages:", data.chat_messages.length);

        const msgMap = {};
        for (const msg of data.chat_messages) msgMap[msg.uuid] = msg;

        let leafUuid = data.current_leaf_message_uuid;
        if (!leafUuid || !msgMap[leafUuid]) {
          const childCount = {};
          for (const msg of data.chat_messages) {
            if (
              msg.parent_message_uuid &&
              msg.parent_message_uuid !== "00000000-0000-4000-8000-000000000000"
            ) {
              childCount[msg.parent_message_uuid] =
                (childCount[msg.parent_message_uuid] || 0) + 1;
            }
          }
          const leaves = data.chat_messages.filter((m) => !childCount[m.uuid]);
          leaves.sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at),
          );
          leafUuid = leaves[0]?.uuid;
        }

        console.log("Leaf:", leafUuid);
        if (!leafUuid || !msgMap[leafUuid])
          throw new Error("Could not find conversation end");

        const chain = [];
        let cur = msgMap[leafUuid];
        const rootUuid = "00000000-0000-4000-8000-000000000000";
        while (cur) {
          chain.push(cur);
          cur =
            cur.parent_message_uuid && cur.parent_message_uuid !== rootUuid
              ? msgMap[cur.parent_message_uuid]
              : null;
        }
        console.log("Chain length:", chain.length);
        chain.reverse();

        for (const msg of chain) {
          const t =
            msg.content
              ?.map((c) => c.text || "")
              .filter(Boolean)
              .join("") ||
            msg.text ||
            "";
          if (t && (msg.sender === "human" || msg.sender === "assistant")) {
            importedMessages.push({
              role: msg.sender === "human" ? "user" : "assistant",
              content: t,
            });
          }
        }
      } else if (data.messages) {
        console.log("App format");
        importedMessages.push(...data.messages);
        if (data.memory) setMemory(data.memory);
        if (data.compactions) setCompactions(data.compactions);
      }

      console.log("Importing", importedMessages.length, "messages");
      if (importedMessages.length === 0) throw new Error("No messages found");

      setMessages(importedMessages);
      if (!data.compactions) setCompactions({});
      setScreen("adventure");
      setShowImport(false);
      setSaveStatus(`Imported ${importedMessages.length}`);
    } catch (e) {
      console.error(e);
      setImportError(e.message);
    }
    setImportLoading(false);
    e.target.value = "";
  };

  const clearSaved = async () => {
    try {
      await window.storage.delete("cyoa-adventure");
      localStorage.removeItem("cyoa-adventure");
    } catch (e) {}
    setMessages([]);
    setCompactions({});
    setExpandedCompactions({});
    setAdventurePitch("");
    setMemory("# Adventure Memory\n\n*Edit this to track important details.*");
    setMessagesSinceUpdate(0);
    setTokenCount(null);
    setProtagonist("");
    setAlwaysInstructions("");
    setMwAdventureId(null); // Clear MythWeavers link
    setScreen("setup");
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "Georgia, serif",
        background: "#1a1a2e",
        color: "#eee",
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.4rem", color: "#a78bfa" }}>
            Choose Your Own Adventure
          </h1>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {/* MythWeavers Sync Status */}
            {mwSyncStatus && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: mwSyncStatus === "error" ? "#ef4444" : mwSyncStatus === "saved" ? "#22c55e" : "#888",
                }}
              >
                {mwSyncStatus === "saving" ? "Syncing..." : mwSyncStatus === "saved" ? "Synced" : "Sync failed"}
              </span>
            )}
            {/* MythWeavers Connection Status */}
            {mwUser ? (
              <>
                <button
                  onClick={() => {
                    loadMwAdventures(mwAccessToken);
                    setShowMwAdventures(true);
                  }}
                  style={{
                    background: "transparent",
                    border: "1px solid #6366f1",
                    color: "#a78bfa",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                  }}
                >
                  My Adventures
                </button>
                <button
                  onClick={disconnectMw}
                  style={{
                    background: "transparent",
                    border: "1px solid #22c55e",
                    color: "#22c55e",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                  title={`Connected as ${mwUser.username}. Click to disconnect.`}
                >
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e" }} />
                  {mwUser.username}
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setShowMwAuth(true);
                  startMwAuth();
                }}
                style={{
                  background: "transparent",
                  border: "1px solid #6366f1",
                  color: "#a78bfa",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                }}
              >
                Connect MythWeavers
              </button>
            )}
            {screen === "adventure" && (
              <button
                onClick={() => setShowMemoryPanel(!showMemoryPanel)}
                style={{
                  background: "#4c1d95",
                  border: "none",
                  color: "#eee",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                {showMemoryPanel ? "Hide" : "Show"} Memory
              </button>
            )}
          </div>
        </div>

        {screen === "setup" ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: "20px",
              padding: "20px",
            }}
          >
            <p style={{ color: "#a78bfa" }}>
              Generate a random adventure pitch or write your own:
            </p>
            <textarea
              value={adventurePitch}
              onChange={(e) => setAdventurePitch(e.target.value)}
              placeholder="Click 'Random Pitch' or write your own..."
              style={{
                width: "100%",
                maxWidth: "500px",
                height: "120px",
                background: "#16213e",
                border: "1px solid #4c1d95",
                color: "#eee",
                padding: "12px",
                borderRadius: "6px",
                resize: "none",
                fontFamily: "inherit",
              }}
            />
            {toolStatus && (
              <p style={{ color: "#a78bfa", fontSize: "0.85rem" }}>
                {toolStatus}
              </p>
            )}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                onClick={generatePitch}
                disabled={pitchLoading}
                style={{
                  background: "#4c1d95",
                  border: "none",
                  color: "#fff",
                  padding: "12px 24px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  opacity: pitchLoading ? 0.5 : 1,
                }}
              >
                {pitchLoading ? "Generating..." : "ðŸŽ² Random Pitch"}
              </button>
              <button
                onClick={startFromPitch}
                disabled={loading || !adventurePitch.trim()}
                style={{
                  background: "#7c3aed",
                  border: "none",
                  color: "#fff",
                  padding: "12px 24px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  opacity: loading || !adventurePitch.trim() ? 0.5 : 1,
                }}
              >
                {loading ? "Starting..." : "â–¶ Start"}
              </button>
              <button
                onClick={() => setShowImport(true)}
                style={{
                  background: "transparent",
                  border: "1px solid #4c1d95",
                  color: "#a78bfa",
                  padding: "12px 24px",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                ðŸ“¥ Import
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                background: "#16213e",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "12px",
              }}
            >
              {compactionRanges.map(({ start, end, key }) => {
                const comp = compactions[key];
                const expanded = expandedCompactions[key];
                const ratio =
                  comp?.tokensBefore && comp?.tokensAfter
                    ? (
                        (1 - comp.tokensAfter / comp.tokensBefore) *
                        100
                      ).toFixed(0)
                    : null;
                return (
                  <div
                    key={key}
                    style={{
                      marginBottom: "16px",
                      border: "1px solid #4c1d95",
                      borderRadius: "8px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      onClick={() => toggleCompactionExpand(key)}
                      style={{
                        padding: "12px",
                        background: "#1a1a2e",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ color: "#a78bfa", fontSize: "0.85rem" }}>
                        ðŸ“¦ Messages {start + 1}-{end + 1}
                        {comp?.tokensBefore && comp?.tokensAfter && (
                          <span
                            style={{
                              marginLeft: "8px",
                              color: "#22c55e",
                              fontSize: "0.75rem",
                            }}
                          >
                            {comp.tokensBefore}â†’{comp.tokensAfter} ({ratio}%
                            saved)
                          </span>
                        )}
                      </span>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                        }}
                      >
                        {!comp && (
                          <span
                            style={{ color: "#f59e0b", fontSize: "0.75rem" }}
                          >
                            Needs compaction
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            generateCompaction(key);
                          }}
                          disabled={compactingKeys.has(key)}
                          style={{
                            background: "#4c1d95",
                            border: "none",
                            color: "#eee",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "0.75rem",
                          }}
                        >
                          {compactingKeys.has(key) ? "â³" : "ðŸ”„"}
                        </button>
                        <span style={{ color: "#666" }}>
                          {expanded ? "â–¼" : "â–¶"}
                        </span>
                      </div>
                    </div>
                    {comp && !expanded && (
                      <div
                        style={{
                          padding: "12px",
                          borderTop: "1px solid #4c1d95",
                        }}
                      >
                        <div
                          style={{
                            lineHeight: 1.6,
                            color: "#ccc",
                            fontStyle: "italic",
                          }}
                        >
                          {formatMessageText(comp.summary)}
                        </div>
                      </div>
                    )}
                    {expanded && (
                      <div
                        style={{
                          padding: "12px",
                          borderTop: "1px solid #4c1d95",
                          maxHeight: "400px",
                          overflowY: "auto",
                        }}
                      >
                        {comp && (
                          <div
                            style={{
                              marginBottom: "12px",
                              padding: "8px",
                              background: "#1a1a2e",
                              borderRadius: "4px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "#a78bfa",
                                marginBottom: "4px",
                              }}
                            >
                              SUMMARY
                            </div>
                            <div style={{ color: "#ccc", fontStyle: "italic" }}>
                              {formatMessageText(comp.summary)}
                            </div>
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#a78bfa",
                            marginBottom: "8px",
                          }}
                        >
                          ORIGINAL
                        </div>
                        {messages.slice(start, end + 1).map((m, i) => (
                          <div
                            key={i}
                            style={{
                              marginBottom: "8px",
                              padding: "8px",
                              background:
                                m.role === "user" ? "#1e3a5f" : "transparent",
                              borderRadius: "4px",
                              fontSize: "0.85rem",
                            }}
                          >
                            <div>{formatMessageText(m.content)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {messages
                .slice(Math.max(0, messages.length - VERBATIM_COUNT))
                .map((m, i) => {
                  const idx = Math.max(0, messages.length - VERBATIM_COUNT) + i;
                  return (
                    <div
                      key={idx}
                      style={{
                        marginBottom: "16px",
                        padding: "12px",
                        background:
                          m.role === "user" ? "#1e3a5f" : "transparent",
                        borderRadius: "6px",
                        borderLeft:
                          m.role === "user" ? "3px solid #7c3aed" : "none",
                      }}
                    >
                      {m.role === "user" && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "4px",
                          }}
                        >
                          <span
                            style={{ fontSize: "0.75rem", color: "#a78bfa" }}
                          >
                            YOU
                          </span>
                          {!loading && editingIndex !== idx && (
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button
                                onClick={() => {
                                  setEditingIndex(idx);
                                  setEditText(m.content);
                                }}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "#a78bfa",
                                  cursor: "pointer",
                                  fontSize: "0.7rem",
                                }}
                              >
                                âœï¸
                              </button>
                              {idx === messages.length - 2 && (
                                <button
                                  onClick={() => regenerateFrom(idx)}
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "#a78bfa",
                                    cursor: "pointer",
                                    fontSize: "0.7rem",
                                  }}
                                >
                                  ðŸ”„
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {editingIndex === idx ? (
                        <div>
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            style={{
                              width: "100%",
                              background: "#16213e",
                              border: "1px solid #7c3aed",
                              color: "#eee",
                              padding: "8px",
                              borderRadius: "4px",
                              minHeight: "60px",
                              fontFamily: "inherit",
                            }}
                          />
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              marginTop: "8px",
                            }}
                          >
                            <button
                              onClick={() =>
                                editText.trim() &&
                                regenerateFrom(idx, editText.trim())
                              }
                              style={{
                                background: "#7c3aed",
                                border: "none",
                                color: "#fff",
                                padding: "6px 12px",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                              }}
                            >
                              Submit
                            </button>
                            <button
                              onClick={() => {
                                setEditingIndex(null);
                                setEditText("");
                              }}
                              style={{
                                background: "transparent",
                                border: "1px solid #4c1d95",
                                color: "#a78bfa",
                                padding: "6px 12px",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ lineHeight: 1.6 }}>
                          {formatMessageText(m.content)}
                        </div>
                      )}
                    </div>
                  );
                })}

              {loading && (
                <div
                  style={{
                    color: "#a78bfa",
                    fontStyle: "italic",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "16px",
                      height: "16px",
                      border: "2px solid #a78bfa",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  {toolStatus || "The story unfolds..."}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="What do you do?"
                disabled={loading}
                style={{
                  flex: 1,
                  background: "#16213e",
                  border: "1px solid #4c1d95",
                  color: "#eee",
                  padding: "12px",
                  borderRadius: "6px",
                  fontSize: "1rem",
                  minHeight: "48px",
                  maxHeight: "200px",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                style={{
                  background: "#7c3aed",
                  border: "none",
                  color: "#fff",
                  padding: "12px 24px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  opacity: loading || !input.trim() ? 0.5 : 1,
                }}
              >
                Go
              </button>
            </div>

            <div
              style={{ fontSize: "0.75rem", color: "#666", marginTop: "8px" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "4px",
                }}
              >
                <span>
                  Memory: {10 - messagesSinceUpdate}
                  {tokenCount && (
                    <span style={{ marginLeft: "8px", color: "#7c3aed" }}>
                      ~{formatTokens(tokenCount)}
                    </span>
                  )}
                  {compactionRanges.length > 0 && (
                    <span
                      style={{
                        marginLeft: "8px",
                        color: uncompactedCount ? "#f59e0b" : "#22c55e",
                      }}
                    >
                      ðŸ“¦{compactionRanges.length - uncompactedCount}/
                      {compactionRanges.length}
                      {totalSaved > 0 && ` (-${formatTokens(totalSaved)})`}
                    </span>
                  )}
                  {saveStatus && (
                    <span style={{ marginLeft: "8px", color: "#a78bfa" }}>
                      â€¢ {saveStatus}
                    </span>
                  )}
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  {uncompactedCount > 0 && (
                    <button
                      onClick={compactAll}
                      disabled={compactingKeys.size > 0}
                      style={{
                        background: "transparent",
                        border: "1px solid #f59e0b",
                        color: "#f59e0b",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                      }}
                    >
                      Compact All ({uncompactedCount})
                      {compactingKeys.size > 0 && ` â³${compactingKeys.size}`}
                    </button>
                  )}
                  <button
                    onClick={clearSaved}
                    style={{
                      background: "transparent",
                      border: "1px solid #4c1d95",
                      color: "#a78bfa",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                    }}
                  >
                    New
                  </button>
                </div>
              </div>
              {storageUsed > 0 && (
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: "4px",
                      background: "#1e3a5f",
                      borderRadius: "2px",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(storagePercent, 100)}%`,
                        height: "100%",
                        background:
                          storagePercent > 80
                            ? "#ef4444"
                            : storagePercent > 50
                              ? "#f59e0b"
                              : "#a78bfa",
                      }}
                    />
                  </div>
                  <span style={{ minWidth: "80px" }}>
                    {formatBytes(storageUsed)} / 5MB
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {screen === "adventure" && showMemoryPanel && (
        <div
          style={{
            width: "280px",
            background: "#16213e",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            borderLeft: "1px solid #4c1d95",
          }}
        >
          <h2
            style={{ margin: "0 0 12px 0", fontSize: "1rem", color: "#a78bfa" }}
          >
            Memory
          </h2>
          <div style={{ marginBottom: "8px" }}>
            <label
              style={{
                fontSize: "0.75rem",
                color: "#999",
                display: "block",
                marginBottom: "4px",
              }}
            >
              Protagonist
            </label>
            <input
              value={protagonist}
              onChange={(e) => setProtagonist(e.target.value)}
              placeholder="Name..."
              style={{
                width: "100%",
                background: "#1a1a2e",
                border: "1px solid #4c1d95",
                color: "#eee",
                padding: "8px",
                borderRadius: "4px",
                fontSize: "0.85rem",
              }}
            />
          </div>
          <div style={{ marginBottom: "8px" }}>
            <label
              style={{
                fontSize: "0.75rem",
                color: "#999",
                display: "block",
                marginBottom: "4px",
              }}
            >
              Always Instructions
            </label>
            <textarea
              value={alwaysInstructions}
              onChange={(e) => setAlwaysInstructions(e.target.value)}
              placeholder="e.g., The protagonist is female. Write in a gothic style..."
              style={{
                width: "100%",
                height: "60px",
                background: "#1a1a2e",
                border: "1px solid #4c1d95",
                color: "#eee",
                padding: "8px",
                borderRadius: "4px",
                fontSize: "0.8rem",
                resize: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
          <label
            style={{
              fontSize: "0.75rem",
              color: "#999",
              display: "block",
              marginBottom: "4px",
            }}
          >
            Story Memory
          </label>
          <textarea
            value={memory}
            onChange={(e) => setMemory(e.target.value)}
            style={{
              flex: 1,
              background: "#1a1a2e",
              border: "1px solid #4c1d95",
              color: "#eee",
              padding: "12px",
              borderRadius: "6px",
              resize: "none",
              fontFamily: "inherit",
              fontSize: "0.85rem",
            }}
          />
          <div style={{ display: "flex", gap: "4px", marginTop: "8px" }}>
            <button
              onClick={() => triggerMemoryUpdate(messages)}
              disabled={messages.length < 2}
              style={{
                flex: 1,
                background: "#4c1d95",
                border: "none",
                color: "#eee",
                padding: "8px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "0.75rem",
              }}
            >
              Update (Recent)
            </button>
            <button
              onClick={triggerFullMemoryUpdate}
              disabled={messages.length < 2}
              style={{
                flex: 1,
                background: "#7c3aed",
                border: "none",
                color: "#eee",
                padding: "8px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "0.75rem",
              }}
            >
              Update (Full)
            </button>
          </div>
        </div>
      )}

      {showImport && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "#16213e",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "500px",
              width: "100%",
            }}
          >
            <h2 style={{ margin: "0 0 16px 0", color: "#a78bfa" }}>
              Import Adventure
            </h2>
            <p
              style={{
                color: "#999",
                fontSize: "0.85rem",
                marginBottom: "16px",
              }}
            >
              Import JSON from Claude (Network tab) or exported adventure.
            </p>
            <label
              style={{
                display: "block",
                background: "#1a1a2e",
                border: "2px dashed #4c1d95",
                borderRadius: "8px",
                padding: "32px",
                textAlign: "center",
                cursor: "pointer",
                marginBottom: "16px",
              }}
            >
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                style={{ display: "none" }}
              />
              <div style={{ color: "#a78bfa" }}>ðŸ“ Click to select JSON</div>
            </label>
            {importLoading && <p style={{ color: "#a78bfa" }}>Importing...</p>}
            {importError && (
              <p style={{ color: "#ef4444", marginBottom: "12px" }}>
                {importError}
              </p>
            )}
            <button
              onClick={() => {
                setShowImport(false);
                setImportError("");
              }}
              style={{
                width: "100%",
                background: "#4c1d95",
                border: "none",
                color: "#eee",
                padding: "12px",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showMemoryUpdate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#16213e",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "500px",
              width: "100%",
            }}
          >
            <h2 style={{ margin: "0 0 16px 0", color: "#a78bfa" }}>
              Memory Update
            </h2>
            <textarea
              value={suggestedMemory}
              onChange={(e) => setSuggestedMemory(e.target.value)}
              style={{
                width: "100%",
                minHeight: "200px",
                background: "#1a1a2e",
                border: "1px solid #4c1d95",
                color: "#eee",
                padding: "12px",
                borderRadius: "6px",
                marginBottom: "16px",
                fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => {
                  setMemory(suggestedMemory);
                  setShowMemoryUpdate(false);
                  setMessagesSinceUpdate(0);
                }}
                style={{
                  flex: 1,
                  background: "#7c3aed",
                  border: "none",
                  color: "#fff",
                  padding: "12px",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Accept
              </button>
              <button
                onClick={() => {
                  setShowMemoryUpdate(false);
                  setMessagesSinceUpdate(0);
                }}
                style={{
                  flex: 1,
                  background: "#4c1d95",
                  border: "none",
                  color: "#eee",
                  padding: "12px",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MythWeavers Adventures Modal */}
      {showMwAdventures && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "#16213e",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "500px",
              width: "100%",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h2 style={{ margin: "0 0 16px 0", color: "#a78bfa" }}>
              My Adventures
            </h2>

            <div style={{ flex: 1, overflowY: "auto", marginBottom: "16px" }}>
              {mwAdventures.length === 0 ? (
                <p style={{ color: "#888", textAlign: "center", padding: "20px" }}>
                  No saved adventures yet. Start an adventure and it will sync automatically!
                </p>
              ) : (
                mwAdventures.map((adv) => (
                  <div
                    key={adv.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px",
                      borderRadius: "8px",
                      marginBottom: "8px",
                      background: mwAdventureId === adv.id ? "rgba(99, 102, 241, 0.2)" : "#1a1a2e",
                      border: mwAdventureId === adv.id ? "1px solid #6366f1" : "1px solid transparent",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 500,
                          color: "#eee",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {adv.name}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#888" }}>
                        Updated {new Date(adv.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => loadFromMythWeavers(adv.id)}
                        style={{
                          background: "#6366f1",
                          border: "none",
                          color: "#fff",
                          padding: "6px 12px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        Load
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete this adventure?")) {
                            deleteFromMythWeavers(adv.id);
                          }
                        }}
                        style={{
                          background: "transparent",
                          border: "1px solid #ef4444",
                          color: "#ef4444",
                          padding: "6px 12px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowMwAdventures(false)}
              style={{
                width: "100%",
                background: "#4c1d95",
                border: "none",
                color: "#eee",
                padding: "12px",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* MythWeavers Auth Modal */}
      {showMwAuth && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "#16213e",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "400px",
              width: "100%",
              textAlign: "center",
            }}
          >
            <h2 style={{ margin: "0 0 8px 0", color: "#a78bfa" }}>
              Connect to MythWeavers
            </h2>
            <p style={{ color: "#888", fontSize: "0.9rem", marginBottom: "20px" }}>
              Sync your adventures to your MythWeavers account
            </p>

            {mwAuthError && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.2)",
                  border: "1px solid rgba(239, 68, 68, 0.5)",
                  color: "#fca5a5",
                  padding: "12px",
                  borderRadius: "8px",
                  marginBottom: "16px",
                }}
              >
                {mwAuthError}
              </div>
            )}

            {mwAuthStatus === "polling" && mwUserCode ? (
              <>
                <div
                  style={{
                    background: "#1a1a2e",
                    padding: "20px",
                    borderRadius: "8px",
                    marginBottom: "16px",
                  }}
                >
                  <p style={{ color: "#888", marginBottom: "8px", fontSize: "0.85rem" }}>
                    Enter this code at:
                  </p>
                  <a
                    href={mwVerificationUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#a78bfa",
                      fontSize: "0.9rem",
                      wordBreak: "break-all",
                    }}
                  >
                    {mwVerificationUri}
                  </a>
                  <div
                    style={{
                      marginTop: "16px",
                      fontSize: "2rem",
                      fontFamily: "monospace",
                      fontWeight: "bold",
                      color: "#fff",
                      letterSpacing: "4px",
                      background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                      padding: "16px",
                      borderRadius: "8px",
                    }}
                  >
                    {mwUserCode}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    color: "#888",
                    marginBottom: "16px",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "16px",
                      height: "16px",
                      border: "2px solid #a78bfa",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  Waiting for authorization...
                </div>
              </>
            ) : mwAuthStatus === "error" ? (
              <button
                onClick={startMwAuth}
                style={{
                  background: "#6366f1",
                  border: "none",
                  color: "#fff",
                  padding: "12px 24px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  marginBottom: "16px",
                }}
              >
                Try Again
              </button>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  color: "#888",
                  marginBottom: "16px",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "16px",
                    height: "16px",
                    border: "2px solid #a78bfa",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                Starting...
              </div>
            )}

            <button
              onClick={cancelMwAuth}
              style={{
                width: "100%",
                background: "#4c1d95",
                border: "none",
                color: "#eee",
                padding: "12px",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
