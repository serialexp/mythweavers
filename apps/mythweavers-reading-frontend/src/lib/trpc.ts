"use server";

import { httpBatchLink, createTRPCClient } from "@trpc/client";
import { isServer } from "solid-js/web";
import type { AppRouter } from "@writer/server";
import { getUserSessionQuery } from "./session";

// We'll need to properly type this with the actual AppRouter type
// from the server, but for now we'll use any
export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: isServer
        ? "http://localhost:2022/trpc"
        : window.location.host.includes("localhost")
          ? "http://localhost:2022/trpc"
          : "https://writer.serial-experiments.com/trpc",
      async headers() {
        "use server";
        const userSession = await getUserSessionQuery();
        const token = userSession?.token;

        return {
          Authorization: token ? `Bearer ${token}` : "",
        };
      },
    }),
  ],
});
