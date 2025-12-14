import { Component } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { authStore } from '../stores/authStore';
import styles from './AboutPage.module.css';

export const AboutPage: Component = () => {
  const navigate = useNavigate();

  return (
    <div class={styles.container}>
      <div class={styles.content}>
        <div class={styles.topActions}>
          <button
            class={styles.offlineButton}
            onClick={() => {
              authStore.setOfflineMode();
              navigate('/stories');
            }}
          >
            Continue Offline
          </button>
          <button class={styles.secondaryButton} onClick={() => navigate('/login')}>
            Sign In
          </button>
          <button class={styles.primaryButton} onClick={() => navigate('/login')}>
            Get Started
          </button>
        </div>

        <header class={styles.header}>
          <h1 class={styles.title}>Story Writing Assistant</h1>
          <p class={styles.tagline}>AI-Powered Collaborative Storytelling Platform</p>
        </header>

        <section class={styles.section}>
          <h2>What is Story?</h2>
          <p>
            Story is an advanced writing assistant that helps authors craft compelling narratives 
            through AI collaboration. Whether you're writing fiction, developing characters, or 
            exploring plot ideas, Story provides intelligent assistance while maintaining your 
            creative control.
          </p>
        </section>

        <section class={styles.section}>
          <h2>Key Features</h2>
          <div class={styles.features}>
            <div class={styles.feature}>
              <h3>🤖 AI Collaboration</h3>
              <p>Work with advanced language models including Claude, GPT-4, and local Ollama models to generate and refine your story content.</p>
            </div>
            <div class={styles.feature}>
              <h3>📚 Chapter Management</h3>
              <p>Organize your story into chapters with summaries, status tracking, and selective context inclusion for better AI assistance.</p>
            </div>
            <div class={styles.feature}>
              <h3>👥 Character Development</h3>
              <p>Create and manage detailed character profiles that the AI references to maintain consistency throughout your narrative.</p>
            </div>
            <div class={styles.feature}>
              <h3>🗺️ World Building</h3>
              <p>Design interactive maps with landmarks, track location states over time, and visualize your story's geography.</p>
            </div>
            <div class={styles.feature}>
              <h3>🎭 Context Management</h3>
              <p>Define themes, locations, and custom context items that guide the AI's writing style and content generation.</p>
            </div>
            <div class={styles.feature}>
              <h3>💾 Auto-Save & Sync</h3>
              <p>Your work is automatically saved to the server with real-time synchronization and conflict resolution.</p>
            </div>
            <div class={styles.feature}>
              <h3>🌐 Offline Mode</h3>
              <p>Work without an account or internet connection. All features available locally with optional server sync when you're ready.</p>
            </div>
            <div class={styles.feature}>
              <h3>📊 Smart Summarization</h3>
              <p>Automatic paragraph and chapter summaries help manage long narratives and provide context for AI generation.</p>
            </div>
            <div class={styles.feature}>
              <h3>✏️ Message Rewriting</h3>
              <p>Refine any part of your story with AI assistance while preserving the original for comparison.</p>
            </div>
          </div>
        </section>

        <section class={styles.section}>
          <h2>How It Works</h2>
          <ol class={styles.steps}>
            <li>
              <strong>Start Your Story:</strong> Begin with a prompt, character description, or story idea.
            </li>
            <li>
              <strong>Collaborate with AI:</strong> Generate content using your preferred AI model, with full control over instructions and context.
            </li>
            <li>
              <strong>Organize & Refine:</strong> Structure your content into chapters, add character details, and refine passages as needed.
            </li>
            <li>
              <strong>Build Your World:</strong> Create maps, define locations, and track how your world evolves throughout the story.
            </li>
            <li>
              <strong>Export & Share:</strong> Export your completed work as PDF or continue developing with ongoing AI assistance.
            </li>
          </ol>
        </section>

        <section class={styles.section}>
          <h2>AI Models Supported</h2>
          <div class={styles.models}>
            <div class={styles.model}>
              <strong>Claude (Anthropic):</strong> Advanced reasoning and creative writing with large context windows
            </div>
            <div class={styles.model}>
              <strong>GPT-4 (OpenAI):</strong> Versatile language generation with strong narrative capabilities
            </div>
            <div class={styles.model}>
              <strong>Ollama (Local):</strong> Privacy-focused local models for completely offline writing
            </div>
            <div class={styles.model}>
              <strong>OpenRouter:</strong> Access to multiple AI models through a unified interface
            </div>
          </div>
        </section>

        <div class={styles.actions}>
          <button class={styles.primaryButton} onClick={() => navigate('/login')}>
            Get Started
          </button>
          <button class={styles.secondaryButton} onClick={() => navigate('/login')}>
            Sign In
          </button>
        </div>

        <footer class={styles.footer}>
          <p>Story Writing Assistant - Empowering Authors with AI</p>
        </footer>
      </div>
    </div>
  );
};