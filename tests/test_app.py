"""End-to-end checks for the Todo app in headless Chromium (Playwright). Run: python3 tests/test_app.py

Serves a temporary copy of the repo. Firebase is replaced by tests/fake-firebase/ (same function
signatures, data in localStorage), except in test_real_sdk, which loads the actual Firebase build
from npm and stops at the network. Screenshots for visual review go to /tmp/todo-shots.
Needs Python Playwright with Chromium; npm for the real-SDK check. Not used by the app itself.
"""
import asyncio, json, os, re, shutil, subprocess, sys, tempfile, time
os.environ.setdefault('PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS', '1')  # lets tests route service-worker fetches
from playwright.async_api import async_playwright, expect

HERE = os.path.dirname(os.path.abspath(__file__))
REPO, FAKE, SHOTS = os.path.dirname(HERE), os.path.join(HERE, 'fake-firebase'), '/tmp/todo-shots'
SDK_VERSION = re.search(r'firebasejs/([\d.]+)', open(os.path.join(REPO, 'index.html')).read()).group(1)
CONFIG = "export const FIREBASE_CONFIG = { apiKey: 'test-key', authDomain: 'demo.firebaseapp.com', projectId: 'demo', appId: '1:1:web:1' };"
NOW, HOUR = int(time.time() * 1000), 3600_000
SETTINGS = 'users/UID123/settings/app'
PALETTE = ['#3559a8', '#a0458a', '#23876a', '#c27414', '#6a55c8', '#b5473a', '#2a7d9a', '#6f7f24']

def task(title, lists, prio=2, age_h=1, done_h=None):
    return {'title': title, 'lists': lists, 'prio': prio, 'done': done_h is not None,
            'created': NOW - age_h * HOUR, 'doneAt': None if done_h is None else NOW - done_h * HOUR}

SEED = [task('Send Q3 report to Ana', ['work'], 1, 30), task('Book physio appointment', [], 1, 5),
        task('Deadlift 3x5 at 100 kg', ['gym'], 1, 2), task("Review Marco's pull request", ['work'], 2, 20),
        task('Climbing chalk', ['buy', 'hobbies'], 2, 3), task('Oat milk', ['buy'], 2, 4),
        task('Replace gym gloves', ['gym', 'buy'], 2, 50), task('Restring the guitar', ['hobbies'], 2, 70),
        task('Update expense sheet', ['work'], 3, 90), task('Finish chapter 4 of Dune', ['hobbies'], 3, 100),
        task('Stretch hamstrings', ['gym'], 3, 10), task('Batteries (AA)', ['buy'], 2, 30, done_h=2),
        task('Dish soap', ['buy'], 2, 40, done_h=26)]

results = []
def check(name, ok, detail=''):
    results.append(bool(ok))
    print(('PASS ' if ok else 'FAIL ') + name + ('' if ok else f'   -> {detail}'))

async def context(browser, url, sdk_dir=FAKE, config=True, sdk_on=None, **options):
    """A browser context where gstatic's Firebase files come from sdk_dir and firebase-config.js is filled in."""
    ctx = await browser.new_context(service_workers=options.pop('sw', 'block'), accept_downloads=True, **options)
    async def serve_sdk(route):
        if sdk_on is not None and not sdk_on['on']: return await route.abort()
        await route.fulfill(path=os.path.join(sdk_dir, route.request.url.rsplit('/', 1)[1]),
                            content_type='text/javascript', headers={'Access-Control-Allow-Origin': '*'})
    await ctx.route(f'https://www.gstatic.com/firebasejs/{SDK_VERSION}/*', serve_sdk)
    if config: await ctx.route('**/firebase-config.js', lambda r: r.fulfill(body=CONFIG, content_type='text/javascript'))
    page = await ctx.new_page()
    page.errors = []
    page.on('console', lambda m: m.type == 'error' and page.errors.append(m.text))
    page.on('pageerror', lambda e: page.errors.append(str(e)))
    page.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await page.goto(url)
    return ctx, page

