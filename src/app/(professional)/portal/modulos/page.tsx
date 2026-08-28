import { redirect } from "next/navigation";

export const metadata = { title: "Experiência" };

export default function ModulesPage() {
  redirect("/portal");
}
