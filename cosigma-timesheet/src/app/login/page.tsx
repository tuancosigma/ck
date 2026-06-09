import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { FloatingParticles } from "@/components/login/floating-particles";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      {/* Full-bleed branded background with a slow Ken Burns zoom */}
      <div
        aria-hidden
        className="ken-burns absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/login/cosigma-office-lounge-bg.png')" }}
      />
      {/* Frosted dark radial mask for an ultra-modern, legible foreground */}
      <div
        aria-hidden
        className="absolute inset-0 backdrop-blur-md"
        style={{
          background:
            "radial-gradient(circle at 50% 38%, rgba(2,6,23,0.55), rgba(2,6,23,0.9) 72%)",
        }}
      />
      <FloatingParticles count={10} />
      <LoginForm />
    </div>
  );
}
