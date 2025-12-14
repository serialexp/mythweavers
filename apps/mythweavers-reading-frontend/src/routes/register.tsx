import { Title, Meta } from "@solidjs/meta";
import { Layout } from "~/components/Layout";
import { createSignal, Show } from "solid-js";
import { action, useSubmission, redirect, createAsync } from "@solidjs/router";
import { trpc } from "~/lib/trpc";
import { A } from "@solidjs/router";
import { getUserSessionQuery } from "~/lib/session";

const registerAction = action(async (formData: FormData) => {
  "use server";

  const email = formData.get("email") as string;
  const name = formData.get("name") as string;
  const password = formData.get("password") as string;

  if (!email || !name || !password) {
    return { success: false, error: "All fields are required" };
  }

  try {
    const result = await trpc.register.mutate({ email, name, password });

    if (result === true) {
      throw redirect("/login?registrationSuccess=true");
    }
    return { success: false, error: "Registration failed unexpectedly" };
  } catch (error: any) {
    console.error("Registration action error:", error);
    if (error instanceof Response && error.status === 302) {
      throw error;
    }
    return {
      success: false,
      error: error.message || "An error occurred during registration.",
    };
  }
}, "registerUser");

export default function Register() {
  const submission = useSubmission(registerAction);
  const user = createAsync(() => getUserSessionQuery());

  return (
    <Layout user={user}>
      <Title>Register - Reader</Title>
      <Meta name="description" content="Create a new Reader account" />

      <div class="flex items-center justify-center min-h-[70vh]">
        <div class="card w-full max-w-md bg-base-200 shadow-xl">
          <div class="card-body">
            <h1 class="card-title text-3xl mb-6">Create Account</h1>

            <Show when={submission.error || submission.result?.error}>
              <div class="alert alert-error mb-4">
                {submission.error?.message || submission.result?.error}
              </div>
            </Show>

            <form action={registerAction} method="post">
              <div class="form-control mb-4">
                <label class="label" for="name">
                  <span class="label-text">Name</span>
                </label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  class="input input-bordered"
                  disabled={submission.pending}
                  required
                />
              </div>

              <div class="form-control mb-4">
                <label class="label" for="email">
                  <span class="label-text">Email</span>
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  class="input input-bordered"
                  disabled={submission.pending}
                  required
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
                  disabled={submission.pending}
                  required
                />
              </div>

              <div class="form-control">
                <button
                  type="submit"
                  class="btn btn-primary"
                  disabled={submission.pending}
                >
                  {submission.pending ? (
                    <span class="loading loading-spinner loading-sm mr-2" />
                  ) : null}
                  Create Account
                </button>
              </div>
            </form>

            <div class="divider my-8">OR</div>

            <div class="text-center">
              <p class="mb-4">Already have an account?</p>
              <A href="/login" class="btn btn-outline btn-block">
                Sign In
              </A>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
