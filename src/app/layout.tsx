import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'מפתן | הבית הבא שלכם', description: 'מרחב אישי לחיפוש הבית הבא שלכם.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="he" dir="rtl"><body>{children}</body></html>;
}