async def start_signed_in(page, tasks):
    await expect(page.locator('#login')).to_be_visible()   # first page settled (signed out) before we seed storage
    await page.evaluate("""tasks => { localStorage.fakeUser = JSON.stringify({ uid: 'UID123', email: 'me@example.com' });
      localStorage.fakeDB = JSON.stringify(Object.fromEntries(tasks.map((t, i) => ['users/UID123/tasks/T' + i, t]))); }""", tasks)
    await page.reload()
    await expect(page.locator('.tab-add')).to_be_visible()   # lists loaded (seeded on first sign-in)
    await page.wait_for_timeout(100)

async def add(page, title, lists=(), prio=None):
    await page.fill('#add-title', title)
    for l in lists: await page.click(f'#add-opts [data-list="{l}"]')
    if prio: await page.click(f'#add-opts [data-prio="{prio}"]')
    await page.press('#add-title', 'Enter')
    await page.wait_for_timeout(50)

def titles(page, where='#list'): return page.locator(f'{where} .title').all_inner_texts()
def tab_names(page): return page.evaluate("[...document.querySelectorAll('.tab')].map(t => t.querySelector('.tab-name').innerText)")
async def stored(page): return dict(await page.evaluate("Object.entries(JSON.parse(localStorage.fakeDB || '{}'))"))
async def stored_tasks(page): return {k.rsplit('/', 1)[1]: v for k, v in (await stored(page)).items() if '/tasks/' in k}
async def stored_lists(page): return (await stored(page)).get(SETTINGS, {}).get('lists')

async def edit_lists(page, change):
    """Open the lists editor with +, run change(page), then Save."""
    await page.click('.tab-add')
    await expect(page.locator('#lists-editor')).to_be_visible()
    await change(page)
    await page.click('#lists-form .btn-primary'); await page.wait_for_timeout(100)

async def test_setup_message(browser, url):
    ctx, page = await context(browser, url, config=False)   # the repo's placeholder config
    await page.wait_for_timeout(300)
    check('placeholder config -> setup message', 'firebase-config.js (README, step 2)' in await page.inner_text('#boot'))
    await ctx.close()

