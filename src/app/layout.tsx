import type { Metadata, Viewport } from "next";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "@fontsource/barlow-condensed/900.css";
import { getActivePlayerAccountId, getActionRepository } from "@/app/actions/action-context";
import { ResponsiveNavigation } from "@/components/navigation/responsive-navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pickleball Matchmaker",
  description: "Fair rounds. Fresh partners. Better games.",
  applicationName: "Pickleball Matchmaker",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pickleball",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  themeColor: "#ccff00",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let playerAccount: { username: string; name?: string } | null = null;
  try {
    const accountId = await getActivePlayerAccountId();
    if (accountId) {
      const repo = getActionRepository();
      const account = await repo.getPlayerAccount(accountId);
      if (account) {
        playerAccount = { username: account.username, name: account.name };
      }
    }
  } catch {
    // Non-db fallback
  }

  return (
    <html lang="en">
      <body className="min-h-screen min-h-[100svh] flex flex-col">
        <ResponsiveNavigation playerAccount={playerAccount} />
        {/* A page marked data-fill-screen takes exactly the space left under the navigation (and
            above the phone tab bar); every other page lays out as before. */}
        <div className={`flex-1 has-[>[data-fill-screen]]:flex has-[>[data-fill-screen]]:flex-col ${playerAccount ? "pb-20 md:pb-0" : ""}`}>
          {children}
        </div>
      </body>
    </html>
  );
}

