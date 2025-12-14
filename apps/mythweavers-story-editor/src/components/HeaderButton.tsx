import { Component, JSX } from "solid-js";
import styles from "./HeaderButton.module.css";

interface HeaderButtonProps {
    onClick?: () => void;
    title?: string;
    variant?: "default" | "active" | "danger" | "primary";
    disabled?: boolean;
    children: JSX.Element;
    class?: string;
}

export const HeaderButton: Component<HeaderButtonProps> = (props) => {
    const getClassName = () => {
        const classes = [styles.headerButton];

        if (props.variant === "active") {
            classes.push(styles.active);
        } else if (props.variant === "danger") {
            classes.push(styles.danger);
        } else if (props.variant === "primary") {
            classes.push(styles.primary);
        }

        if (props.disabled) {
            classes.push(styles.disabled);
        }

        if (props.class) {
            classes.push(props.class);
        }

        return classes.join(" ");
    };
    
    return (
        <button
            onClick={props.onClick}
            class={getClassName()}
            title={props.title}
            disabled={props.disabled}
            type="button"
        >
            {props.children}
        </button>
    );
};