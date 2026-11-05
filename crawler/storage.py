import hashlib
import io
import os
import uuid
import urllib.request
from pathlib import Path
from urllib.parse import urlparse
from datetime import datetime,timezone,timedelta
from PIL import Image,UnidentifiedImageError
from psycopg.types.json import Jsonb
from parser import parse

ROOT=Path('/data/images')
MAX_BYTES=10*1024*1024
Image.MAX_IMAGE_PIXELS=25000000

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None

def download_image(url):
    opener=urllib.request.build_opener(NoRedirect())
    with opener.open(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as response:
        if int(response.headers.get('Content-Length','0'))>MAX_BYTES:raise ValueError('Image too large')
        return image_bytes(response.read(MAX_BYTES+1))

def image_bytes(data):
    if len(data)>MAX_BYTES:raise ValueError('Image too large')
    with Image.open(io.BytesIO(data)) as image:
        if image.format not in ('JPEG','PNG','WEBP'):raise ValueError('Unsupported image')
        image.load()
        if image.width<200 or image.height<150:raise ValueError('Image too small')
        image.thumbnail((1800,1800))
        output=io.BytesIO();image.convert('RGB').save(output,'WEBP',quality=85)
        return output.getvalue()

def ingest(conn,source,post,context=None,tick=lambda:None):
    now=datetime.now(timezone.utc)
    if not now-timedelta(days=3)<=post['published_at']<=now:return None
    fields=parse(post['body'])
    digest=hashlib.sha256(post['body'].encode()).hexdigest()
    with conn.transaction():
        if not conn.execute('SELECT 1 FROM sources WHERE id=%s AND approved AND publication_confirmed FOR SHARE',(source['id'],)).fetchone():return None
        old=conn.execute('SELECT * FROM posts WHERE external_id=%s FOR UPDATE',(post['external_id'],)).fetchone()
        listing_id=old['listing_id'] if old else None
        if not listing_id and fields['fingerprint']:
            match=conn.execute("SELECT id FROM listings WHERE fingerprint=%s AND published_at>=now()-interval '3 days' ORDER BY created_at LIMIT 1",(fields['fingerprint'],)).fetchone()
            if match:listing_id=match['id']
        if listing_id:
            existing=conn.execute('SELECT overrides FROM listings WHERE id=%s FOR UPDATE',(listing_id,)).fetchone()
            fields.update(existing['overrides'])
            conn.execute("UPDATE listings SET title=%s,body=%s,kind=%s,city=%s,neighborhood=%s,price=%s,rooms=%s,area=%s,amenities=%s,status=%s,fingerprint=%s,updated_at=now(),expires_at=now()+interval '30 days' WHERE id=%s",(fields['title'],fields['body'],fields['kind'],fields['city'],fields['neighborhood'],fields['price'],fields['rooms'],fields['area'],Jsonb(fields['amenities']),fields['status'],fields['fingerprint'],listing_id))
        else:
            listing_id=conn.execute('INSERT INTO listings(title,body,kind,city,neighborhood,price,rooms,area,amenities,status,fingerprint,published_at,expires_at) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id',(fields['title'],fields['body'],fields['kind'],fields['city'],fields['neighborhood'],fields['price'],fields['rooms'],fields['area'],Jsonb(fields['amenities']),fields['status'],fields['fingerprint'],post['published_at'],post['published_at']+timedelta(days=30))).fetchone()['id']
        conn.execute('INSERT INTO posts(source_id,external_id,url,body,body_hash,published_at,listing_id) VALUES(%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(external_id) DO UPDATE SET body=EXCLUDED.body,body_hash=EXCLUDED.body_hash,collected_at=now(),listing_id=EXCLUDED.listing_id',(source['id'],post['external_id'],post['url'],post['body'],digest,post['published_at'],listing_id))
    if context:save_images(conn,listing_id,post,tick)
    return listing_id

def save_images(conn,listing_id,post,tick=lambda:None):
    if not listing_id:return
    existing={row['position'] for row in conn.execute('SELECT position FROM images WHERE listing_id=%s',(listing_id,))}
    if len(existing)<len(post.get('images',[])):
        for position,url in enumerate(post.get('images',[])[:12]):
            tick()
            if position in existing:continue
            parsed=urlparse(url);host=parsed.hostname or ''
            if parsed.scheme!='https' or not (host.endswith('.fbcdn.net') or host.endswith('.fbsbx.com')):continue
            filename=None
            try:
                data=download_image(url)
                filename=str(uuid.uuid4())+'.webp';ROOT.mkdir(parents=True,exist_ok=True)
                temp=ROOT/(filename+'.tmp');temp.write_bytes(data);temp.replace(ROOT/filename)
                conn.execute('INSERT INTO images(listing_id,filename,mime,position) VALUES(%s,%s,%s,%s)',(listing_id,filename,'image/webp',position))
            except Exception:
                if filename:(ROOT/filename).unlink(missing_ok=True)

def cleanup(conn):
    conn.execute("UPDATE listings SET status='expired' WHERE status='published' AND expires_at<=now()")
    # Bytes first: a failed file deletion retains metadata for the next retry.
    rows=conn.execute("SELECT i.id,i.filename FROM images i JOIN listings l ON l.id=i.listing_id WHERE l.published_at<now()-interval '6 months'").fetchall()
    for row in rows:
        (ROOT/Path(row['filename']).name).unlink(missing_ok=True)
        conn.execute('DELETE FROM images WHERE id=%s',(row['id'],))
    conn.execute("DELETE FROM posts WHERE published_at<now()-interval '6 months'")
    conn.execute("DELETE FROM listings WHERE published_at<now()-interval '6 months' AND NOT EXISTS(SELECT 1 FROM images WHERE listing_id=listings.id)")
    conn.execute("DELETE FROM quarantine WHERE created_at<now()-interval '6 months'")
    conn.execute("DELETE FROM jobs WHERE finished_at<now()-interval '30 days'")
    conn.execute("DELETE FROM sessions WHERE expires_at<now()")
    conn.execute("DELETE FROM login_attempts WHERE window_start<now()-interval '1 day'")
    conn.execute("DELETE FROM removal_requests WHERE created_at<now()-interval '6 months'")
    known={row['filename'] for row in conn.execute('SELECT filename FROM images')}
    if ROOT.exists():
        for file in ROOT.iterdir():
            if file.is_file() and file.name not in known and file.stat().st_mtime<datetime.now(timezone.utc).timestamp()-3600:file.unlink()
