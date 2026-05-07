import "./globals.css";

export const metadata = {
  title: "Chandak CMIS",
  description: "AI-powered closing manager interview simulator for real estate professionals. Evaluate skills through dynamic, audio-based customer conversations.",
  keywords: "real estate, interview, simulator, AI, closing manager, training",
  openGraph: {
    title: "Chandak CMIS",
    description: "Evaluate closing managers through dynamic AI-powered customer simulations.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0a1a" />
      </head>
      <body className="" suppressHydrationWarning>
        <div className="page-container">
          {children}
        </div>
      </body>
    </html>
  );
}
