import { Orbitron, Rajdhani, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/Toast";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  display: "swap",
});
const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rajdhani",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "Chesso — Chess Reimagined",
  description: "Play chess online vs friends or AI. Real-time multiplayer chess with gamified UI.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicons/chesso.ico",
    apple: "/icons/logo.jpg",
  },
};

export const viewport = {
  themeColor: "#f5c542",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${orbitron.variable} ${rajdhani.variable} ${inter.variable}`}>
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
