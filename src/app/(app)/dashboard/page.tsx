import { redirect } from "next/navigation";

// Home became the Inbox (One-Loop redesign, step 2). The old URL keeps working:
// every bookmark, guide link and post-signin redirect lands on the same page.
export default function DashboardPage() {
  redirect("/inbox");
}
