"""Open Facebook for manual sign-in using a dedicated local browser profile."""

import argparse
import json
import os
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import Error, sync_playwright


def profile_root() -> Path:
    if sys.platform == "win32":
        return Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local") / "Miftan" / "Facebook"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "Miftan" / "Facebook"
    data_home = Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share")
    if not data_home.is_absolute():
        data_home = Path.home() / ".local" / "share"
    return data_home / "miftan" / "facebook"


def discover(page, kind: str) -> list[dict]:
    """Read links rendered in the main list that the user opened."""
    location = urlsplit(page.url)
    if location.scheme != "https" or location.hostname not in {"facebook.com", "www.facebook.com", "m.facebook.com"}:
        raise ValueError("Open Facebook in the companion window first.")
    path = location.path.rstrip("/")
    is_list = path == "/groups/joins" if kind == "group" else (
        path == "/pages/liked" or (path == "/pages" and parse_qs(location.query).get("category") == ["liked"])
    )
    if not is_list:
        raise ValueError("Open the groups or followed pages list before scanning.")

    found = {}
    title_scores = {}
    for _ in range(40):
        links = page.locator('[role="main"] a[href], main a[href]').evaluate_all(
            r"""links => {
                const actionLabel = /^(view(?: group| page)?|see group|visit(?: group| page)?|go to (?:group|page)|learn more|follow|join(?: group)?|more|הצג(?:ת| את)? (?:ה)?(?:קבוצה|דף|עמוד)|מעבר ל(?:קבוצה|דף|עמוד)|מידע נוסף|הצטרפות|מעקב|עוד)[.!…]?$/iu;
                const firstLine = text => (text || '').split(/\r?\n/)
                    .map(line => line.trim()).find(line => line && !actionLabel.test(line));
                return links.flatMap(link => {
                    if (!link.getClientRects().length || link.getAttribute('role') === 'button') return [];
                    const heading = link.closest('h1,h2,h3,h4,[role="heading"]')
                        || link.querySelector('h1,h2,h3,h4,[role="heading"]');
                    const headingName = heading && firstLine(link.innerText || heading.innerText);
                    const visibleName = firstLine(link.innerText);
                    const name = headingName || visibleName;
                    if (!name) return [];
                    return [{ name, url: link.href, score: headingName ? 2 : 1 }];
                });
            }"""
        )
        for link in links:
            url = urlsplit(link["url"])
            if url.hostname not in {"facebook.com", "www.facebook.com", "m.facebook.com"}:
                continue
            parts = url.path.strip("/").split("/")
            if kind == "group" and (len(parts) != 2 or parts[0] != "groups" or
                                    parts[1] in {"joins", "feed", "discover", "create"}):
                continue
            if kind == "page" and (len(parts) != 1 and
                                   not (len(parts) == 3 and parts[0] == "people")):
                continue
            key = url.path.rstrip("/")
            if key == "/profile.php":
                ids = parse_qs(url.query).get("id", [])
                if len(ids) != 1 or not ids[0].isascii() or not ids[0].isdigit():
                    continue
                key += "?id=" + ids[0]
            if link["score"] > title_scores.get(key, 0):
                title_scores[key] = link["score"]
                found[key] = {"url": "https://www.facebook.com" + key, "name": link["name"][:200], "kind": kind}
        previous = page.evaluate("window.scrollY")
        page.evaluate("window.scrollBy(0, Math.max(400, window.innerHeight - 100))")
        page.wait_for_timeout(700)
        if page.evaluate("window.scrollY") == previous:
            break
    return list(found.values())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", default="default", help="Local profile name")
    parser.add_argument("--discover", action="store_true", help="Export source suggestions")
    args = parser.parse_args()
    if not args.profile.isascii() or not args.profile.isalnum():
        parser.error("Use only ASCII letters and digits for the profile name.")
    profile = profile_root() / args.profile.lower()

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch_persistent_context(profile, headless=False)
            try:
                page = browser.pages[0] if browser.pages else browser.new_page()
                page.goto("https://www.facebook.com/", wait_until="domcontentloaded")
                if args.discover:
                    suggestions = []
                    for kind, url in (
                        ("group", "https://www.facebook.com/groups/joins/"),
                        ("page", "https://www.facebook.com/pages/?category=liked"),
                    ):
                        page.goto(url, wait_until="domcontentloaded")
                        input(f"Sign in if needed, then open your {kind} list. Press Enter to scan it.")
                        suggestions.extend(discover(page, kind))
                    output = profile.parent / f"{args.profile.lower()}-sources.json"
                    output.write_text(json.dumps(suggestions, ensure_ascii=False, indent=2), encoding="utf-8")
                    print(f"Saved {len(suggestions)} suggestions to {output}")
                else:
                    input("Sign in in the browser window. Press Enter here when finished.")
            finally:
                browser.close()
    except (Error, OSError, ValueError) as error:
        parser.exit(1, f"Could not use the local browser profile: {error}\n")


if __name__ == "__main__":
    main()
