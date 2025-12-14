import { Title, Meta } from "@solidjs/start";
import { Layout } from "~/components/Layout";
import { createResource, Show } from "solid-js";
import { trpc } from "~/lib/trpc";
import { useParams, A } from "@solidjs/router";

export default function ChapterPage() {
  const params = useParams();
  
  // Fetch chapter content
  const [chapter] = createResource(async () => {
    if (!params.storyId || !params.bookId || !params.chapterId) return null;
    
    try {
      return await trpc.getChapter.query({
        storyId: params.storyId,
        bookId: params.bookId,
        chapterId: params.chapterId,
      });
    } catch (error) {
      console.error('Error fetching chapter:', error);
      return null;
    }
  });

  return (
    <Layout>
      <Show when={chapter()} fallback={<div>Loading chapter...</div>}>
        {(chapterData) => (
          <>
            <Title>{chapterData().title || 'Chapter'} - Reader</Title>
            <Meta name="description" content={`Reading ${chapterData().title}`} />
            
            <div class="flex justify-between items-center mb-6">
              <A href={`/story/${params.storyId}`} class="btn btn-outline">
                Back to Story
              </A>
              <div class="flex gap-2">
                <button class="btn btn-outline btn-sm" disabled={!chapterData().prevChapter}>
                  Previous
                </button>
                <button class="btn btn-outline btn-sm" disabled={!chapterData().nextChapter}>
                  Next
                </button>
              </div>
            </div>
            
            <div class="bg-base-100 p-6 rounded-lg shadow-lg">
              <h1 class="text-3xl font-bold text-center mb-6">
                {chapterData().title}
              </h1>
              
              <div 
                class="prose max-w-none mx-auto font-serif text-lg" 
                innerHTML={chapterData().content || 'No content available'}
              />
            </div>
            
            <div class="flex justify-between items-center mt-6">
              <button class="btn btn-outline" disabled={!chapterData().prevChapter}>
                Previous Chapter
              </button>
              <button class="btn btn-primary" disabled={!chapterData().nextChapter}>
                Next Chapter
              </button>
            </div>
          </>
        )}
      </Show>
    </Layout>
  );
}