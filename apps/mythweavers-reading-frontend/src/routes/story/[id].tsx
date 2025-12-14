import { Title, Meta } from "@solidjs/start";
import { Layout } from "~/components/Layout";
import { createResource, Show, For } from "solid-js";
import { trpc } from "~/lib/trpc";
import { useParams, A } from "@solidjs/router";

export default function StoryDetail() {
  const params = useParams();
  
  // Fetch story details
  const [story] = createResource(async () => {
    if (!params.id) return null;
    
    try {
      return await trpc.getStory.query({ id: params.id });
    } catch (error) {
      console.error('Error fetching story:', error);
      return null;
    }
  });

  return (
    <Layout>
      <Show when={story()} fallback={<div>Loading story...</div>}>
        {(storyData) => (
          <>
            <Title>{storyData().name || 'Unknown Story'} - Reader</Title>
            <Meta name="description" content={`Read ${storyData().name} on Reader`} />
            
            <div class="flex flex-col md:flex-row gap-8">
              {/* Cover image */}
              <div class="flex-shrink-0 w-full md:w-64">
                <div class="bg-base-200 h-96 md:h-80 rounded-lg overflow-hidden shadow-xl">
                  {storyData().coverImage ? (
                    <img 
                      src={storyData().coverImage} 
                      alt={storyData().name} 
                      class="w-full h-full object-cover"
                    />
                  ) : (
                    <div class="w-full h-full flex items-center justify-center">
                      <span class="text-3xl font-bold text-center p-4">{storyData().name}</span>
                    </div>
                  )}
                </div>
                
                <div class="mt-4 flex flex-col gap-2">
                  <button class="btn btn-primary w-full">
                    Start Reading
                  </button>
                  <button class="btn btn-outline w-full">
                    Add to Library
                  </button>
                </div>
              </div>
              
              {/* Story details */}
              <div class="flex-1">
                <h1 class="text-4xl font-bold mb-2">{storyData().name}</h1>
                <div class="flex gap-2 mb-4">
                  <span class="badge badge-primary">{storyData().status || 'Unknown'}</span>
                  <span class="badge badge-secondary">{storyData().genre || 'Unknown Genre'}</span>
                </div>
                
                <div class="prose max-w-none mb-6" innerHTML={storyData().summary || 'No summary available'} />
                
                <h2 class="text-2xl font-bold mb-4">Chapters</h2>
                <Show when={storyData().books?.length} fallback={<div>No chapters available</div>}>
                  <div class="space-y-4">
                    <For each={storyData().books}>
                      {(book) => (
                        <div class="card bg-base-200">
                          <div class="card-body">
                            <h3 class="card-title">{book.title}</h3>
                            <div class="space-y-2">
                              <For each={book.chapters}>
                                {(chapter) => (
                                  <A 
                                    href={`/story/${params.id}/book/${book.id}/chapter/${chapter.id}`}
                                    class="block p-2 bg-base-100 hover:bg-primary hover:text-primary-content rounded-md transition-colors"
                                  >
                                    {chapter.title}
                                  </A>
                                )}
                              </For>
                            </div>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </div>
          </>
        )}
      </Show>
    </Layout>
  );
}