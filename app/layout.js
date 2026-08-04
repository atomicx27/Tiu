import { Nunito, DM_Sans, DM_Mono, Caveat } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata = {
  title: "Saisha's Birthday Video Box 🎈",
  description: "A playful collection of beautiful video memories created by Tiu for Saisha's birthday.",
  icons: {
    icon: '/favicon.ico',
  }
};

export default function RootLayout({ children }) {
  return (
    <html 
      lang="en" 
      className={`${nunito.variable} ${dmSans.variable} ${dmMono.variable} ${caveat.variable}`}
      style={{
        // Set fallback variables in case font loaders fail
        '--font-nunito': 'Nunito, sans-serif',
        '--font-dm-sans': 'DM Sans, sans-serif',
        '--font-dm-mono': 'DM Mono, monospace',
        '--font-caveat': 'Caveat, cursive',
      }}
    >
      <body>
        {children}
      </body>
    </html>
  );
}
