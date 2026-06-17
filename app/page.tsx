import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardClient from "./components/DashboardClient";

export default async function Home() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    redirect("/login");
  }

  return <DashboardClient userEmail={email} />;
}
