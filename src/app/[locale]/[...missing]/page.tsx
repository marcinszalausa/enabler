import { notFound } from "next/navigation";

// Any address no page answers, inside the site's layout and language.
export default function Missing() {
  notFound();
}
