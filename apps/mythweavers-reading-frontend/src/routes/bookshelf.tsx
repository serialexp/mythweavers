import { Title, Meta } from "@solidjs/meta";
import { Layout } from "~/components/Layout";
import { Show, createResource } from "solid-js";
import { createAsync } from "@solidjs/router";
import { requireUserSession } from "~/lib/session";

// This route is protected - can only be accessed by logged-in users
export function routeData() {
  return createAsync(async () => {
    return await requireUserSession();
  });
}

export default function Bookshelf() {
  // Get user data from the route data
  const user = useRouteData();

  return (
    <Layout>
      <Title>My Bookshelf - Reader</Title>
      <Meta name="description" content="Your personal bookshelf" />

      <div class="mb-8">
        <h1 class="text-4xl font-bold mb-2">My Bookshelf</h1>
        <p class="text-lg">Welcome back, {user()?.username || "Reader"}!</p>
      </div>

      <Show
        when={user()}
        fallback={<div>Please log in to view your bookshelf</div>}
      >
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="card bg-base-200 shadow-xl">
            <div class="card-body">
              <h2 class="card-title">Your Collections</h2>
              <p>No collections yet. Start organizing your stories!</p>
              <div class="card-actions justify-end">
                <button class="btn btn-primary">Create Collection</button>
              </div>
            </div>
          </div>

          <div class="card bg-base-200 shadow-xl">
            <div class="card-body">
              <h2 class="card-title">Reading History</h2>
              <p>No reading history yet. Start reading!</p>
              <div class="card-actions justify-end">
                <button class="btn btn-primary">Browse Stories</button>
              </div>
            </div>
          </div>

          <div class="card bg-base-200 shadow-xl">
            <div class="card-body">
              <h2 class="card-title">Recommendations</h2>
              <p>We'll recommend stories based on your reading history.</p>
              <div class="card-actions justify-end">
                <button class="btn btn-primary">Discover</button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </Layout>
  );
}
