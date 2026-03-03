import "./globals.css";
import { AuthProvider } from "@/lib/auth";

export const metadata = {
  title: "Trivastu Realty | Admin Dashboard",
  description: "WhatsApp-Based Real Estate Automation Platform — Admin Dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
