import { redirect } from "next/navigation";

// Friendly alias for the new-post editor.
export default function TransmitAlias() {
  redirect("/editor/new");
}
