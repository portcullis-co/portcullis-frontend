import './globals.css';
import type { Metadata } from 'next';
import { ThemeProvider } from '@/app/providers/theme-provider';
import {
	ClerkProvider,
	SignInButton,
	SignedIn,
	SignedOut,
	UserButton
  } from '@clerk/nextjs'
import './globals.css'
import { Toaster } from '@/components/ui/toaster';
import { Montserrat } from 'next/font/google';

const montserrat = Montserrat({ subsets: ['latin']});

export const metadata: Metadata = {
	title: 'Portcullis | Magic Links for Enterprise Data Sharing',
	description:
		'Portcullis is a platform for securely sharing data from Clickhouse enterprises using secure magic links.',
	icons: {
		icon: '/favicon.ico',
	},
	openGraph: {
		title: 'Portcullis | Magic Links for Enterprise Data Sharing',
		description: 'Portcullis is a platform for securely sharing data from Clickhouse enterprises using secure magic links.',
		images: ['/og.png'],
	},
	twitter: {
		title: 'Portcullis | Magic Links for Enterprise Data Sharing',
		description: 'Portcullis is a platform for securely sharing data from Clickhouse enterprises using secure magic links.',
		images: ['/og.png'],
	},
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang='en' suppressHydrationWarning>
			<ThemeProvider attribute='class' defaultTheme='light' enableSystem>
			<ClerkProvider>
				<body className={montserrat.className}>{children}</body>
				<Toaster />
			</ClerkProvider>
			</ThemeProvider>
		</html>
	);
}
