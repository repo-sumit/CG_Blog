import { redirect } from "next/navigation";

// Old detail path /blog/[slug] is replaced by the public /posts/[slug] route.
// Keep existing links working by 308-redirecting through the page-level redirect.
export default async function BlogDetailRedirect(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  redirect(`/posts/${params.slug}`);
}
