import { Title, Meta } from "@solidjs/meta";
import { Layout } from "~/components/Layout";
import { createSignal, Show } from "solid-js";
import {
  action,
  redirect,
  useSearchParams,
  useSubmission,
} from "@solidjs/router";
import { createUserSession, destroyUserSession } from "~/lib/session";
import { trpc } from "~/lib/trpc";

const loginAction = action(async (formData: FormData) => {
  "use server";

  try {
    const result = await trpc.sessionLogin.mutate({
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    });

    if (result?.token && result.user) {
      await createUserSession(
        {
          id: result.user.id.toString(),
          name: result.user.name,
          email: result.user.email,
          avatarUrl: result.user.avatarUrl || undefined,
          token: result.token,
        },
        "/",
      );
    }
    return redirect("/");
  } catch (error: any) {
    console.error("Login action error:", error);
    if (error instanceof Response && error.status === 302) {
      throw error;
    }
    return {
      success: false,
      error: error.message || "An error occurred during login.",
    };
  }
}, "loginUser");

export default function Login() {
  const submission = useSubmission(loginAction);
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [localError, setLocalError] = createSignal<string | null>(null);

  return (
    <Layout>
      <Title>Login - Reader</Title>
      <Meta name="description" content="Sign in to your Reader account" />

      <div class="flex items-center justify-center min-h-[70vh]">
        <div class="card w-full max-w-md bg-base-200 shadow-xl">
          <div class="card-body">
            <h1 class="card-title text-3xl mb-6">Sign In</h1>

            <Show when={localError()}>
              <div class="alert alert-error mb-4">{localError()}</div>
            </Show>

            <form action={loginAction} method="post">
              <div class="form-control mb-4">
                <label class="label" for="email">
                  <span class="label-text">Email</span>
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  class="input input-bordered"
                />
              </div>

              <div class="form-control mb-6">
                <label class="label" for="password">
                  <span class="label-text">Password</span>
                </label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  class="input input-bordered"
                />
              </div>

              <div class="form-control">
                <button
                  type="submit"
                  class="btn btn-primary"
                  disabled={submission.pending}
                >
                  {submission.pending ? "Signing in..." : "Sign In"}
                </button>
              </div>
            </form>

            <div class="divider my-8">OR</div>

            <div class="text-center">
              <p class="mb-4">Don't have an account?</p>
              <a href="/register" class="btn btn-outline btn-block">
                Create Account
              </a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
