import { Title, Meta } from "@solidjs/meta";
import { Layout } from "~/components/Layout";

export default function Download() {
  return (
    <Layout>
      <Title>Download Writer - Reader</Title>
      <Meta
        name="description"
        content="Download the Writer desktop application"
      />

      <div class="prose max-w-none">
        <h1>Download Writer</h1>

        <p class="lead">
          Writer is a desktop application for writing stories, novels, and other
          content. It's built for authors who want a distraction-free writing
          environment with powerful organization tools.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 my-12">
          <div class="card bg-base-200 shadow-xl">
            <div class="card-body">
              <h2 class="card-title">Windows</h2>
              <p>Download Writer for Windows PCs</p>
              <div class="card-actions justify-end">
                <button class="btn btn-primary">Download for Windows</button>
              </div>
            </div>
          </div>

          <div class="card bg-base-200 shadow-xl">
            <div class="card-body">
              <h2 class="card-title">macOS</h2>
              <p>Download Writer for Mac computers</p>
              <div class="card-actions justify-end">
                <button class="btn btn-primary">Download for macOS</button>
              </div>
            </div>
          </div>

          <div class="card bg-base-200 shadow-xl">
            <div class="card-body">
              <h2 class="card-title">Linux</h2>
              <p>Download Writer for Linux distributions</p>
              <div class="card-actions justify-end">
                <button class="btn btn-primary">Download for Linux</button>
              </div>
            </div>
          </div>
        </div>

        <h2>Features</h2>

        <ul>
          <li>
            Organize your writing with a hierarchical structure of books,
            chapters, and scenes
          </li>
          <li>Track characters, locations, and plot points</li>
          <li>Write in a distraction-free environment</li>
          <li>Sync your writing across devices</li>
          <li>Easily publish to platforms like Royal Road</li>
          <li>AI-assisted writing and editing tools</li>
        </ul>

        <h2>System Requirements</h2>

        <ul>
          <li>Windows 10 or later</li>
          <li>macOS 10.15 (Catalina) or later</li>
          <li>Ubuntu 20.04 or equivalent Linux distribution</li>
          <li>4GB RAM minimum, 8GB recommended</li>
          <li>1GB free disk space</li>
        </ul>
      </div>
    </Layout>
  );
}
