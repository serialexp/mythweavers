import { Component, Show, For, createSignal, createEffect, createMemo } from "solid-js";
import { useNavigate } from "@solidjs/router";
import {
    BsGear,
    BsPeople,
    BsGlobe,
    BsPlus,
    BsChevronDown,
    BsChevronUp,
    BsMap,
    BsBoxArrowRight,
    BsInfoCircle,
    BsArrowsMove,
    BsBookHalf,
    BsThreeDots,
    BsBook,
    BsCodeSlash,
    BsCheck,
    BsSearch,
    BsFilm,
    BsCpu,
    BsCalendar3,
} from "solid-icons/bs";
import { settingsStore } from "../stores/settingsStore";
import { charactersStore } from "../stores/charactersStore";
import { contextItemsStore } from "../stores/contextItemsStore";
import { mapsStore } from "../stores/mapsStore";
import { navigationStore } from "../stores/navigationStore";
import { messagesStore } from "../stores/messagesStore";
import { modelsStore } from "../stores/modelsStore";
import { currentStoryStore } from "../stores/currentStoryStore";
import { viewModeStore } from "../stores/viewModeStore";
import { Settings } from "./Settings";
import { Characters } from "./Characters";
import { ContextItems } from "./ContextItems";
import { Maps } from "./Maps";
import { StoryNavigation } from "./StoryNavigation";
import { NewStoryForm } from "./NewStoryForm";
import { StoryStats } from "./StoryStats";
import { HeaderButton } from "./HeaderButton";
import { SaveIndicator } from "./SaveIndicator";
import { OverlayPanel } from "./OverlayPanel";
import { Message, Character, Chapter } from "../types/core";
import { authStore } from "../stores/authStore";
import { headerStore } from "../stores/headerStore";
import { searchModalStore } from "../stores/searchModalStore";
import { episodeViewerStore } from "../stores/episodeViewerStore";
import { EpisodeViewer } from "./EpisodeViewer";
import { llmActivityStore } from "../stores/llmActivityStore";
import { LlmActivityPanel } from "./LlmActivityPanel";
import { TravelTimeCalculator } from "./TravelTimeCalculator";
import { CalendarManagement } from "./CalendarManagement";
import styles from "./StoryHeader.module.css";

interface StoryHeaderProps {
    onLoadStory: (messages: Message[], characters: Character[], input: string, storySetting: string, chapters?: Chapter[]) => void;
    onBulkSummarize: () => void;
    onBulkAnalysis: () => void;
    onMigrateInstructions: () => void;
    onRemoveUserMessages: () => void;
    onCleanupThinkTags: () => void;
    onRewriteMessages: () => void;
    onExportStory: () => void;
    onImportStory: () => void;
    isGenerating: boolean;
    contextSize: number;
    charsPerToken: number;
}

