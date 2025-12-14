import { Title, Meta } from "@solidjs/meta";
import { Layout } from "~/components/Layout";
import { Show, For } from "solid-js";
import { createAsync, query } from "@solidjs/router";
import { trpc } from "~/lib/trpc";
import StoryCard from "~/components/StoryCard";
import { getUserSessionQuery } from "~/lib/session";

// Define the query function outside the component
// This function will be used by both the preload and createAsync
const getStoriesQuery = query(async () => {
  // The tRPC call remains the same
  try {
    return await trpc.listRandomStories.query({
      limit: 10,
    });
  } catch (error) {
    console.error("Error fetching stories:", error);
    return { stories: [] };
  }
}, "randomStories"); // Add a query key, useful for caching and debugging

// Export the route object with a preload function
export const route = {
  preload: () => {
    getStoriesQuery();
    getUserSessionQuery();
  },
};

export default function Home() {
  // Use createAsync to consume the data preloaded by the route
  // createAsync automatically uses the result from the preload function
  const stories = createAsync(() => getStoriesQuery());
  const user = createAsync(() => getUserSessionQuery());

  return (
    <Layout user={user}>
      <Title>Reader - Home</Title>
      <Meta name="description" content="Welcome to the Reader app" />

      <h1 class="text-4xl font-bold mb-6">Welcome to Reader</h1>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Access the loading state directly from the signal returned by createAsync */}
        {/* The signal value will be undefined initially while loading, then the data */}
        <Show when={stories()} fallback={<div>Loading stories...</div>}>
          {/* Now that stories() is truthy (has data), check its content */}
          <Show
            when={stories()?.stories?.length}
            fallback={<div>No stories found</div>}
          >
            <For each={stories()?.stories}>
              {(story) => (
                <StoryCard
                  id={story.id}
                  name={story.name || "Untitled"}
                  summary={story.summary || "No summary available"}
                  coverArtAsset={story.coverArtAsset}
                  pages={story.pages || 0}
                  status={story.status}
                  canAddToLibrary={true}
                />
              )}
            </For>
          </Show>
        </Show>
      </div>
    </Layout>
  );
}
