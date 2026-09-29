"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

import Logo from "@/components/Logo";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace("/lobby");
      } else {
        router.replace("/auth");
      }
    }
  }, [user, loading, router]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "16px",
      }}
    >
      <Logo size="xl" showTagline={true} taglineText="Loading Grandmaster Arena..." />
    </div>
  );
}
