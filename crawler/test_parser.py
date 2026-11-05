import unittest
from parser import parse,redact
from facebook import canonical_post,publication_date

class ParserTests(unittest.TestCase):
    def test_rental(self):
        result=parse('להשכרה דירת 3.5 חדרים בתל אביב, 85 מ״ר, מחיר 7,500 ש״ח. מרפסת וחניה, ללא מעלית')
        self.assertEqual((result['kind'],result['city'],result['price'],result['rooms'],result['area']),('rent','תל אביב',7500,3.5,85))
        self.assertEqual(result['status'],'published');self.assertTrue(result['amenities']['balcony']);self.assertNotIn('elevator',result['amenities'])
    def test_unknowns(self):
        result=parse('דירה להשכרה בחיפה, פרטים בפרטי')
        self.assertIsNone(result['price']);self.assertIsNone(result['rooms']);self.assertIsNone(result['area'])
        self.assertEqual(result['status'],'review')
    def test_three_of_four_categories(self):
        for body in ['דירה להשכרה בחיפה 4500 ש״ח', 'דירת 3 חדרים בחיפה 4500 ש״ח', 'דירה להשכרה 80 מ״ר 4500 ש״ח', 'דירת 3 חדרים להשכרה בחיפה']:
            self.assertEqual(parse(body)['status'],'published',body)
        self.assertEqual(parse('דירה בחיפה 3 חדרים 80 מ״ר')['status'],'review')
    def test_wanted(self):self.assertEqual(parse('מחפשת דירה להשכרה בתל אביב')['status'],'review')
    def test_sale(self):self.assertEqual(parse('דירה למכירה בחיפה ב 2.5 מיליון')['price'],2500000)
    def test_sale_asking_price_not_rental_income(self):
        cases=[
            ('כל היחידות מושכרות ומכניסות 6500 שח נטו!\nמחיר שיווק הנכס = 1,080,000₪',1080000),
            ('שכירות 5,000 ש״ח. מחיר מכירה 2,100,000 ש״ח',2100000),
            ('מחיר 2,100,000 ש״ח, מושכרת ב-5,000 ש״ח',2100000),
            ('מושכרת ב-5000 ש״ח מחיר מבוקש 2100000',2100000),
            ('מחיר 1.080.000 ₪',1080000),
            ('מחיר 2,5 מיליון, שכר דירה 6000 ₪',2500000),
            ('מכניסה 6500 שח נטו',None),
            ('6500 ₪ לחודש',None),
            ('שכירות שנתית 78000 ₪',None),
            ('הכנסה משכירות:\n6500 ₪',None),
            ('שכירות 6500 ₪\nמחיר מבוקש:\n1,080,000 ₪',1080000),
            ('מחיר בפרטי. הון עצמי 500,000 ₪',None),
            ('מחיר 2 מיליון או 2.2 מיליון',None),
            ('מחיר למ״ר 20,000 ₪',None),
            ('למכירה בית 5 חדרים',None),
            ('למכירה מתחם:\n1,500 מ"ר',None),
            ('מחיר חדש ומעודכן: 3.75 מיליון ש"ח (במקום 3.9 מיליון ש"ח)',3750000),
            ('רק 605,000 ₪!\nדמי תיווך: 20,000 ₪ בלבד',605000),
            ('תקציב רכישה עד מיליון ₪, אפשרות להשקיע עוד 100–150 אלף ₪ בשיפוץ',None),
        ]
        for body,expected in cases:
            with self.subTest(body=body):self.assertEqual(parse('דירה למכירה בחיפה. '+body)['price'],expected)
    def test_redact(self):
        text=redact('להתקשר 050-1234567 או a@example.com https://example.com')
        self.assertNotIn('050',text);self.assertNotIn('@',text);self.assertNotIn('https',text)
    def test_identity(self):
        self.assertEqual(canonical_post('https://www.facebook.com/groups/123/posts/456/?x=1','123')[0],'456')
        self.assertIsNone(canonical_post('https://evil.com/groups/123/posts/456/','123'))
        self.assertIsNone(canonical_post('https://www.facebook.com/groups/999/posts/456/','123'))
    def test_dates(self):
        self.assertIsNone(publication_date(['2 hours ago','November 4']))
        self.assertEqual(publication_date(['2026-11-04T08:30:00+02:00']).hour,6)
    def test_hebrew_tooltip(self):
        result=publication_date(['\u200fרביעי, 4 בנובמבר 2026 ב-12:50'])
        self.assertEqual(result.isoformat(),'2026-11-04T10:50:00+00:00')
        self.assertIsNone(publication_date(['31 בפברואר 2026 ב-12:50']))
    def test_english_tooltip(self):
        self.assertEqual(publication_date(['Wednesday, November 4, 2026 at 12:50 PM']).hour,10)
    def test_short_cross_posts(self):
        body='להשכרה דירת 3 חדרים בחיפה 4500 ש״ח'
        self.assertIsNotNone(parse(body)['fingerprint'])
        self.assertEqual(parse(body)['fingerprint'],parse(body.replace(' ', '  '))['fingerprint'])
        self.assertNotEqual(parse(body+' 0501234567')['fingerprint'],parse(body+' 0509876543')['fingerprint'])

if __name__=='__main__':unittest.main()
