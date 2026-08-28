import { redirect } from "next/navigation";

export const metadata = { title: "Jogo" };

export default function GamesAdminPage() {
  redirect("/portal");
}
