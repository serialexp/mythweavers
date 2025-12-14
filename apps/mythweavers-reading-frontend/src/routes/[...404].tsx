import { Title, Meta } from "@solidjs/start";
import { Layout } from "~/components/Layout";
import { A } from "@solidjs/router";

export default function NotFound() {
  return (
    <Layout>
      <Title>404 - Page Not Found</Title>
      <Meta name="description" content="The page you were looking for doesn't exist" />
      
      <div class="flex flex-col items-center justify-center py-16">
        <h1 class="text-6xl font-bold text-error mb-6">404</h1>
        <p class="text-2xl mb-8">The page you're looking for cannot be found.</p>
        
        <A href="/" class="btn btn-primary">
          Go Home
        </A>
      </div>
    </Layout>
  );
}