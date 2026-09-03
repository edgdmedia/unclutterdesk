from playwright.sync_api import sync_playwright


def inspect(page, url):
    errors = []
    page_errors = []
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    response = page.goto(url, wait_until="networkidle")
    return {
        "url": page.url,
        "status": response.status if response else None,
        "title": page.title(),
        "text": page.locator("body").inner_text()[:1000],
        "hash_links": page.locator('a[href="#"]').count(),
        "console_errors": errors,
        "page_errors": page_errors,
    }


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    results = {
        "landing": inspect(page, "http://localhost:4321/"),
        "app_login": inspect(page, "http://localhost:5173/login"),
        "booking_profile": inspect(page, "http://demo.localhost:5173/"),
        "app_unknown": inspect(page, "http://localhost:5173/not-a-real-route"),
    }

    for name, result in results.items():
        print(f"[{name}] status={result['status']} title={result['title']!r} url={result['url']}")
        print(f"  hash_links={result['hash_links']} console_errors={result['console_errors']} page_errors={result['page_errors']}")
        print(f"  text={result['text'].replace(chr(10), ' | ')[:300]}")

    browser.close()
