"""Rendered-page adapter. No private APIs, stealth plugins, or challenge bypasses."""
import os
import re
import time
from datetime import datetime, timezone
from urllib.parse import urlparse, parse_qs
from dateutil import parser as dates

HEBREW_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
PHOTO_IMAGES = '''el => [...new Set([...el.querySelectorAll('a[href*="/photo"] img')]
  .filter(i => i.closest('[role="article"]') === el)
  .filter(i => (i.naturalWidth >= 200 && i.naturalHeight >= 150) ||
    (i.getBoundingClientRect().width >= 200 && i.getBoundingClientRect().height >= 150))
  .map(i => i.currentSrc || i.src).filter(Boolean))]'''

class LoginRequired(Exception): pass
class LayoutChanged(Exception): pass
class CollectionIncomplete(Exception): pass

def canonical_post(url, group_id):
    parsed=urlparse(url)
    if parsed.hostname not in ('www.facebook.com','facebook.com','m.facebook.com'): return None
    match=re.search(r'/groups/([^/]+)/(?:posts|permalink)/(\d+)',parsed.path)
    if match:
        if match.group(1)!=str(group_id):return None
        return match.group(2),f'https://www.facebook.com/groups/{group_id}/posts/{match.group(2)}/'
    qs=parse_qs(parsed.query)
    match=re.match(r'/groups/'+re.escape(str(group_id))+r'/?$',parsed.path)
    if match and qs.get('multi_permalinks',[None])[0] and qs['multi_permalinks'][0].isdigit():
        pid=qs['multi_permalinks'][0];return pid,f'https://www.facebook.com/groups/{group_id}/posts/{pid}/'
    return None

def publication_date(raw):
    for value in raw:
        if not value:continue
        try:
            value=re.sub(r'[\u200e\u200f\u202a-\u202e\u2066-\u2069]', '', str(value)).strip()
            hebrew=re.search(r'(\d{1,2})\s+ב?('+'|'.join(HEBREW_MONTHS)+r')\s+(20\d{2})(?:\s+ב[-־]?(\d{1,2}):(\d{2}))?',value)
            if hebrew:
                from zoneinfo import ZoneInfo
                day,month,year,hour,minute=hebrew.groups()
                return datetime(int(year),HEBREW_MONTHS.index(month)+1,int(day),int(hour or 0),int(minute or 0),tzinfo=ZoneInfo('Asia/Jerusalem')).astimezone(timezone.utc)
            value=re.sub(r'\s+at\s+', ' ', value, flags=re.I)
            if str(value).isdigit() and len(str(value))==10:return datetime.fromtimestamp(int(value),timezone.utc)
            # Accept explicit ISO or English full dates only, never infer today from a relative label.
            if not re.search(r'\b20\d{2}\b',str(value)):continue
            dt=dates.parse(str(value),fuzzy=False)
            if dt.tzinfo is None:
                from zoneinfo import ZoneInfo
                dt=dt.replace(tzinfo=ZoneInfo('Asia/Jerusalem'))
            return dt.astimezone(timezone.utc)
        except (ValueError,OverflowError,TypeError):continue
    return None

