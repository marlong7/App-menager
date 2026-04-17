export const metadata = {
  title: "App-menager",
  description: "Backend online",
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}