import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/");

  return (
    <main
      className="flex min-h-screen items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg,#0A3A56,#072B40)" }}
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