class Facebook:
    def __init__(self,context,tick,update_source_name=None):
        self.context=context;self.page=context.pages[0] if context.pages else context.new_page();self.tick=tick
        self.update_source_name=update_source_name
    def group_name(self):
        # Read the visible group heading, never navigation labels such as "View group".
        headings=self.page.locator('h1, [role="heading"][aria-level="1"]')
        for heading in headings.all():
            if not heading.is_visible():continue
            if heading.evaluate('el => !!el.closest(\'[role="article"], [role="dialog"], [role="navigation"], [role="banner"]\')'):continue
            name=' '.join(heading.inner_text().split())
            if name and name.casefold() not in ('facebook','groups','קבוצות'):
                return name
        return None
    def resolve_group_name(self,url):
        self.page.goto(url,wait_until='domcontentloaded',timeout=60000)
        for _ in range(5):
            self.page.wait_for_timeout(1000);self.check()
            name=self.group_name()
            if name:return name
        raise LayoutChanged('Visible Facebook group name unavailable')
    def check(self):
        self.tick()
        if any(s in self.page.url for s in ['/checkpoint','/two_step_verification','/recover','/login']):raise LoginRequired('Facebook requires account verification')
        if self.page.locator('input[name="pass"]').count():raise LoginRequired('Facebook session expired')
        if self.page.locator('iframe[src*="captcha"], input[name="approvals_code"]').count():raise LoginRequired('Facebook requires account verification')
    def login(self):
        self.page.goto('https://www.facebook.com/',wait_until='domcontentloaded',timeout=60000)
        if self.page.locator('input[name="email"]').count():
            email=os.getenv('FACEBOOK_EMAIL');password=os.getenv('FACEBOOK_PASSWORD')
            if not email or not password:raise LoginRequired('Configure credentials or open the local recovery browser')
            self.page.locator('input[name="email"]').fill(email)
            self.page.locator('input[name="pass"]').fill(password)
            self.page.locator('button[name="login"]').click()
            self.page.wait_for_timeout(5000)
        self.check()
    def discover(self):
        self.page.goto('https://www.facebook.com/groups/joins/',wait_until='domcontentloaded',timeout=60000)
        found={};unchanged=0
        for _ in range(min(int(os.getenv('MAX_SCROLLS','30')),100)):
            self.page.wait_for_timeout(2000);self.check()
            links=self.page.locator('a[href*="/groups/"]').evaluate_all('(els)=>els.map(e=>({url:e.href,name:e.innerText.trim()}))')
            before=len(found)
            for link in links:
                match=re.search(r'^https://(?:www\.)?facebook\.com/groups/(\d+)/?(?:\?|$)',link['url'])
                if match:found[match.group(1)]={'id':match.group(1),'url':f'https://www.facebook.com/groups/{match.group(1)}/'}
            unchanged=unchanged+1 if len(found)==before else 0
            if unchanged>=3:break
            self.page.mouse.wheel(0,1800)
        if not found:raise LayoutChanged('No identifiable group links; check the recovery browser')
        resolved=[]
        for source in found.values():
            try:source['name']=self.resolve_group_name(source['url'])
            except LayoutChanged:continue
            resolved.append(source)
        if not resolved:raise LayoutChanged('Visible Facebook group names unavailable')
        return resolved
    def collect(self,source,cutoff):
        self.page.goto(source['url']+'?sorting_setting=CHRONOLOGICAL',wait_until='domcontentloaded',timeout=60000)
        seen=set();unchanged=0;articles_seen=0;old_streak=0
        name_updated=False
        exhausted=True
        for _ in range(max(1,int(os.getenv('MAX_SCROLLS','1000')))):
            self.page.wait_for_timeout(2200);self.check()
            if self.update_source_name and not name_updated:
                name=self.group_name()
                if name:
                    self.update_source_name(source['external_id'],name)
                    name_updated=True
            articles=self.page.locator('[role="article"]')
            before=len(seen)
            for article in articles.all():
                self.tick();articles_seen+=1
                try:
                    if article.evaluate('el => !!el.parentElement.closest(\'[role="article"]\')'):continue
                    message=article.locator('[data-ad-rendering-role="story_message"], [data-ad-preview="message"]').first
                    more=message.get_by_role('button',name=re.compile(r'(?:See more|ראה עוד|הצג עוד|עוד)\s*$',re.I))
                    if more.count():more.first.click(timeout=1500)
                    raw=article.evaluate('''el => {
                      const message=el.querySelector('[data-ad-rendering-role="story_message"], [data-ad-preview="message"]');
                      return {body:message?.innerText || null, links:[...el.querySelectorAll('a[href]')].map(a=>({url:a.href,label:a.getAttribute('aria-label'),title:a.getAttribute('title')})), dates:[...el.querySelectorAll('time,abbr[data-utime]')].map(t=>t.getAttribute('datetime')||t.getAttribute('data-utime')||t.getAttribute('title')), images:[...el.querySelectorAll('a[href*="/photo"] img')].filter(i=>i.naturalWidth>=200 && i.naturalHeight>=150).map(i=>i.src)};
                    }''')
                except Exception:continue
                identity=next((p for a in raw['links'] if (p:=canonical_post(a['url'],source['external_id']))),None)
                key=identity[0] if identity else 'unknown:'+str(hash(raw.get('body')))
                if key in seen:continue
                if not raw['body']:
                    continue # Loading placeholders are retried on the next pass.
                if not identity:
                    yield {'reason':'Stable post identifier unavailable','body':raw['body']};continue
                candidates=raw['dates']+[v for a in raw['links'] if canonical_post(a['url'],source['external_id']) for v in [a['label'],a['title']]]
                published=publication_date(candidates)
                if not published:
                    # Timestamp tooltip is UI-visible and may contain the absolute date.
                    for a in raw['links']:
                        if canonical_post(a['url'],source['external_id']):
                            try:
                                target=next((link for link in article.locator('a[href]').all() if canonical_post(link.evaluate('(a)=>a.href'),source['external_id'])),None)
                                if target:target.hover(timeout=1500)
                                self.page.wait_for_timeout(900)
                                ts=self.page.locator('[role="tooltip"]').all_text_contents()
                                published=publication_date(ts)
                            except Exception:pass
                            break
                if not published:
                    yield {'reason':'Absolute publication date unavailable','body':raw['body']};continue
                seen.add(key)
                if published<cutoff:
                    old_streak+=1
                    continue
                old_streak=0
                if published>datetime.now(timezone.utc):
                    yield {'reason':'Publication date is in the future','body':raw['body']};continue
                article.scroll_into_view_if_needed(timeout=3000)
                self.page.wait_for_timeout(350)
                raw['images']=article.evaluate(PHOTO_IMAGES)
                yield {'external_id':identity[0],'url':identity[1],'published_at':published,'body':raw['body'],'images':raw['images'][:12]}
            # Multiple consecutive old posts avoid stopping on a single pinned post.
            if old_streak>=10:
                exhausted=False;break
            unchanged=unchanged+1 if len(seen)==before else 0
            if unchanged>=6:
                raise CollectionIncomplete('Feed stalled before the requested date boundary was reached')
            self.page.mouse.wheel(0,1800)
        if not articles_seen:raise LayoutChanged('No rendered posts found; group access or page layout needs review')
        if exhausted:raise CollectionIncomplete('Configured scroll limit reached; collection is partial')
