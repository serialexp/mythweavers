import { type ParentComponent, onMount } from "solid-js";
import { A, AccessorWithLatest } from "@solidjs/router";
import {
  colorMode,
  initColorMode,
  toggleColorMode,
} from "../lib/stores/color-mode";
import UserStatus from "./UserStatus";
import type { UserSession } from "~/lib/session";

export const Layout: ParentComponent<{
  user: AccessorWithLatest<UserSession | undefined | null>;
}> = (props) => {
  // Initialize color mode on mount
  onMount(() => {
    initColorMode();
  });

  return (
    <div
      class="flex flex-col min-h-screen"
      data-theme={colorMode() === "light" ? "fantasy" : "forest"}
    >
      <nav class="sticky navbar top-0 bg-base-100 text-base-content dark:bg-gray-900 dark:text-gray-300 shadow-md z-50">
        <div class="container flex justify-between m-auto">
          <div>
            <A href="/" class="btn btn-ghost text-xl">
              Reader
            </A>
          </div>
          <div class="flex-none">
            <ul class="menu menu-horizontal px-1">
              <li>
                <A href="/">Home</A>
              </li>
              <li>
                <A href="/stories">Stories</A>
              </li>
              <li>
                <A href="/download">Download Writer</A>
              </li>
            </ul>
          </div>

          <div class="flex gap-2">
            <UserStatus user={props.user} />

            <div class="flex-none ml-2">
              <button
                type="button"
                class="btn btn-ghost btn-circle"
                onClick={() => toggleColorMode()}
              >
                {colorMode() === "light" ? "🌙" : "☀️"}
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main
        class="flex-grow overflow-hidden"
        style={{
          "background-image":
            colorMode() === "dark" ? "url(/bg-dark.png)" : "url(/bg-light.png)",
          "background-attachment": "fixed",
          "background-size": "cover",
        }}
      >
        <div class="container mx-auto flex-1">
          <div class="bg-base-100 p-4 h-full">{props.children}</div>
        </div>
      </main>
    </div>
  );
};
