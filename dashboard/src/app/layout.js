import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { OtpProvider } from "@/components/OtpProvider";

export const metadata = {
  title: "Trivastu Realty | Admin Dashboard",
  description: "WhatsApp-Based Real Estate Automation Platform — Admin Dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <OtpProvider>
            {children}
          </OtpProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
