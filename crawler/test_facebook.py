"""Exercise the rendered DOM adapter in Chromium, without a Facebook account."""
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from playwright.sync_api import sync_playwright
from facebook import Facebook, CollectionIncomplete, PHOTO_IMAGES


class FixturePage:
    def __init__(self, page):
        self.page = page
        self.mouse = SimpleNamespace(wheel=lambda *args: None)
    def goto(self, *args, **kwargs): pass
    def wait_for_timeout(self, *args): pass
    def __getattr__(self, name): return getattr(self.page, name)


class CollectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True)
    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
    def setUp(self):
        self.page = self.browser.new_page()
        self.fb = Facebook(SimpleNamespace(pages=[FixturePage(self.page)]), lambda: None)
        self.source = {'url': 'https://www.facebook.com/groups/123/', 'external_id': '123'}
        self.cutoff = datetime(2026, 10, 4, tzinfo=timezone.utc)
    def tearDown(self): self.page.close()
    def test_group_name_uses_visible_heading_not_navigation(self):
        self.page.set_content('''<div role="banner"><h1>Facebook</h1></div>
          <a href="/groups/123">הצגת הקבוצה</a><h1 hidden>Wrong group</h1>
          <div role="main"><h1>דירות להשכרה ולמכירה בחיפה 🏠</h1></div>
          <div role="article"><h1>Post heading</h1></div>''')
        self.assertEqual(self.fb.group_name(),'דירות להשכרה ולמכירה בחיפה 🏠')
    def test_missing_group_heading_does_not_use_action_label(self):
        self.page.set_content('<h1>Facebook</h1><a>הצגת הקבוצה</a>')
        self.assertIsNone(self.fb.group_name())
    def article(self, pid, date):
        return f'''<div role="article"><a href="https://www.facebook.com/groups/123/posts/{pid}/">date</a>
          <time datetime="{date}"></time><div data-ad-preview="message">Property {pid}</div></div>'''
    def test_collects_beyond_eighty_and_filters_old_posts(self):
        html = ''.join(self.article(i, '2026-10-20T12:00:00Z') for i in range(1, 101))
        html += ''.join(self.article(i, '2026-09-01T12:00:00Z') for i in range(101, 111))
        self.page.set_content('<div role="feed">' + html + '</div>')
        posts = list(self.fb.collect(self.source, self.cutoff))
        self.assertEqual(len(posts), 100)
        self.assertEqual(len({post['external_id'] for post in posts}), 100)
    def test_stalled_feed_is_partial_and_repeated_posts_are_not_emitted(self):
        self.page.set_content(self.article(1, '2026-10-20T12:00:00Z'))
        posts = self.fb.collect(self.source, self.cutoff)
        self.assertEqual(next(posts)['external_id'], '1')
        with self.assertRaises(CollectionIncomplete): next(posts)
    def test_expands_hebrew_more_button(self):
        html=self.article(1, '2026-10-20T12:00:00Z').replace('Property 1', '''Short <button onclick="this.parentElement.textContent='Full property description'">… עוד</button>''')
        self.page.set_content(html)
        posts=self.fb.collect(self.source,self.cutoff)
        self.assertEqual(next(posts)['body'],'Full property description')
        posts.close()
    def test_original_photos_exclude_comments_and_avatars(self):
        self.page.set_content('''<div role="article" id="post">
          <img src="https://example.com/avatar.jpg" width="250" height="200">
          <a href="/photo/?fbid=1"><img src="https://example.com/property.jpg" width="400" height="300"></a>
          <a href="/photo/?fbid=1"><img src="https://example.com/property.jpg" width="400" height="300"></a>
          <div role="article"><a href="/photo/?fbid=2"><img src="https://example.com/comment.jpg" width="400" height="300"></a></div>
        </div>''',wait_until='domcontentloaded')
        self.assertEqual(self.page.locator('#post').evaluate(PHOTO_IMAGES),['https://example.com/property.jpg'])


if __name__ == '__main__': unittest.main()
