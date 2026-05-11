import { redirect } from "next/navigation";

// Friendly alias for the existing /me/posts route. Authors land here from
// the public surface where the URL "/my-posts" reads cleaner than "/me/posts".
export default function MyPostsAlias() {
  redirect("/me/posts");
}
