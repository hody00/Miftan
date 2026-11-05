"""Fixtures only for the isolated browser-test database."""
import os
from datetime import datetime,timezone
import psycopg
from psycopg.rows import dict_row
from storage import ingest
if os.getenv('PGDATABASE')!='miftan_test':raise RuntimeError('Refusing to seed non-test database')
with psycopg.connect('',autocommit=True,row_factory=dict_row) as conn:
    source=conn.execute("INSERT INTO sources(external_id,name,url,approved,publication_confirmed) VALUES('999999','מקור בדיקה','https://www.facebook.com/groups/999999/',true,true) ON CONFLICT(external_id) DO UPDATE SET approved=true RETURNING *").fetchone()
    ingest(conn,source,{'external_id':'777777','url':'https://www.facebook.com/groups/999999/posts/777777/','published_at':datetime.now(timezone.utc),'body':'להשכרה דירת 3 חדרים בחיפה, בשכונת הדר. 80 מ״ר, מחיר 4,500 ש״ח. מרפסת וחניה. מודעה לבדיקות אוטומטיות בלבד.','images':[]})
print('Test fixtures ready in miftan_test only')
