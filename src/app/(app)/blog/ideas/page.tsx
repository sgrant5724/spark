import { redirect } from "next/navigation";

// One-Loop step 4: the blog idea board merged into the one Ideas board.
// Old links land on the board filtered to articles.
export default function BlogIdeasPage() {
  redirect("/ideas?format=article");
}
