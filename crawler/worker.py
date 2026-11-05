import json
import os
import signal
import subprocess
import time
import uuid

class ConnectionActionRequested(Exception): pass
from datetime import datetime,timedelta,timezone
from pathlib import Path
import psycopg
from psycopg.rows import dict_row
from playwright.sync_api import sync_playwright
from facebook import Facebook,LoginRequired,LayoutChanged,CollectionIncomplete
from storage import ingest,cleanup
from parser import redact

stop=False
def shutdown(*_):
    global stop
    stop=True
signal.signal(signal.SIGTERM,shutdown);signal.signal(signal.SIGINT,shutdown)
def log(event,**fields):print(json.dumps({'time':datetime.now(timezone.utc).isoformat(),'event':event,**fields}),flush=True)

def run():
    conn=psycopg.connect('',autocommit=True,row_factory=dict_row)
    if not conn.execute('SELECT pg_try_advisory_lock(834193) AS acquired').fetchone()['acquired']:
        conn.close();raise RuntimeError('Another crawler owns the browser session')
    current=None;last_beat=0;last_cleanup=0;retry_at=0
    def tick(force=False):
        nonlocal last_beat
        if stop:raise InterruptedError()
        if force or time.monotonic()-last_beat>10:
            conn.execute('UPDATE crawler_state SET heartbeat=now() WHERE id=1')
            if current and current['kind']!='recover' and conn.execute("SELECT disconnect_requested OR EXISTS(SELECT 1 FROM jobs WHERE kind='recover' AND status='queued') AS interrupt FROM crawler_state WHERE id=1").fetchone()['interrupt']:
                raise ConnectionActionRequested()
            if current:conn.execute("UPDATE jobs SET lease_until=now()+interval '2 minutes' WHERE id=%s AND status='running'",(current['id'],))
            Path('/tmp/miftan-heartbeat').touch();last_beat=time.monotonic()
    def state(status,message=None):conn.execute('UPDATE crawler_state SET status=%s,message=%s,heartbeat=now() WHERE id=1',(status,message));tick(True)
    xvfb=subprocess.Popen(['Xvfb',':99','-screen','0','1440x1000x24','-nolisten','tcp'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    recovery=[];recovery_deadline=0
    try:
        time.sleep(1)
        with sync_playwright() as p:
            def launch():
                profile=conn.execute('SELECT browser_profile FROM crawler_state WHERE id=1').fetchone()['browser_profile']
                directory='/data/browser' if profile=='legacy' else '/data/browser/accounts/'+str(uuid.UUID(profile))
                return p.chromium.launch_persistent_context(directory,headless=False,viewport={'width':1440,'height':1000},locale='en-US',timezone_id='Asia/Jerusalem',accept_downloads=False,args=['--disable-dev-shm-usage'])
            context=launch()
            # Recovery viewer processes do not survive a worker restart.
            conn.execute('UPDATE crawler_state SET recovery_until=NULL,facebook_connected=false WHERE id=1')
            fb=Facebook(context,tick,lambda external_id,name:conn.execute('UPDATE sources SET name=%s WHERE external_id=%s',(name,external_id)))
            def verify():
                try:
                    fb.login()
                    conn.execute('UPDATE crawler_state SET facebook_connected=true WHERE id=1 AND NOT disconnect_requested')
                    state('idle','מחובר לפייסבוק. אפשר לגלות קבוצות ולהתחיל לאסוף.')
                except LoginRequired:
                    conn.execute('UPDATE crawler_state SET facebook_connected=false WHERE id=1')
                    state('needs_login','שלב 1: התחברו לפייסבוק לפני גילוי קבוצות ואיסוף.')
            verify()
            while not stop:
                tick()
                connection=conn.execute('SELECT * FROM crawler_state WHERE id=1').fetchone()
                if connection['disconnect_requested']:
                    for proc in recovery:proc.terminate()
                    for proc in recovery:proc.wait(timeout=10)
                    recovery=[]
                    context.clear_cookies()
                    context.close()
                    conn.execute("UPDATE jobs SET status='failed',error='Facebook disconnected',finished_at=now(),lease_until=NULL WHERE status IN ('queued','running')")
                    conn.execute("UPDATE crawler_state SET browser_profile=%s,facebook_connected=false,recovery_until=NULL WHERE id=1",(str(uuid.uuid4()),))
                    context=launch()
                    fb=Facebook(context,tick,lambda external_id,name:conn.execute('UPDATE sources SET name=%s WHERE external_id=%s',(name,external_id)))
                    conn.execute('UPDATE crawler_state SET disconnect_requested=false WHERE id=1')
                    state('needs_login','פייסבוק נותק. אפשר להתחבר עכשיו לחשבון אחר.')
                    retry_at=0
                    continue
                requested_end=conn.execute('SELECT recovery_until FROM crawler_state WHERE id=1').fetchone()['recovery_until'] if recovery else None
                if recovery and (time.monotonic()>recovery_deadline or not requested_end or requested_end<=datetime.now(timezone.utc)):
                    for proc in recovery:proc.terminate()
                    for proc in recovery:proc.wait(timeout=10)
                    recovery=[];conn.execute('UPDATE crawler_state SET recovery_until=NULL WHERE id=1');retry_at=0
                    verify()
                if recovery:
                    time.sleep(1);continue
                if time.monotonic()-last_cleanup>3600:
                    cleanup(conn);last_cleanup=time.monotonic()
                conn.execute("UPDATE jobs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END,error='Worker lease expired',finished_at=CASE WHEN attempts>=3 THEN now() ELSE NULL END WHERE status='running' AND lease_until<now()")
                connected=conn.execute('SELECT facebook_connected FROM crawler_state WHERE id=1').fetchone()['facebook_connected']
                if connected and time.monotonic()>=retry_at:
                    conn.execute("INSERT INTO jobs(kind,source_id) SELECT 'sync',id FROM sources WHERE approved AND publication_confirmed AND next_run_at<=now() ON CONFLICT DO NOTHING")
                current=conn.execute("WITH picked AS (SELECT id FROM jobs WHERE status='queued' AND (kind='recover' OR %s) ORDER BY (kind='recover') DESC,created_at FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE jobs SET status='running',attempts=attempts+1,lease_until=now()+interval '2 minutes' FROM picked WHERE jobs.id=picked.id RETURNING jobs.*",(connected and time.monotonic()>=retry_at,)).fetchone()
                if not current:time.sleep(2);continue
                try:
                    if current['kind']=='recover':
                        conn.execute('UPDATE crawler_state SET facebook_connected=false WHERE id=1')
                        fb.page.goto('https://www.facebook.com/',wait_until='domcontentloaded',timeout=60000)
                        # Port only becomes active during an explicit admin-requested, timed recovery.
                        recovery=[subprocess.Popen(['x11vnc','-display',':99','-rfbport','5900','-localhost','-forever','-shared','-nopw'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL),subprocess.Popen(['websockify','--web=/usr/share/novnc/','6080','127.0.0.1:5900'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)]
                        recovery_deadline=time.monotonic()+600
                        conn.execute("UPDATE crawler_state SET recovery_until=now()+interval '10 minutes' WHERE id=1")
                        state('recovery','חלון התחברות מקומי פתוח ל־10 דקות. האיסוף מושהה בזמן זה.')
                    else:
                        fb.login()
                        if current['kind']=='discover':
                            state('discovering','מגלה קבוצות נגישות לחשבון')
                            for source in fb.discover():conn.execute('INSERT INTO sources(external_id,name,url) VALUES(%s,%s,%s) ON CONFLICT(external_id) DO UPDATE SET name=EXCLUDED.name',(source['id'],source['name'],source['url']))
                        else:
                            sources=conn.execute('SELECT * FROM sources WHERE approved AND publication_confirmed AND (%s::uuid IS NULL OR id=%s)',(current['source_id'],current['source_id'])).fetchall()
                            state('collecting','אוסף מודעות מהמקורות המאושרים')
                            for source in sources:
                                tick()
                                cutoff=datetime.now(timezone.utc)-timedelta(days=3)
                                # Revisit recent posts to catch edits; content hashes prevent duplicate writes.
                                valid=0;quarantined=0
                                for post in fb.collect(source,cutoff):
                                    tick()
                                    if 'reason' in post:
                                        quarantined+=1
                                        conn.execute('INSERT INTO quarantine(source_id,reason,body) SELECT %s,%s,%s WHERE NOT EXISTS(SELECT 1 FROM quarantine WHERE source_id=%s AND reason=%s AND body=%s)',(source['id'],post['reason'],redact(post['body'])[:15000],source['id'],post['reason'],redact(post['body'])[:15000]))
                                    else:
                                        ingest(conn,source,post,context,tick);valid+=1
                                if quarantined and not valid:raise LayoutChanged('All observed posts require identity/date review')
                                conn.execute("UPDATE sources SET last_success_at=now(),last_error=NULL,next_run_at=now()+(%s * interval '1 minute') WHERE id=%s",(max(5,int(os.getenv('CRAWL_INTERVAL_MINUTES','30'))),source['id']))
                        state('idle','האיסוף הושלם; ממתין לעדכון הבא')
                    conn.execute("UPDATE jobs SET status='completed',finished_at=now(),lease_until=NULL WHERE id=%s",(current['id'],));log('job_completed',kind=current['kind'])
                except ConnectionActionRequested:
                    conn.execute("UPDATE jobs SET status='queued',lease_until=NULL WHERE id=%s",(current['id'],))
                except LoginRequired:
                    conn.execute('UPDATE crawler_state SET facebook_connected=false WHERE id=1')
                    state('needs_login','נדרשת התחברות לפייסבוק. פתחו חלון שחזור מקומי ובצעו אימות.')
                    conn.execute("UPDATE jobs SET status='queued',error='Facebook login required',lease_until=NULL WHERE id=%s",(current['id'],));retry_at=time.monotonic()+1800
                except InterruptedError:raise
                except Exception as error:
                    # Exception text can contain browser URLs, tokens and rendered text; log class only.
                    label='Facebook layout or source access needs review' if isinstance(error,LayoutChanged) else 'Scroll limit reached; partial collection' if isinstance(error,CollectionIncomplete) else type(error).__name__
                    conn.execute("UPDATE jobs SET status='failed',error=%s,finished_at=now(),lease_until=NULL WHERE id=%s",(label,current['id']))
                    if current['source_id']:conn.execute("UPDATE sources SET last_error=%s,next_run_at=now()+interval '1 hour' WHERE id=%s",(label,current['source_id']))
                    state('error','האיסוף לא הושלם. בדקו את החיבור ואת המקור ונסו שוב.');retry_at=time.monotonic()+60;log('job_failed',error=label)
                finally:current=None
            context.close()
    finally:
        for proc in recovery:
            proc.terminate()
            proc.wait(timeout=10)
        xvfb.terminate()
        xvfb.wait(timeout=10)
        conn.close()

if __name__=='__main__':
    while not stop:
        try:run()
        except InterruptedError:break
        except Exception as error:
            log('worker_restart',error=type(error).__name__)
            for _ in range(15):
                if stop:break
                time.sleep(1)