async def test_flows(browser, url):
    ctx, page = await context(browser, url, viewport={'width': 1280, 'height': 860})
    await expect(page.locator('#login')).to_be_visible()
    await page.fill('[name=email]', 'me@example.com'); await page.fill('[name=password]', 'nope')
    await page.click('#login button'); await page.wait_for_timeout(150)
    check('wrong password -> message', await page.inner_text('#login-error') == 'Wrong email or password.')
    await page.fill('[name=password]', 'correct horse'); await page.click('#login button')
    await expect(page.locator('.tab-add')).to_be_visible()
    lists = await stored_lists(page)
    check('first sign-in creates the default lists (D10)', [l['id'] for l in lists or []] == ['work', 'hobbies', 'gym', 'buy'], lists)
    check('tabs come from the stored lists', await tab_names(page) == ['All', 'Work', 'Hobbies', 'Gym', 'To buy'], await tab_names(page))
    check('empty state', 'Nothing to do.' in await page.inner_text('#list'))
    check('Firestore gets the persistent multi-tab cache',
          await page.evaluate('__fake.firestoreOpts.localCache.tabManager.kind') == 'persistentMultipleTabManager')

    await add(page, 'Book physio appointment', prio=1)
    await page.click('[data-view="buy"]');    await add(page, 'Climbing chalk', lists=['hobbies']); await add(page, 'Oat milk')
    await page.click('[data-view="gym"]');    await add(page, 'Deadlift', prio=1); await add(page, 'Stretch', prio=3)
    await add(page, 'Replace gloves', lists=['buy'])
    await page.click('[data-view="work"]');   await add(page, 'Report', prio=1); await add(page, 'Review'); await add(page, 'Expenses', prio=3)
    await page.click('[data-view="all"]');    await add(page, '<img src=x onerror="window.__xss=1">')

    tasks = await stored_tasks(page)
    chalk = next(t for t in tasks.values() if t['title'] == 'Climbing chalk')
    check('overlap is one task with two lists (D8)', sorted(chalk['lists']) == ['buy', 'hobbies'], chalk)
    check('task fields match D7', set(chalk) == {'title', 'lists', 'prio', 'done', 'created', 'doneAt'}, list(chalk))
    check('user text is escaped (D26)', await page.evaluate('window.__xss') is None
          and '<img src=x onerror="window.__xss=1">' in await titles(page))
    tabs = await page.evaluate("[...document.querySelectorAll('.tab')].map(t => t.innerText.replace(/\\s+/g, ''))")
    check('tab counts', tabs == ['All10', 'Work3', 'Hobbies1', 'Gym3', 'Tobuy3'], tabs)
    await page.click('[data-view="buy"]')
    check('row shows the other lists (D22)', any('Climbing chalk' in r and 'Hobbies' in r
          for r in await page.locator('#list .task').all_inner_texts()))
    await page.click('[data-view="gym"]')
    check('sort by priority (D12)', await titles(page) == ['Deadlift', 'Replace gloves', 'Stretch'], await titles(page))
    await page.click('[data-view="work"]')
    check('newest first within a priority (D12)', await titles(page) == ['Report', 'Review', 'Expenses'], await titles(page))

    await page.click('[data-view="hobbies"]')
    await page.click('#list .task:has-text("Climbing chalk") .check')
    check('tick shows at once (D24)',
          await page.get_attribute('#list .task:has-text("Climbing chalk") .check', 'aria-checked') == 'true')
    await page.wait_for_timeout(500)
    await page.click('[data-view="buy"]')
    check('completing in one list completes it everywhere (D8)', 'Climbing chalk' not in await titles(page)
          and await page.inner_text('#done-summary') == 'Done (1)')

    await page.click('#list .task:has-text("Oat milk") .body')
    await page.click('#edit-opts [data-list="gym"]'); await page.click('#edit-opts [data-prio="1"]')
    await page.click('#edit-form .btn-primary'); await page.wait_for_timeout(100)
    await page.click('[data-view="gym"]')
    check('edit: new list and priority', 'Oat milk' in (await titles(page))[:2]
          and 'p1' in await page.get_attribute('#list .task:has-text("Oat milk")', 'class'), await titles(page))
    await page.click('#list .task:has-text("Stretch") .body')
    await page.click('#edit-form [data-act="deleteTask"]'); await page.wait_for_timeout(100)
    check('delete a task', 'Stretch' not in await titles(page))

    # ── Lists are data, edited in the app (D9) ──
    await page.click('.tab-add')
    focused = await page.evaluate("document.activeElement === document.querySelector('#lists-rows li:last-child input')")
    check('+ opens the lists editor with an empty row ready to type', focused)
    await page.keyboard.type('Reading'); await page.keyboard.press('Enter'); await page.wait_for_timeout(100)
    lists = await stored_lists(page)
    reading = next((l for l in lists if l['name'] == 'Reading'), None)
    check('add a list with a button, no code', await page.is_hidden('#lists-editor') and reading is not None
          and 'Reading' in await tab_names(page), lists)
    check('new list gets an unused color', reading and reading['color'] == PALETTE[4], reading)
    await page.click(f'[data-view="{reading["id"]}"]'); await add(page, 'Finish Dune')
    dune = next(t for t in (await stored_tasks(page)).values() if t['title'] == 'Finish Dune')
    check('new list works like the others', dune['lists'] == [reading['id']] and await titles(page) == ['Finish Dune'])

    await edit_lists(page, lambda p: p.fill('#lists-rows li:nth-child(1) input', 'Job'))
    tabs = await page.evaluate("[...document.querySelectorAll('.tab')].map(t => t.innerText.replace(/\\s+/g, ''))")
    check('rename a list: tasks stay in it', 'Job3' in tabs and 'Work3' not in tabs, tabs)
    await edit_lists(page, lambda p: p.fill('#lists-rows li:nth-child(3) input', '   '))
    check('blank name keeps the old one; blank new row is not created (D9)',
          await tab_names(page) == ['All', 'Job', 'Hobbies', 'Gym', 'To buy', 'Reading'], await tab_names(page))
    await edit_lists(page, lambda p: p.click('#lists-rows li:nth-child(4) [data-by="-1"]'))
    check('reorder lists', await tab_names(page) == ['All', 'Job', 'Hobbies', 'To buy', 'Gym', 'Reading'], await tab_names(page))
    await edit_lists(page, lambda p: p.click('#lists-rows li:nth-child(2) .swatch'))
    hobbies = next(l for l in await stored_lists(page) if l['id'] == 'hobbies')
    check('recolor a list', hobbies['color'] == PALETTE[2], hobbies)

    await page.click('[data-view="hobbies"]')
    count_before = len(await stored_tasks(page))
    await edit_lists(page, lambda p: p.click('#lists-rows li:nth-child(2) [data-act="dropList"]'))
    tasks = await stored_tasks(page)
    chalk = next(t for t in tasks.values() if t['title'] == 'Climbing chalk')
    check('delete a list: tab gone, open view falls back to All (D25)', 'Hobbies' not in await tab_names(page)
          and await page.get_attribute('[data-view="all"]', 'aria-current') == 'page')
    check('delete a list: its tasks are kept (D11)', 'hobbies' in chalk['lists'] and len(tasks) == count_before,
          (len(tasks), count_before))

    # ── Backup and restore (D20) ──
    async with page.expect_download() as info:
        await page.click('[data-act="backup"]')
    backup = json.load(open(await (await info.value).path()))
    n_tasks, n_lists = len(await stored_tasks(page)), len(await stored_lists(page))
    check('download backup: every list and task, with ids', backup['app'] == 'todo' and len(backup['lists']) == n_lists
          and len(backup['tasks']) == n_tasks and all('id' in t for t in backup['tasks']),
          ({k: len(v) for k, v in backup.items() if isinstance(v, list)}, n_tasks, n_lists))
    backup['lists'].append({'id': 'hobbies', 'name': 'Hobbies', 'color': '#a0458a'})
    backup['tasks'].append({'id': 'NEW1', 'title': 'Restored task', 'lists': ['hobbies'], 'prio': 2, 'done': False, 'created': NOW, 'doneAt': None})
    await page.set_input_files('#restore-file', files=[{'name': 'b.json', 'mimeType': 'application/json', 'buffer': json.dumps(backup).encode()}])
    await page.wait_for_timeout(200)
    after = (len(await stored_tasks(page)), len(await stored_lists(page)))
    check('restore backup: missing list and task come back, nothing duplicated', 'Hobbies' in await tab_names(page)
          and 'Restored task' in await titles(page) and after == (n_tasks + 1, n_lists + 1), (after, n_tasks, n_lists))
    await page.set_input_files('#restore-file', files=[{'name': 'x.json', 'mimeType': 'application/json', 'buffer': b'{"hello": 1}'}])
    await page.wait_for_timeout(100)
    check('restore: a wrong file is refused with a message', await page.inner_text('#toast') == "That file isn't a Todo backup.")

    # ── Sync status, cleanup, per-device view ──
    await page.evaluate('__fake.setOffline(true, true)'); await page.wait_for_timeout(1000)
    early = await page.is_hidden('#status'); await page.wait_for_timeout(2300)
    check('offline notice only after 3 s (D18)', early and
          await page.inner_text('#status') == 'Offline. Your changes will sync when you reconnect.')
    await page.evaluate('__fake.setOffline(false)'); await page.wait_for_timeout(100)
    check('back online hides the notice', await page.is_hidden('#status'))

    await page.evaluate(f"""() => {{ const d = JSON.parse(localStorage.fakeDB);
      d['users/UID123/tasks/OLD'] = {{ title: 'Old', lists: [], prio: 2, done: true, created: 1, doneAt: {NOW} - 40 * 864e5 }};
      d['users/UID123/tasks/RECENT'] = {{ title: 'Recent', lists: [], prio: 2, done: true, created: 2, doneAt: {NOW} - 5 * 864e5 }};
      d['users/UID123/tasks/PARTIAL'] = {{ title: 'Made in the console' }};
      localStorage.fakeDB = JSON.stringify(d); }}""")
    await page.click('[data-view="gym"]'); await page.reload(); await page.wait_for_timeout(250)
    tasks = await stored_tasks(page)
    check('done tasks older than 30 days are pruned (D13)', 'OLD' not in tasks and 'RECENT' in tasks)
    check('open list is remembered per device (D25)', await page.get_attribute('[data-view="gym"]', 'aria-current') == 'page')
    await page.click('[data-view="all"]')
    check('partial documents render with defaults (D7)', 'Made in the console' in await titles(page))
    await page.screenshot(path=f'{SHOTS}/desktop.png')

    await page.click('[data-act="signout"]'); await page.wait_for_timeout(100)
    check('sign out -> sign-in screen', await page.is_visible('#login') and await page.is_hidden('#main'))
    check('no console errors', not page.errors, page.errors)
    await page.evaluate("localStorage.fakeUser = JSON.stringify({ uid: 'UID123', email: 'me@example.com' }); localStorage.denyReads = '1'")
    await page.reload(); await page.wait_for_timeout(300)
    check('rules not published -> explained', 'firestore.rules' in await page.inner_text('#toast'))
    await ctx.close()

