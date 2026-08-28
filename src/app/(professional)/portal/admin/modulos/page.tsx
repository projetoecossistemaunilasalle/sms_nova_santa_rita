import { redirect } from "next/navigation";

export const metadata = { title: "Disponibilidade" };

export default function ModuleAvailabilityPage() {
  redirect("/portal");
}
