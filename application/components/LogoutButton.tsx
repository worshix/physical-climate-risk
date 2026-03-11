"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/auth/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="text-slate-400 hover:text-red-600"
      onClick={handleLogout}
    >
      <LogOut className="h-5 w-5" />
    </Button>
  );
}
