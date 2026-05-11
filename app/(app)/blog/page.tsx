import { redirect } from "next/navigation";

// The signed-in blog feed has moved to the public landing at /. Authors who
// want to manage their own posts go to /me/posts. Redirect anyone landing
// on the old path so bookmarks keep working.
export default function BlogIndexRedirect() {
  redirect("/");
}
