import os

from playwright.sync_api import sync_playwright

APP = os.environ.get("AUDIT_APP", "http://localhost:5173")
LANDING = os.environ.get("AUDIT_LANDING", "http://localhost:4321")


def inspect(browser, url):
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page_errors = []
    failed_responses = []
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on(
        "response",
        lambda response: failed_responses.append(
            f"{response.status} {response.url} {response.text()[:300]}"
        )
        if response.status >= 400 and "/v1/" in response.url
        else None,
    )
    response = page.goto(url, wait_until="networkidle")
    result = {
        "url": page.url,
        "status": response.status if response else None,
        "title": page.title(),
        "text": page.locator("body").inner_text()[:1000],
        "hash_links": page.locator('a[href="#"]').count(),
        "console_errors": errors,
        "page_errors": page_errors,
        "failed_responses": failed_responses,
    }
    page.close()
    return result


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    results = {
        "landing": inspect(browser, f"{LANDING}/"),
        "app_login": inspect(browser, f"{APP}/login"),
        "booking_profile": inspect(browser, f"{APP}/"),
        "app_unknown": inspect(browser, f"{APP}/not-a-real-route"),
    }

    for name, result in results.items():
        print(f"[{name}] status={result['status']} title={result['title']!r} url={result['url']}")
        print(f"  hash_links={result['hash_links']} console_errors={result['console_errors']} page_errors={result['page_errors']}")
        print(f"  failed_responses={result['failed_responses']}")
        print(f"  text={result['text'].replace(chr(10), ' | ')[:300]}")

    browser.close()