export const StoryHeader: Component<StoryHeaderProps> = (props) => {
    const navigate = useNavigate();
    const [showNewStoryModal, setShowNewStoryModal] = createSignal(false);
    const [serverAvailable, setServerAvailable] = createSignal(false);
    const [activeSection, setActiveSection] = createSignal<
        "settings" | "characters" | "context" | "maps" | "navigation" | null
    >(null);
    const [isMobile, setIsMobile] = createSignal(window.innerWidth <= 768);
    const [showMoreMenu, setShowMoreMenu] = createSignal(false);
    const [showViewModeMenu, setShowViewModeMenu] = createSignal(false);
    const [showStorylineMenu, setShowStorylineMenu] = createSignal(false);
    const [showTravelTimeCalculator, setShowTravelTimeCalculator] = createSignal(false);
    const [showCalendarManagement, setShowCalendarManagement] = createSignal(false);
    let moreMenuRef: HTMLDivElement | undefined;
    let viewModeMenuRef: HTMLDivElement | undefined;
    let storylineMenuRef: HTMLDivElement | undefined;

    // Get all plot-type context items (storylines)
    const storylines = createMemo(() =>
        contextItemsStore.contextItems.filter(item => item.type === 'plot')
    );
    
    // Use header store directly as single source of truth
    const isCollapsed = headerStore.isCollapsed
    
    // Track window resize
    createEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    });

    // Handle click outside to close dropdown
    createEffect(() => {
        if (showMoreMenu()) {
            const handleClickOutside = (e: MouseEvent) => {
                const target = e.target as Node;
                // Check if click is outside the dropdown and the button
                const buttonElement = document.querySelector(`.${styles.moreMenuContainer}`);
                if (buttonElement && !buttonElement.contains(target)) {
                    setShowMoreMenu(false);
                }
            };
            // Use setTimeout to avoid immediate closing
            setTimeout(() => {
                document.addEventListener('click', handleClickOutside);
            }, 0);

            return () => document.removeEventListener('click', handleClickOutside);
        }
    });

    // Handle click outside for view mode dropdown
    createEffect(() => {
        if (showViewModeMenu()) {
            const handleClickOutside = (e: MouseEvent) => {
                const target = e.target as Node;
                // Check if click is outside the dropdown and the button
                const buttonElement = document.querySelector(`.${styles.viewModeContainer}`);
                if (buttonElement && !buttonElement.contains(target)) {
                    setShowViewModeMenu(false);
                }
            };
            // Use setTimeout to avoid immediate closing
            setTimeout(() => {
                document.addEventListener('click', handleClickOutside);
            }, 0);

            return () => document.removeEventListener('click', handleClickOutside);
        }
    });

    // Handle click outside for storyline dropdown
    createEffect(() => {
        if (showStorylineMenu()) {
            const handleClickOutside = (e: MouseEvent) => {
                const target = e.target as Node;
                // Check if click is outside the dropdown and the button
                const buttonElement = document.querySelector(`.${styles.storylineContainer}`);
                if (buttonElement && !buttonElement.contains(target)) {
                    setShowStorylineMenu(false);
                }
            };
            // Use setTimeout to avoid immediate closing
            setTimeout(() => {
                document.addEventListener('click', handleClickOutside);
            }, 0);

            return () => document.removeEventListener('click', handleClickOutside);
        }
    });

    // Check server availability
    import("../utils/storyManager").then(({ storyManager }) => {
        storyManager.isServerAvailable().then(setServerAvailable);
    });

    const handleNewStory = (name: string, storageMode: 'local' | 'server', _calendarPresetId?: string) => {
        messagesStore.clearMessages();
        charactersStore.setCharacters([]);
        contextItemsStore.setContextItems([]);
        currentStoryStore.newStory(storageMode, settingsStore.provider, settingsStore.model);
        currentStoryStore.setName(name, false); // false = not a placeholder name

        setShowNewStoryModal(false);
        // Navigate to the new story
        navigate(`/story/${currentStoryStore.id}`);
    };

    return (
        <>
            <div class={styles.headerWrapper}>
                <button
                    onClick={() => {
                        const willCollapse = !isCollapsed();
                        headerStore.toggle();
                        // Close any open sections when collapsing
                        if (willCollapse) {
                            setActiveSection(null);
                            settingsStore.setShowSettings(false);
                            charactersStore.setShowCharacters(false);
                            contextItemsStore.setShowContextItems(false);
                            mapsStore.setShowMaps(false);
                            navigationStore.setShowNavigation(false);
                        }
                    }}
                    class={styles.headerToggle}
                    title={isCollapsed() ? "Show header" : "Hide header"}
                >
                    <Show when={isCollapsed()} fallback={<BsChevronUp />}>
                        <BsChevronDown />
                    </Show>
                </button>
                <header class={`${styles.header} ${isCollapsed() ? styles.collapsed : ''}`}>
                    {/* Only show navigation button on mobile */}
                    <Show when={isMobile()}>
                        <button
                            class={`${styles.navigationButton} ${activeSection() === "navigation" ? styles.active : ''}`}
                            onClick={() => {
                                const newSection =
                                    activeSection() === "navigation"
                                        ? null
                                        : "navigation";
                                setActiveSection(newSection);
                                navigationStore.setShowNavigation(
                                    newSection === "navigation",
                                );
                                settingsStore.setShowSettings(false);
                                charactersStore.setShowCharacters(false);
                                contextItemsStore.setShowContextItems(false);
                                mapsStore.setShowMaps(false);
                            }}
                            title={
                                activeSection() === "navigation"
                                    ? "Hide chapters"
                                    : "📚 Navigate chapters"
                            }
                        >
                            <BsBookHalf />
                        </button>
                    </Show>
                    <div class={styles.config}>
                    <HeaderButton
                        onClick={() => {
                            const newSection =
                                activeSection() === "settings"
                                    ? null
                                    : "settings";
                            setActiveSection(newSection);
                            settingsStore.setShowSettings(
                                newSection === "settings",
                            );
                            charactersStore.setShowCharacters(false);
                            contextItemsStore.setShowContextItems(false);
                            mapsStore.setShowMaps(false);
                            navigationStore.setShowNavigation(false);
                        }}
                        variant={activeSection() === "settings" ? "active" : "default"}
                        title={
                            activeSection() === "settings"
                                ? "Hide settings"
                                : "Show story settings"
                        }
                    >
                        <BsGear />
                    </HeaderButton>
                    <HeaderButton
                        onClick={() => {
                            const newSection =
                                activeSection() === "characters"
                                    ? null
                                    : "characters";
                            setActiveSection(newSection);
                            settingsStore.setShowSettings(false);
                            charactersStore.setShowCharacters(
                                newSection === "characters",
                            );
                            contextItemsStore.setShowContextItems(false);
                            mapsStore.setShowMaps(false);
                            navigationStore.setShowNavigation(false);
                        }}
                        variant={activeSection() === "characters" ? "active" : "default"}
                        title={
                            activeSection() === "characters"
                                ? "Hide characters"
                                : "Show characters"
                        }
                    >
                        <BsPeople />
                    </HeaderButton>
                    <HeaderButton
                        onClick={() => {
                            const newSection =
                                activeSection() === "context"
                                    ? null
                                    : "context";
                            setActiveSection(newSection);
                            settingsStore.setShowSettings(false);
                            charactersStore.setShowCharacters(false);
                            contextItemsStore.setShowContextItems(
                                newSection === "context",
                            );
                            mapsStore.setShowMaps(false);
                            navigationStore.setShowNavigation(false);
                        }}
                        variant={activeSection() === "context" ? "active" : "default"}
                        title={
                            activeSection() === "context"
                                ? "Hide context items"
                                : "Show context items"
                        }
                    >
                        <BsGlobe />
                    </HeaderButton>
                    <HeaderButton
                        onClick={() => {
                            const newSection =
                                activeSection() === "maps"
                                    ? null
                                    : "maps";
                            setActiveSection(newSection);
                            settingsStore.setShowSettings(false);
                            charactersStore.setShowCharacters(false);
                            contextItemsStore.setShowContextItems(false);
                            mapsStore.setShowMaps(
                                newSection === "maps",
                            );
                            navigationStore.setShowNavigation(false);
                        }}
                        variant={activeSection() === "maps" ? "active" : "default"}
                        title={
                            activeSection() === "maps"
                                ? "Hide maps"
                                : "Show maps"
                        }
                    >
                        <BsMap />
                    </HeaderButton>
                    {/* View Mode Dropdown */}
                    <Show when={messagesStore.hasStoryMessages}>
                        <div class={styles.viewModeContainer}>
                            <HeaderButton
                                onClick={() => setShowViewModeMenu(!showViewModeMenu())}
                                title="Change view mode"
                                variant={viewModeStore.viewMode() !== 'normal' ? "active" : "default"}
                            >
                                {viewModeStore.viewMode() === 'normal' && <BsBook />}
                                {viewModeStore.viewMode() === 'reorder' && <BsArrowsMove />}
                                {viewModeStore.viewMode() === 'script' && <BsCodeSlash />}
                                {viewModeStore.viewMode() === 'read' && <BsBookHalf />}
                                <BsChevronDown style={{ "margin-left": "4px", "font-size": "12px" }} />
                            </HeaderButton>
                            <Show when={showViewModeMenu()}>
                                <div ref={viewModeMenuRef} class={styles.viewModeDropdown}>
                                    <button
                                        class={`${styles.dropdownItem} ${viewModeStore.viewMode() === 'normal' ? styles.activeMode : ''}`}
                                        onClick={() => {
                                            viewModeStore.setViewMode('normal');
                                            setShowViewModeMenu(false);
                                        }}
                                    >
                                        <BsBook /> Normal View
                                        {viewModeStore.viewMode() === 'normal' && <BsCheck />}
                                    </button>
                                    <button
                                        class={`${styles.dropdownItem} ${viewModeStore.viewMode() === 'reorder' ? styles.activeMode : ''}`}
                                        onClick={() => {
                                            viewModeStore.setViewMode('reorder');
                                            setShowViewModeMenu(false);
                                        }}
                                    >
                                        <BsArrowsMove /> Reorder Messages
                                        {viewModeStore.viewMode() === 'reorder' && <BsCheck />}
                                    </button>
                                    <button
                                        class={`${styles.dropdownItem} ${viewModeStore.viewMode() === 'script' ? styles.activeMode : ''}`}
                                        onClick={() => {
                                            viewModeStore.setViewMode('script');
                                            setShowViewModeMenu(false);
                                        }}
                                    >
                                        <BsCodeSlash /> Script View
                                        {viewModeStore.viewMode() === 'script' && <BsCheck />}
                                    </button>
                                    <button
                                        class={`${styles.dropdownItem} ${viewModeStore.viewMode() === 'read' ? styles.activeMode : ''}`}
                                        onClick={() => {
                                            viewModeStore.setViewMode('read');
                                            setShowViewModeMenu(false);
                                        }}
                                    >
                                        <BsBookHalf /> Read View
                                        {viewModeStore.viewMode() === 'read' && <BsCheck />}
                                    </button>
                                </div>
                            </Show>
                        </div>
                    </Show>

                    {/* Storyline Filter Dropdown */}
                    <Show when={messagesStore.hasStoryMessages && storylines().length > 0}>
                        <div class={styles.storylineContainer}>
                            <HeaderButton
                                onClick={() => setShowStorylineMenu(!showStorylineMenu())}
                                title="Filter by storyline"
                                variant={navigationStore.selectedStorylineId ? "active" : "default"}
                            >
                                <BsGlobe />
                                <BsChevronDown style={{ "margin-left": "4px", "font-size": "12px" }} />
                            </HeaderButton>
                            <Show when={showStorylineMenu()}>
                                <div ref={storylineMenuRef} class={styles.viewModeDropdown}>
                                    <button
                                        class={`${styles.dropdownItem} ${!navigationStore.selectedStorylineId ? styles.activeMode : ''}`}
                                        onClick={() => {
                                            navigationStore.clearStorylineFilter();
                                            setShowStorylineMenu(false);
                                        }}
                                    >
                                        All Chapters
                                        {!navigationStore.selectedStorylineId && <BsCheck />}
                                    </button>
                                    <div class={styles.dropdownDivider}></div>
                                    <For each={storylines()}>
                                        {(storyline) => (
                                            <button
                                                class={`${styles.dropdownItem} ${navigationStore.selectedStorylineId === storyline.id ? styles.activeMode : ''}`}
                                                onClick={() => {
                                                    navigationStore.setSelectedStorylineId(storyline.id);
                                                    setShowStorylineMenu(false);
                                                }}
                                            >
                                                {storyline.name}
                                                {navigationStore.selectedStorylineId === storyline.id && <BsCheck />}
                                            </button>
                                        )}
                                    </For>
                                </div>
                            </Show>
                        </div>
                    </Show>

                    {/* More menu with dropdown */}
                    <div class={styles.moreMenuContainer}>
                        <HeaderButton
                            onClick={() => {
                                setShowMoreMenu(!showMoreMenu());
                            }}
                            title="More options"
                            variant={showMoreMenu() ? "active" : "default"}
                        >
                            <BsThreeDots />
                        </HeaderButton>
                        <Show when={showMoreMenu()}>
                            <div ref={moreMenuRef} class={styles.moreMenuDropdown}>
                                <button
                                    class={styles.dropdownItem}
                                    onClick={() => {
                                        import('../stores/storyManagerStore').then(({ storyManagerStore }) => {
                                            storyManagerStore.open();
                                        });
                                        setShowMoreMenu(false);
                                    }}
                                >
                                    <BsBook /> Story Manager
                                </button>
                                <Show when={messagesStore.hasStoryMessages}>
                                    <button
                                        class={styles.dropdownItem}
                                        onClick={() => {
                                            searchModalStore.show();
                                            setShowMoreMenu(false);
                                        }}
                                    >
                                        <BsSearch /> Search Messages
                                    </button>
                                </Show>
                                <button
                                    class={styles.dropdownItem}
                                    onClick={() => {
                                        episodeViewerStore.toggle();
                                        setShowMoreMenu(false);
                                    }}
                                >
                                    <BsFilm /> Episode Viewer
                                </button>
                                <button
                                    class={styles.dropdownItem}
                                    onClick={() => {
                                        llmActivityStore.show();
                                        setShowMoreMenu(false);
                                    }}
                                >
                                    <BsCpu /> LLM Activity
                                </button>
                                <Show when={mapsStore.maps.length > 0}>
                                    <button
                                        class={styles.dropdownItem}
                                        onClick={() => {
                                            setShowTravelTimeCalculator(true);
                                            setShowMoreMenu(false);
                                        }}
                                    >
                                        <BsArrowsMove /> Travel Time Calculator
                                    </button>
                                </Show>
                                <Show when={currentStoryStore.storageMode === 'server'}>
                                    <button
                                        class={styles.dropdownItem}
                                        onClick={() => {
                                            setShowCalendarManagement(true);
                                            setShowMoreMenu(false);
                                        }}
                                    >
                                        <BsCalendar3 /> Calendar Management
                                    </button>
                                </Show>
                                <div class={styles.dropdownDivider}></div>
                                <Show when={messagesStore.hasQueries}>
                                    <button
                                        class={styles.dropdownItem}
                                        onClick={() => {
                                            messagesStore.clearQueries();
                                            setShowMoreMenu(false);
                                        }}
                                    >
                                        Clear Queries
                                    </button>
                                </Show>
                                <Show when={messagesStore.hasStoryMessages}>
                                    <button
                                        class={styles.dropdownItem}
                                        onClick={() => {
                                            setShowNewStoryModal(true);
                                            setShowMoreMenu(false);
                                        }}
                                    >
                                        <BsPlus /> New Story
                                    </button>
                                </Show>
                                <div class={styles.dropdownDivider}></div>
                                <button
                                    class={styles.dropdownItem}
                                    onClick={() => {
                                        window.open('/', '_blank');
                                        setShowMoreMenu(false);
                                    }}
                                >
                                    <BsInfoCircle /> About
                                </button>
                                <button
                                    class={styles.dropdownItem}
                                    onClick={() => {
                                        authStore.logout();
                                        setShowMoreMenu(false);
                                    }}
                                >
                                    <BsBoxArrowRight /> Logout
                                </button>
                            </div>
                        </Show>
                    </div>

                    <SaveIndicator />
                </div>
                </header>
                <div class={`${styles.statsWrapper} ${isCollapsed() ? styles.collapsed : ''}`}>
                    <StoryStats />
                </div>
            </div>
            {/* Overlay Panels */}
            <OverlayPanel
                show={settingsStore.showSettings}
                onClose={() => {
                    settingsStore.setShowSettings(false);
                    setActiveSection(null);
                }}
                title="Story Settings"
                position="left"
            >
                <Settings
                    showSettings={true}
                    storySetting={currentStoryStore.storySetting}
                    setStorySetting={currentStoryStore.setStorySetting}
                    contextSize={settingsStore.contextSize}
                    setContextSize={settingsStore.setContextSize}
                    model={settingsStore.model}
                    setModel={settingsStore.setModel}
                    availableModels={modelsStore.availableModels}
                    isLoadingModels={modelsStore.isLoadingModels}
                    onRefreshModels={() => modelsStore.fetchModels()}
                    onBulkSummarize={props.onBulkSummarize}
                    onBulkAnalysis={props.onBulkAnalysis}
                    onMigrateInstructions={props.onMigrateInstructions}
                    onRemoveUserMessages={props.onRemoveUserMessages}
                    onCleanupThinkTags={props.onCleanupThinkTags}
                    onRewriteMessages={props.onRewriteMessages}
                    onExportStory={props.onExportStory}
                    onImportStory={props.onImportStory}
                    isLoading={messagesStore.isLoading}
                    isGenerating={props.isGenerating}
                    provider={settingsStore.provider}
                    setProvider={settingsStore.setProvider}
                    openrouterApiKey={settingsStore.openrouterApiKey}
                    setOpenrouterApiKey={settingsStore.setOpenrouterApiKey}
                    anthropicApiKey={settingsStore.anthropicApiKey}
                    setAnthropicApiKey={settingsStore.setAnthropicApiKey}
                    openaiApiKey={settingsStore.openaiApiKey}
                    setOpenaiApiKey={settingsStore.setOpenaiApiKey}
                    useSmartContext={settingsStore.useSmartContext}
                    setUseSmartContext={settingsStore.setUseSmartContext}
                    autoGenerate={settingsStore.autoGenerate}
                    setAutoGenerate={settingsStore.setAutoGenerate}
                    person={currentStoryStore.person}
                    setPerson={(value: string) =>
                        currentStoryStore.setPerson(
                            value as "first" | "second" | "third",
                        )
                    }
                    tense={currentStoryStore.tense}
                    setTense={(value: string) =>
                        currentStoryStore.setTense(value as "present" | "past")
                    }
                    paragraphsPerTurn={settingsStore.paragraphsPerTurn}
                    setParagraphsPerTurn={settingsStore.setParagraphsPerTurn}
                />
            </OverlayPanel>
            
            <OverlayPanel
                show={charactersStore.showCharacters}
                onClose={() => {
                    charactersStore.setShowCharacters(false);
                    setActiveSection(null);
                }}
                title="Characters"
                position="left"
            >
                <Characters />
            </OverlayPanel>
            
            <OverlayPanel
                show={contextItemsStore.showContextItems}
                onClose={() => {
                    contextItemsStore.setShowContextItems(false);
                    setActiveSection(null);
                }}
                title="Context Items"
                position="left"
            >
                <ContextItems />
            </OverlayPanel>
            
            <OverlayPanel
                show={mapsStore.showMaps}
                onClose={() => {
                    mapsStore.setShowMaps(false);
                    setActiveSection(null);
                }}
                title="Maps"
                position="left"
            >
                <Maps />
            </OverlayPanel>
            
            {/* Mobile only: Navigation overlay */}
            <Show when={isMobile()}>
                <OverlayPanel
                    show={navigationStore.showNavigation}
                    onClose={() => {
                        navigationStore.setShowNavigation(false);
                        setActiveSection(null);
                    }}
                    title="Story Structure"
                    position="left"
                >
                    <StoryNavigation 
                        onSelectChapter={() => {
                            // On mobile, close the navigation when a chapter is selected
                            navigationStore.setShowNavigation(false);
                            setActiveSection(null);
                        }}
                    />
                </OverlayPanel>
            </Show>

            <OverlayPanel
                show={llmActivityStore.isOpen}
                onClose={() => llmActivityStore.hide()}
                title="LLM Activity"
                position="right"
            >
                <LlmActivityPanel />
            </OverlayPanel>

            {/* New Story Modal */}
            <Show when={showNewStoryModal()}>
                <div
                    class="modal-overlay"
                    onClick={() => setShowNewStoryModal(false)}
                >
                    <div
                        class="modal-content"
                        onClick={(e) => e.stopPropagation()}
                        style="max-width: 400px;"
                    >
                        <div class="modal-header">
                            <h3>Create New Story</h3>
                            <button
                                class="modal-close"
                                onClick={() => setShowNewStoryModal(false)}
                            >
                                ×
                            </button>
                        </div>
                        <div class="modal-body">
                            <p style="margin-bottom: 1.5rem;">This will clear the current story and create a new one.</p>
                            <NewStoryForm
                                serverAvailable={serverAvailable()}
                                onCreateStory={handleNewStory}
                                onCancel={() => setShowNewStoryModal(false)}
                            />
                        </div>
                    </div>
                </div>
            </Show>

            {/* Only show modal version when not in docked mode */}
            <Show when={!episodeViewerStore.isDocked}>
                <EpisodeViewer
                    isOpen={episodeViewerStore.isOpen}
                    onClose={() => episodeViewerStore.hide()}
                    mode="modal"
                />
            </Show>

            {/* Travel Time Calculator */}
            <TravelTimeCalculator
                isOpen={showTravelTimeCalculator()}
                onClose={() => setShowTravelTimeCalculator(false)}
                storyId={currentStoryStore.id}
            />

            {/* Calendar Management */}
            <OverlayPanel
                show={showCalendarManagement()}
                onClose={() => setShowCalendarManagement(false)}
                title="Calendar Management"
                position="left"
            >
                <CalendarManagement />
            </OverlayPanel>
        </>
    );
};
