import { redirect } from "next/navigation";

export const metadata = { title: "Experiência" };

export function generateStaticParams() {
  return [{ id: "habitos-saudaveis" }];
}

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  void params;
  redirect("/portal");
}
