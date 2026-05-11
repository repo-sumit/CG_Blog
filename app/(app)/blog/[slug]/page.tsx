import { redirect } from "next/navigation";

// Old detail path /blog/[slug] is replaced by the public /posts/[slug] route.
// Keep existing links working by 308-redirecting through the page-level redirect.
export default function BlogDetailRedirect({ params }: { params: { slug: string } }) {
  redirect(`/posts/${params.slug}`);
}
