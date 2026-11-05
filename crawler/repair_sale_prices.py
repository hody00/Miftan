"""Recheck saved sale prices without renewing listings or changing admin overrides."""
import argparse
import json
import psycopg
from psycopg.rows import dict_row
from parser import parse


def main():
    args=argparse.ArgumentParser()
    args.add_argument('--apply',action='store_true')
    options=args.parse_args()
    changes=[]
    with psycopg.connect('',row_factory=dict_row) as conn:
        rows=conn.execute("""SELECT l.id,l.price,l.overrides,p.body FROM listings l
            JOIN LATERAL (SELECT body FROM posts WHERE listing_id=l.id
                ORDER BY collected_at DESC,published_at DESC,id LIMIT 1) p ON true
            WHERE l.kind='sale' FOR UPDATE OF l""").fetchall()
        for row in rows:
            if 'price' in row['overrides']:continue
            fields=parse(row['body'])
            price=fields['price'] if fields['kind']=='sale' else None
            if price==row['price']:continue
            changes.append({'id':str(row['id']),'before':row['price'],'after':price})
            if options.apply:
                conn.execute('UPDATE listings SET price=%s,updated_at=now() WHERE id=%s',(price,row['id']))
        print(json.dumps({'applied':options.apply,'examined':len(rows),'changes':changes}))


if __name__=='__main__':main()
