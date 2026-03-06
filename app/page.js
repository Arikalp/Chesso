"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

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
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        color: "white",
        fontSize: "2rem",
      }}
    >
      ♔ Loading Chesso... ♛
    </div>
  );
}
