import { permanentRedirect } from "next/navigation";

/** Admin moved into Settings; links to the old address (in emails, say) still arrive. */
export default function AdminPage() {
  permanentRedirect("/settings/admin");
}
