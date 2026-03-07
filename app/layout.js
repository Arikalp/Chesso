import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/Toast";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Chesso - Multiplayer Chess Game",
  description: "Play chess online with friends in real-time",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicons/chesso.ico",
    apple: "/icons/logo.jpg",
  },
};

export const viewport = {
  themeColor: "#667eea",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <ThemeProvider>
            <ToastProvider>
              <ServiceWorkerRegister />
              {children}
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
