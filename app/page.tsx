import { redirect } from "next/navigation";

export default function PaginaInicial(): never {
  redirect("/dashboard");
}
