"""Worker lifecycle test, only in the isolated test database/browser container."""
import os
import subprocess
import time
import unittest
import psycopg
from psycopg.rows import dict_row


class ConnectionTests(unittest.TestCase):
    def test_disconnect_and_login_first(self):
        if os.getenv('PGDATABASE')!='miftan_test':raise RuntimeError('Isolated database required')
        with psycopg.connect('',autocommit=True,row_factory=dict_row) as conn:
            conn.execute('TRUNCATE jobs')
            conn.execute("UPDATE crawler_state SET facebook_connected=false,disconnect_requested=false,recovery_until=NULL,browser_profile='legacy',status='starting' WHERE id=1")
            worker=subprocess.Popen(['python','worker.py'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            def wait_for(predicate):
                deadline=time.monotonic()+90
                while time.monotonic()<deadline:
                    row=conn.execute('SELECT * FROM crawler_state WHERE id=1').fetchone()
                    if predicate(row):return row
                    time.sleep(0.5)
                self.fail('Timed out waiting for connection lifecycle')
            try:
                wait_for(lambda row:row['status']=='needs_login')
                job=conn.execute("INSERT INTO jobs(kind) VALUES('sync') RETURNING id").fetchone()['id']
                time.sleep(3)
                self.assertEqual(conn.execute('SELECT status FROM jobs WHERE id=%s',(job,)).fetchone()['status'],'queued')
                conn.execute("INSERT INTO jobs(kind) VALUES('recover')")
                wait_for(lambda row:row['status']=='recovery')
                conn.execute('UPDATE crawler_state SET disconnect_requested=true,facebook_connected=false WHERE id=1')
                row=wait_for(lambda row:row['status']=='needs_login' and not row['disconnect_requested'])
                self.assertNotEqual(row['browser_profile'],'legacy')
                self.assertFalse(row['facebook_connected'])
                self.assertIsNone(row['recovery_until'])
                self.assertEqual(conn.execute('SELECT status FROM jobs WHERE id=%s',(job,)).fetchone()['status'],'failed')
                conn.execute("INSERT INTO jobs(kind) VALUES('recover')")
                wait_for(lambda row:row['status']=='recovery')
                conn.execute('UPDATE crawler_state SET recovery_until=now() WHERE id=1')
                row=wait_for(lambda row:row['status']=='needs_login')
                self.assertFalse(row['facebook_connected'])
            finally:
                worker.terminate()
                try:worker.wait(timeout=15)
                except subprocess.TimeoutExpired:worker.kill();worker.wait()


if __name__=='__main__':unittest.main()
