import {
  action,
  redirect,
  reload,
  useSubmission,
  type AccessorWithLatest,
} from "@solidjs/router";
import { Show, Suspense } from "solid-js";
import { destroyUserSession, type UserSession } from "~/lib/session";
import { trpc } from "~/lib/trpc";

const logoutAction = action(async (formData: FormData) => {
  "use server";

  try {
    await trpc.sessionSignout.mutate().then(() => {
      console.log(`--- Session signout completed ${Date.now()} ---`);
    });
    await destroyUserSession();
    console.log(`--- Logout action completed ${Date.now()} ---`);
    return reload();
  } catch (error: any) {
    console.error("Logout action error:", error);
    if (error instanceof Response && error.status === 302) {
      throw error;
    }
  }
}, "logoutUser");

const UserStatus = (props: {
  user: AccessorWithLatest<UserSession | undefined | null>;
}) => {
  const submission = useSubmission(logoutAction);

  return (
    <div class="flex-none">
      <Suspense fallback={<div>Loading user...</div>}>
        <Show
          when={props.user?.()?.name}
          fallback={
            // Not logged in
            <ul class="menu menu-horizontal px-1">
              <li>
                <a href="/login">Login</a>
              </li>
              <li>
                <a href="/register">Register</a>
              </li>
            </ul>
          }
        >
          <pre>{JSON.stringify(props.user(), null, 2)}</pre>
          {/* Logged in */}
          <div class="dropdown dropdown-end">
            <button type="button" class="btn btn-ghost rounded-btn">
              {props.user()?.name || "User"}
            </button>
            <ul class="menu dropdown-content z-[1] p-2 shadow bg-base-100 rounded-box w-52 mt-4">
              <li>
                <a href="/profile">Profile</a>
              </li>
              <li>
                <a href="/settings">Settings</a>
              </li>
              <li>
                <form
                  method="post"
                  action={logoutAction}
                  style={{ display: "contents" }}
                >
                  <button
                    type="submit"
                    class="w-full text-left px-4 py-2 hover:bg-base-200 rounded-lg"
                    disabled={submission.pending}
                  >
                    {submission.pending ? "Logging out..." : "Logout"}
                  </button>
                </form>
              </li>
            </ul>
          </div>
        </Show>
      </Suspense>
    </div>
  );
};

export default UserStatus;
