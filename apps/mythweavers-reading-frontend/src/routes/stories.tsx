import { Title, Meta } from "@solidjs/meta";
import { Layout } from "~/components/Layout";
import { createResource, Show, For } from "solid-js";
import { trpc } from "~/lib/trpc";
import { useSearchParams } from "@solidjs/router";
import StoryCard from "~/components/StoryCard";

export default function Stories() {
  const [searchParams] = useSearchParams();

  // We'll use createResource to fetch data with SSR support
  const [stories] = createResource(async () => {
    try {
      const genre = searchParams.genre;
      // This would use the actual typed TRPC client when implemented
      return await trpc.listStories.query({ genre: genre || undefined });
    } catch (error) {
      console.error("Error fetching stories:", error);
      return [];
    }
  });

  return (
    <Layout>
      <Title>Reader - Stories</Title>
      <Meta
        name="description"
        content={`${searchParams.genre ? searchParams.genre : "All"} stories on Reader`}
      />

      <h1 class="text-4xl font-bold mb-6">
        {searchParams.genre
          ? `${searchParams.genre.charAt(0).toUpperCase() + searchParams.genre.slice(1)} Stories`
          : "All Stories"}
      </h1>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Show when={!stories.loading} fallback={<div>Loading stories...</div>}>
          <Show when={stories()?.length} fallback={<div>No stories found</div>}>
            <For each={stories()}>
              {(story) => (
                <StoryCard
                  id={story.id}
                  name={story.name || "Untitled"}
                  summary={story.summary || "No summary available"}
                  coverArtAsset={story.coverImage}
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