async def test_offline_first_run(browser, url):
    """A device's first run while offline must not write default lists over real ones (D10)."""
    ctx, page = await context(browser, url)
    await expect(page.locator('#login')).to_be_visible()   # let this first page settle, signed out, before changing its storage
    await page.evaluate("localStorage.fakeUser = JSON.stringify({ uid: 'UID123', email: 'me@example.com' }); localStorage.fakeOffline = '1'")
    await page.reload()
    await expect(page.locator('#main')).to_be_visible()
    await page.wait_for_timeout(300)   # time in which a wrong default write would happen
    state = (await stored_lists(page), await page.is_hidden('.tab-add'))
    check('offline first run: no default lists written, no + yet', state == (None, True), state)
    await page.evaluate('__fake.setOffline(false)'); await page.wait_for_timeout(150)
    check('offline first run: defaults written once the server answers', len(await stored_lists(page) or []) == 4
          and await page.is_visible('.tab-add'))
    await ctx.close()

async def test_phone(browser, url):
    for width in (390, 360):
        for scheme in ('light', 'dark'):
            ctx, page = await context(browser, url, viewport={'width': width, 'height': 844}, device_scale_factor=2,
                                      is_mobile=True, has_touch=True, color_scheme=scheme)
            await start_signed_in(page, SEED)
            name = f'phone {width}px {scheme}'
            shot = f'{SHOTS}/{name.replace(" ", "-")}'
            await page.screenshot(path=f'{shot}-all.png')
            fits = await page.evaluate("document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.tab, .tab-add')].every(t => t.getBoundingClientRect().right <= innerWidth)")
            check(f'{name}: every tab and + visible, no sideways scrolling', fits)
            await page.click('[data-view="buy"]')
            await page.fill('#add-title', 'Chalk bag'); await page.dispatch_event('#add-title', 'input')
            await page.tap('#add-opts [data-list="hobbies"]')
            await page.screenshot(path=f'{shot}-composer.png')
            await page.tap('.btn-add'); await page.wait_for_timeout(100)
            chalk_bag = next(t for t in (await stored_tasks(page)).values() if t['title'] == 'Chalk bag')
            check(f'{name}: Add button adds with the picked lists', sorted(chalk_bag['lists']) == ['buy', 'hobbies'])
            await page.tap('#list .task:has-text("Oat milk") .body'); await page.wait_for_timeout(150)
            await page.screenshot(path=f'{shot}-editor.png')
            focused = await page.evaluate('document.activeElement.className')
            check(f'{name}: task editor focuses a list button, not the text field', focused == 'chip', focused)
            await page.click('#editor [data-act="close"]')
            await page.tap('.tab-add'); await page.keyboard.type('Garden'); await page.wait_for_timeout(100)
            await page.screenshot(path=f'{shot}-lists.png')
            await page.tap('#lists-form .btn-primary'); await page.wait_for_timeout(100)
            fits = await page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            check(f'{name}: a sixth list wraps instead of overflowing', 'Garden' in await tab_names(page) and fits)
            check(f'{name}: no console errors', not page.errors, page.errors)
            await ctx.close()

