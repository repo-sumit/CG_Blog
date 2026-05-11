import { redirect } from "next/navigation";

// Friendly alias for the archive/trash view. /me/posts already shows the
// archived bin at the bottom; this alias drops users in the right place
// without forcing a route rename.
export default function ArchiveAlias() {
  redirect("/me/posts#trash");
}
