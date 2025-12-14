import { Component, JSX, Show, createSignal, onMount, onCleanup, createEffect } from "solid-js";
import { Portal } from "solid-js/web";
import styles from "./OverlayPanel.module.css";

interface OverlayPanelProps {
    show: boolean;
    onClose: () => void;
    title: string;
    children: JSX.Element;
    position?: "left" | "right" | "center";
}

export const OverlayPanel: Component<OverlayPanelProps> = (props) => {
    const [isVisible, setIsVisible] = createSignal(false);
    
    // Handle escape key to close
    const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape" && props.show) {
            props.onClose();
        }
    };
    
    onMount(() => {
        document.addEventListener("keydown", handleEscape);
    });
    
    onCleanup(() => {
        document.removeEventListener("keydown", handleEscape);
    });
    
    // Update visibility when show prop changes
    createEffect(() => {
        if (props.show) {
            // Small delay to trigger animation
            setTimeout(() => setIsVisible(true), 10);
        } else {
            setIsVisible(false);
        }
    });
    
    const getPanelClass = () => {
        const classes = [styles.panel];
        
        if (props.position === "right") {
            classes.push(styles.panelRight);
        } else if (props.position === "center") {
            classes.push(styles.panelCenter);
        } else {
            classes.push(styles.panelLeft);
        }
        
        if (isVisible() && props.show) {
            classes.push(styles.visible);
        }
        
        return classes.join(" ");
    };
    
    return (
        <Show when={props.show}>
            <Portal>
                <div class={styles.overlay} onClick={props.onClose}>
                    <div 
                        class={getPanelClass()}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div class={styles.panelHeader}>
                            <h2 class={styles.panelTitle}>{props.title}</h2>
                            <button 
                                class={styles.closeButton}
                                onClick={props.onClose}
                                aria-label="Close panel"
                            >
                                ×
                            </button>
                        </div>
                        <div class={styles.panelContent}>
                            {props.children}
                        </div>
                    </div>
                </div>
            </Portal>
        </Show>
    );
};