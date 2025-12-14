import { Component, JSX } from "solid-js";
import styles from "./IconButton.module.css";

interface IconButtonProps {
    onClick: () => void;
    title: string;
    children: JSX.Element;
    class?: string;
}

export const IconButton: Component<IconButtonProps> = (props) => {
    return (
        <button
            class={`${styles.iconButton} ${props.class || ""}`}
            onClick={props.onClick}
            title={props.title}
        >
            {props.children}
        </button>
    );
};