async def test_real_sdk(browser, url):
    d = f'/tmp/firebase-{SDK_VERSION}'
    if not os.path.exists(f'{d}/node_modules/firebase/firebase-app.js'):   # the CDN build ships in the npm package
        subprocess.run(['npm', 'install', '--silent', '--prefix', d, f'firebase@{SDK_VERSION}'], check=True)
    ctx, page = await context(browser, url, sdk_dir=f'{d}/node_modules/firebase')
    await ctx.route(lambda u: 'googleapis.com' in u, lambda r: r.abort())   # no real network in tests
    await page.reload()
    try: await expect(page.locator('#login')).to_be_visible(timeout=8000); ok = True
    except AssertionError: ok = False
    check(f'real SDK {SDK_VERSION}: loads, sets up the offline cache, shows sign-in', ok, await page.inner_text('body'))
    await page.fill('[name=email]', 'me@example.com'); await page.fill('[name=password]', 'x')
    await page.click('#login button')
    try: await expect(page.locator('#login-error')).not_to_be_empty(timeout=15000)
    except AssertionError: pass
    message = await page.inner_text('#login-error')
    check('real SDK: sign-in without network -> clear message', message == 'No connection. Signing in needs the internet.', message)
    check('real SDK: no unexpected console errors', not [e for e in page.errors if 'googleapis' not in e and 'ERR_FAILED' not in e], page.errors)
    await ctx.close()

