import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "../components/ui/sonner";
import { TooltipProvider } from "../components/ui/tooltip";
import { Inter } from "next/font/google";
import type { Metadata } from "next";

const siteFont = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "AI Reel Enhancer",
	description: "Privacy-first AI video enhancer. Runs 100% in your browser.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head />
			<body className={`${siteFont.className} font-sans antialiased`}>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					disableTransitionOnChange={true}
				>
					<TooltipProvider>
						<Toaster />
						{children}
						<Analytics />
					</TooltipProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
