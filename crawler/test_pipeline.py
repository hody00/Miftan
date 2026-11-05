"""Real PostgreSQL lifecycle tests; refuse the production database."""
import io
import os
import unittest
from datetime import datetime,timedelta,timezone
import psycopg
from psycopg.rows import dict_row
from PIL import Image
import storage

class PipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if os.getenv('PGDATABASE')!='miftan_test':raise RuntimeError('Tests require isolated miftan_test database')
        cls.conn=psycopg.connect('',autocommit=True,row_factory=dict_row)
    @classmethod
    def tearDownClass(cls):cls.conn.close()
    def setUp(self):
        self.conn.execute('TRUNCATE sources,listings,posts,images,jobs,quarantine,removal_requests CASCADE')
        self.source=self.conn.execute("INSERT INTO sources(external_id,name,url) VALUES('999999','בדיקות בלבד','https://www.facebook.com/groups/999999/') RETURNING *").fetchone()
        self.post={'external_id':'888888','url':'https://www.facebook.com/groups/999999/posts/888888/','published_at':datetime.now(timezone.utc),'body':'להשכרה דירת 3 חדרים בחיפה, בשכונת הדר. 80 מ״ר, מחיר 4,500 ש״ח. מרפסת וחניה. דירה מרווחת ומוארת עם חלונות גדולים ונוף פתוח, במרחק הליכה מהתחבורה הציבורית ומהחנויות.','images':[]}
    def approve(self):self.conn.execute('UPDATE sources SET approved=true,publication_confirmed=true WHERE id=%s',(self.source['id'],))
    def test_three_day_ingestion_window(self):
        self.approve()
        for date in [datetime.now(timezone.utc)-timedelta(days=3,seconds=1),datetime.now(timezone.utc)+timedelta(hours=1)]:
            self.assertIsNone(storage.ingest(self.conn,self.source,{**self.post,'published_at':date}))
        self.assertIsNotNone(storage.ingest(self.conn,self.source,{**self.post,'published_at':datetime.now(timezone.utc)-timedelta(days=2)}))
    def test_approval_dedup_edits_and_retention(self):
        self.assertIsNone(storage.ingest(self.conn,self.source,self.post))
        self.approve();lid=storage.ingest(self.conn,self.source,self.post)
        self.assertIsNotNone(lid)
        self.assertEqual(storage.ingest(self.conn,self.source,self.post),lid)
        cross={**self.post,'external_id':'888889','url':'https://www.facebook.com/groups/999999/posts/888889/'}
        self.assertEqual(storage.ingest(self.conn,self.source,cross),lid)
        self.conn.execute("UPDATE listings SET price=4200,overrides='{\"price\":4200}' WHERE id=%s",(lid,))
        self.post['body']+=' כניסה מיידית.'
        storage.ingest(self.conn,self.source,self.post)
        row=self.conn.execute('SELECT * FROM listings WHERE id=%s',(lid,)).fetchone()
        self.assertEqual(row['price'],4200);self.assertEqual(row['status'],'published')
        self.conn.execute("UPDATE listings SET expires_at=now()-interval '1 day' WHERE id=%s",(lid,));storage.cleanup(self.conn)
        self.assertEqual(self.conn.execute('SELECT status FROM listings WHERE id=%s',(lid,)).fetchone()['status'],'expired')
        storage.ROOT.mkdir(parents=True,exist_ok=True);(storage.ROOT/'retention-test.webp').write_bytes(b'test')
        self.conn.execute("INSERT INTO images(listing_id,filename,mime) VALUES(%s,'retention-test.webp','image/webp')",(lid,))
        self.conn.execute("UPDATE listings SET published_at=now()-interval '7 months' WHERE id=%s",(lid,))
        self.conn.execute("UPDATE posts SET published_at=now()-interval '7 months' WHERE listing_id=%s",(lid,))
        storage.cleanup(self.conn)
        self.assertFalse((storage.ROOT/'retention-test.webp').exists())
        self.assertIsNone(self.conn.execute('SELECT id FROM listings WHERE id=%s',(lid,)).fetchone())
    def test_image_validation(self):
        with self.assertRaises(Exception):storage.image_bytes(b'not an image')
        data=io.BytesIO();Image.new('RGB',(400,300),'green').save(data,'PNG')
        converted=storage.image_bytes(data.getvalue());self.assertEqual(Image.open(io.BytesIO(converted)).format,'WEBP')
    def test_lease_recovery_and_unique_job(self):
        self.conn.execute("INSERT INTO jobs(kind,source_id,status,attempts,lease_until) VALUES('sync',%s,'running',1,now()-interval '1 minute')",(self.source['id'],))
        self.conn.execute("INSERT INTO jobs(kind,source_id) VALUES('sync',%s) ON CONFLICT DO NOTHING",(self.source['id'],))
        self.assertEqual(self.conn.execute('SELECT count(*) n FROM jobs').fetchone()['n'],1)
        self.conn.execute("UPDATE jobs SET status='queued' WHERE status='running' AND lease_until<now()")
        self.assertEqual(self.conn.execute('SELECT status FROM jobs').fetchone()['status'],'queued')
    def tearDown(self):self.conn.execute('TRUNCATE sources,listings,posts,images,jobs,quarantine,removal_requests CASCADE')

if __name__=='__main__':unittest.main()