async def test_service_worker(browser, url, root):
    sdk = {'on': True}
    ctx, page = await context(browser, url, sw='allow', sdk_on=sdk)
    await page.evaluate('navigator.serviceWorker.ready.then(() => true)')
    await page.reload(); await page.wait_for_timeout(500)                     # second online open
    await ctx.set_offline(True); await page.reload(); await page.wait_for_timeout(800)
    check('service worker: starts offline after two online opens (D17)', await page.is_visible('#login'))
    await page.evaluate("caches.open('todo-v1').then(c => c.keys().then(ks => Promise.all(ks.filter(r => r.url.includes('gstatic')).map(r => c.delete(r)))))")
    sdk['on'] = False; await page.reload(); await page.wait_for_timeout(800)
    check('service worker: SDK not saved yet + offline -> explains', 'Open the app once while online' in await page.inner_text('#boot'))
    sdk['on'] = True; await ctx.set_offline(False)
    html = os.path.join(root, 'index.html')
    source = open(html).read()   # read first: open(..., 'w') empties the file
    open(html, 'w').write(source.replace('<title>Todo</title>', '<title>Todo v2</title>'))
    await page.reload(); await page.wait_for_timeout(500)
    check('service worker: a new deploy shows on the next online open', await page.title() == 'Todo v2')
    await ctx.close()

async def main():
    os.makedirs(SHOTS, exist_ok=True)
    root = tempfile.mkdtemp()
    shutil.copytree(REPO, root, dirs_exist_ok=True, ignore=shutil.ignore_patterns('tests', '.git'))
    port = 8700 + os.getpid() % 200
    server = subprocess.Popen([sys.executable, '-m', 'http.server', str(port)], cwd=root,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    url = f'http://localhost:{port}/'
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            await test_setup_message(browser, url)
            await test_flows(browser, url)
            await test_offline_first_run(browser, url)
            await test_phone(browser, url)
            await test_real_sdk(browser, url)
            await test_service_worker(browser, url, root)
            await browser.close()
    finally:
        server.terminate(); shutil.rmtree(root, ignore_errors=True)
    print(f'\n{sum(results)}/{len(results)} passed. Screenshots: {SHOTS}')
    sys.exit(0 if all(results) else 1)

asyncio.run(main())
