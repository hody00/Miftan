import Link from 'next/link';
export function Brand() {
  return <Link href="/" className="brand" aria-label="מפתן — לדף הבית"><span className="brand-mark" aria-hidden="true">מ</span><span>מפתן<span className="brand-caption">מקום להתחיל בו</span></span></Link>;
}
