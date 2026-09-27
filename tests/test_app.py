"""End-to-end checks for the Todo app in headless Chromium (Playwright). Run: python3 tests/test_app.py

Serves a temporary copy of the repo. Firebase is replaced by tests/fake-firebase/ (same function
signatures, data in localStorage), except in test_real_sdk, which loads the actual Firebase build
from npm and stops at the network. Screenshots for visual review go to <temp dir>/todo-shots.
Needs Python Playwright with Chromium; npm for the real-SDK check. Not used by the app itself.
"""
import asyncio, json, os, re, shutil, subprocess, sys, tempfile, time
os.environ.setdefault('PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS', '1')  # lets tests route service-worker fetches
from playwright.async_api import async_playwright, expect

HERE, TMP = os.path.dirname(os.path.abspath(__file__)), tempfile.gettempdir()
REPO, FAKE, SHOTS = os.path.dirname(HERE), os.path.join(HERE, 'fake-firebase'), os.path.join(TMP, 'todo-shots')
SDK_VERSION = re.search(r'firebasejs/([\d.]+)', open(os.path.join(REPO, 'index.html'), encoding='utf-8').read()).group(1)
CONFIG = "export const FIREBASE_CONFIG = { apiKey: 'test-key', authDomain: 'demo.firebaseapp.com', projectId: 'demo', appId: '1:1:web:1' };"
PLACEHOLDER = "export const FIREBASE_CONFIG = { apiKey: 'PASTE-YOUR-API-KEY', projectId: 'your-project-id' };"   # before README step 2
NOW, HOUR = int(time.time() * 1000), 3600_000
SETTINGS = 'users/UID123/settings/app'
PALETTE = ['#3559a8', '#a0458a', '#23876a', '#c27414', '#6a55c8', '#b5473a', '#2a7d9a', '#6f7f24',
           '#d0604a', '#c2417a', '#8e44ad', '#3b7dd8', '#4f9a2e', '#b08a14', '#8a5a3c', '#5b6b7f']
PRIO_COLORS = ['#b5473a', '#3b7dd8', '#b08a14']   # High, Normal, Low (D39)

def task(title, lists, prio=2, age_h=1, done_h=None):
    return {'title': title, 'lists': lists, 'prio': prio, 'done': done_h is not None,
            'created': NOW - age_h * HOUR, 'doneAt': None if done_h is None else NOW - done_h * HOUR}

SEED = [task('Send Q3 report to Ana', ['work'], 1, 30), task('Book physio appointment', [], 1, 5),
        task('Deadlift 3x5 at 100 kg', ['gym'], 1, 2), task("Review Marco's pull request", ['work'], 2, 20),
        task('Climbing chalk', ['buy', 'hobbies'], 2, 3), task('Oat milk', ['buy'], 2, 4),
        task('Replace gym gloves', ['gym', 'buy'], 2, 50), task('Restring the guitar', ['hobbies'], 2, 70),
        task('Update expense sheet', ['work'], 3, 90), task('Finish chapter 4 of Dune', ['hobbies'], 3, 100),
        task('Stretch hamstrings', ['gym'], 3, 10), task('Batteries (AA)', ['buy'], 2, 30, done_h=2),
        task('Dish soap', ['buy'], 2, 40, done_h=26), dict(task('Protein powder', ['gym', 'buy'], 2, 8), price=2990)]
def day(offset): return time.strftime('%Y-%m-%d', time.localtime(time.time() + offset * 86400))   # a date near today
TRIP = f'T{len(SEED)}'   # start_signed_in stores SEED[i] as T<i>; these are fields added later (D37)
SEED += [dict(task('Plan Lisbon trip', ['hobbies'], 1, 6), project=True, notes='Long weekend in May.\nBudget about 600 €.',
              start=day(-3), end=day(20), url='https://www.visitlisboa.com/en'),
         dict(task('Book flights', ['buy'], 1, 5), parent=TRIP, price=18900, start=day(-2), end=day(1)),
         dict(task('Find a hotel near Alfama', [], 2, 4), parent=TRIP, start=day(2), end=day(9)),
         dict(task('Travel adapter', [], 3, 3, done_h=1), parent=TRIP, price=1250, end=day(-1))]
def find(tasks, title): return next((t for t in tasks.values() if t['title'] == title), None)

results = []
def check(name, ok, detail=''):
    results.append(bool(ok))
    print(('PASS ' if ok else 'FAIL ') + name + ('' if ok else f'   -> {detail}'))

async def context(browser, url, sdk_dir=FAKE, config=CONFIG, sdk_on=None, **options):
    """A browser context where gstatic's Firebase files come from sdk_dir and firebase-config.js is config (never the owner's)."""
    ctx = await browser.new_context(service_workers=options.pop('sw', 'block'), accept_downloads=True, **options)
    async def serve_sdk(route):
        if sdk_on is not None and not sdk_on['on']: return await route.abort()
        await route.fulfill(path=os.path.join(sdk_dir, route.request.url.rsplit('/', 1)[1]),
                            content_type='text/javascript', headers={'Access-Control-Allow-Origin': '*'})
    await ctx.route(f'https://www.gstatic.com/firebasejs/{SDK_VERSION}/*', serve_sdk)
    await ctx.route('**/firebase-config.js', lambda r: r.fulfill(body=config, content_type='text/javascript'))
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
    ctx, page = await context(browser, url, config=PLACEHOLDER)
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
    check('task fields match D37', set(chalk) == {'title', 'lists', 'prio', 'done', 'created', 'doneAt', 'project', 'notes', 'parent',
          'price', 'start', 'end', 'url'} and [chalk[k] for k in ('project', 'notes', 'parent', 'price', 'start', 'end', 'url')]
          == [False, '', None, None, None, None, None], chalk)
    check('user text is escaped (D26)', await page.evaluate('window.__xss') is None
          and '<img src=x onerror="window.__xss=1">' in await titles(page))
    tabs = await page.evaluate("[...document.querySelectorAll('.tab')].map(t => t.innerText.replace(/\\s+/g, ''))")
    check('tab counts', tabs == ['All10', 'Work3', 'Hobbies1', 'Gym3', 'Tobuy3'], tabs)
    await page.click('[data-view="buy"]')
    check('row shows the other lists (D22)', any('Climbing chalk' in r and 'Hobbies' in r
          for r in await page.locator('#list .task').all_inner_texts()))
    await page.click('[data-view="gym"]')
    check('sort by priority (D12)', await titles(page) == ['Deadlift', 'Replace gloves', 'Stretch'], await titles(page))
    groups = await page.eval_on_selector_all('#list .group', 'els => els.map(e => e.textContent)')
    check('priority groups, each under a labelled line (D34)', groups == ['High', 'Normal', 'Low'], groups)
    background = await page.eval_on_selector('#list .p1 .title', 'e => getComputedStyle(e).backgroundImage')
    check('no highlighter on High (D21 superseded)', background == 'none', background)
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
    async def recolor(p):
        await p.click('#lists-rows li:nth-child(2) .swatch')
        swatches = await p.locator('#lists-rows li:nth-child(2) .colors button').count()
        check('tapping a dot opens a grid of every color (D35)', swatches == len(PALETTE), swatches)
        await p.click(f'#lists-rows li:nth-child(2) .colors [data-color="{PALETTE[11]}"]')
        check('picking a color closes the grid', await p.locator('#lists-rows .colors').count() == 0)
    await edit_lists(page, recolor)
    hobbies = next(l for l in await stored_lists(page) if l['id'] == 'hobbies')
    check('recolor a list', hobbies['color'] == PALETTE[11], hobbies)
    await page.click('.tab-add')
    check('To buy cannot be deleted (D33)', await page.is_disabled('#lists-rows li:nth-child(3) [data-act="dropList"]'))
    await page.click('#lists-form [data-act="close"]')

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
    check('partial documents render with defaults (D37)', 'Made in the console' in await titles(page))
    await page.screenshot(path=f'{SHOTS}/desktop.png')
    layout = await page.evaluate("""(() => { const side = document.querySelector('.side').getBoundingClientRect(),
      list = document.querySelector('#list').getBoundingClientRect(), foot = document.querySelector('.foot').getBoundingClientRect();
      return { side: [side.left, side.right, side.height], list: [list.left, list.right], foot: foot.right, width: innerWidth, height: innerHeight }; })()""")
    check('computer: lists in a full-height sidebar, tasks fill the rest of the window (D36)', layout['side'][0] == 0
          and layout['side'][2] == layout['height'] and layout['list'][0] > layout['side'][1]
          and layout['list'][1] >= layout['width'] - 60 and layout['foot'] <= layout['side'][1], layout)
    check('computer: the open list is the page heading', await page.inner_text('#heading') == 'All' and await page.is_visible('#heading'))

    await page.click('[data-act="signout"]'); await page.wait_for_timeout(100)
    check('sign out -> sign-in screen', await page.is_visible('#login') and await page.is_hidden('#main'))
    check('no console errors', not page.errors, page.errors)
    await page.evaluate("localStorage.fakeUser = JSON.stringify({ uid: 'UID123', email: 'me@example.com' }); localStorage.denyReads = '1'")
    await page.reload(); await page.wait_for_timeout(300)
    check('rules not published -> explained', 'firestore.rules' in await page.inner_text('#toast'))
    await ctx.close()

async def test_projects_and_prices(browser, url):
    ctx, page = await context(browser, url, viewport={'width': 1280, 'height': 860})
    await start_signed_in(page, SEED)

    # ── Prices and To buy (D33) ──
    await page.click('[data-view="gym"]')
    await page.fill('#add-title', 'Creatine'); await page.dispatch_event('#add-title', 'input')
    await page.fill('#add-price', '12,50')
    ticked = await page.get_attribute('#add-opts [data-list="buy"]', 'aria-pressed')
    await page.press('#add-price', 'Enter'); await page.wait_for_timeout(100)
    creatine = find(await stored_tasks(page), 'Creatine')
    check('typing a price ticks To buy; the price is stored in cents', ticked == 'true' and creatine['price'] == 1250
          and sorted(creatine['lists']) == ['buy', 'gym'], creatine)
    check('the row shows the price', '12.50' in await page.inner_text('#list .task:has-text("Creatine") .aside'))
    await page.fill('#add-title', 'Resistance band'); await page.dispatch_event('#add-title', 'input')
    await page.fill('#add-price', 'cheap'); await page.press('#add-price', 'Enter'); await page.wait_for_timeout(100)
    message = await page.eval_on_selector('#add-price', 'e => e.validationMessage')
    check('a price that is not a number is refused, with a reason', find(await stored_tasks(page), 'Resistance band') is None
          and 'number' in message, message)
    await page.fill('#add-price', ''); await page.fill('#add-title', ''); await page.dispatch_event('#add-title', 'input')
    await page.click('[data-view="buy"]')
    check('To buy collects priced tasks from every list and project, with a total',
          {'Creatine', 'Protein powder', 'Book flights'} <= set(await titles(page)) and '231.40' in await page.inner_text('#total'),
          (await titles(page), await page.inner_text('#total')))
    check('a subtask shown on its own is tagged with its project',
          'Plan Lisbon trip' in await page.inner_text('#list .task:has-text("Book flights") .tags'))
    await page.click('#list .task:has-text("Creatine") .body')
    await page.fill('#edit-price', '9.99'); await page.click('#edit-form .btn-primary'); await page.wait_for_timeout(100)
    check('edit a price', find(await stored_tasks(page), 'Creatine')['price'] == 999)

    # ── Projects (D32) ──
    await page.click('[data-view="all"]')
    trip = '#list > .task:has-text("Plan Lisbon trip")'
    check('a project row shows progress and a closed arrow', await page.inner_text(f'{trip} .aside') == '1/3'
          and await page.get_attribute(f'{trip} .expand', 'aria-expanded') == 'false')
    top = lambda: page.locator('#list > .task > .col > .line .title').all_inner_texts()
    check('in All, subtasks stay under their project', 'Book flights' not in await top())
    await page.click(f'{trip} .expand')
    check('the arrow shows the open subtasks under the project',
          await page.locator(f'{trip} .subs .title').all_inner_texts() == ['Book flights', 'Find a hotel near Alfama'])
    await page.reload(); await page.wait_for_timeout(250)
    check('expanded projects are remembered on this device', await page.get_attribute(f'{trip} .expand', 'aria-expanded') == 'true')
    await page.click(f'{trip} .subs .task:has-text("Find a hotel") .check'); await page.wait_for_timeout(500)
    check('tick a subtask from the list', await page.inner_text(f'{trip} .aside') == '2/3')

    await page.click(f'{trip} .line .body'); await page.wait_for_timeout(150)
    check('tapping a project opens its page, with its description', page.url.endswith(f'#p={TRIP}')
          and await page.inner_text('#project-head h1') == 'Plan Lisbon trip'
          and 'Budget about 600 €.' in await page.inner_text('#project-head .notes'))
    await page.screenshot(path=f'{SHOTS}/project-page.png')
    await add(page, 'Pack sunscreen')
    subtask = find(await stored_tasks(page), 'Pack sunscreen')
    check('a subtask added on the project page belongs to it', subtask['parent'] == TRIP and subtask['lists'] == [], subtask)
    await page.click('#list .task:has-text("Pack sunscreen") .body')
    check('a subtask cannot become a project (one level)', await page.is_hidden('#make-project') and await page.is_hidden('#edit-notes'))
    await page.click('#editor [data-act="close"]')
    await page.click('#project-head [data-act="edit"]')
    check('the project editor has a description', await page.is_visible('#edit-notes') and await page.is_hidden('#make-project'))
    await page.fill('#edit-notes', 'Long weekend in May.\nAsk Rita about the hotel.'); await page.click('#edit-form .btn-primary')
    await page.wait_for_timeout(100)
    check('edit the description', 'Ask Rita' in await page.inner_text('#project-head .notes'))
    await page.go_back(); await page.wait_for_timeout(150)
    check('back (the phone gesture) returns to the list', await page.is_hidden('#project-head') and '#p=' not in page.url)

    await page.click('[data-view="work"]')
    await page.click('#list .task:has-text("Send Q3 report") .body')
    await page.click('#make-project'); await page.wait_for_timeout(150)
    report = next(k for k, t in (await stored_tasks(page)).items() if t['title'] == 'Send Q3 report to Ana')
    check('make a task a project: its page opens', (await stored_tasks(page))[report]['project'] is True
          and await page.inner_text('#project-head h1') == 'Send Q3 report to Ana')
    await add(page, 'Collect numbers')
    await page.click('#project-head [data-act="back"]'); await page.wait_for_timeout(150)
    check('the page\'s back button returns to its list', await page.get_attribute('[data-view="work"]', 'aria-current') == 'page'
          and await page.is_hidden('#project-head'))

    await page.click('[data-view="all"]')
    await page.click(f'{trip} > .check'); await page.wait_for_timeout(500)
    tasks = await stored_tasks(page)
    check('completing a project completes its open subtasks', tasks[TRIP]['done']
          and all(t['done'] for t in tasks.values() if t.get('parent') == TRIP))
    await page.click('#done-summary')
    await page.click('#done-list .task:has-text("Plan Lisbon trip") .body'); await page.wait_for_timeout(150)
    await page.click('#project-head [data-act="edit"]'); await page.click('#edit-form [data-act="deleteTask"]')
    await page.wait_for_timeout(150)
    tasks = await stored_tasks(page)
    check('deleting a project deletes its subtasks', TRIP not in tasks and not any(t.get('parent') == TRIP for t in tasks.values()))
    check('a deleted project\'s page falls back to the list', await page.is_hidden('#project-head') and await page.is_visible('#list'))
    check('projects and prices: no console errors', not page.errors, page.errors)
    await ctx.close()

async def test_dates_colors_links(browser, url):
    ctx, page = await context(browser, url, viewport={'width': 1280, 'height': 860})
    await ctx.route('https://example.com/**', lambda r: r.fulfill(body='ok'))   # links open here, never on the real network
    await start_signed_in(page, SEED)

    # ── Priority colors (D39) ──
    high = '#list .group:has([data-prio="1"])'
    check('priority labels start in their default colors', PRIO_COLORS[0] in await page.get_attribute(high, 'style'))
    await page.click(f'{high} .group-name')
    check('tapping a priority label opens its color grid', await page.is_visible('#prio-editor')
          and await page.locator('#prio-colors button').count() == len(PALETTE))
    await page.click(f'#prio-colors [data-color="{PALETTE[9]}"]'); await page.wait_for_timeout(100)
    colors = (await stored(page)).get(SETTINGS, {}).get('prioColors')
    check('a new priority color is saved for every device, on the label and the picker', colors == [PALETTE[9], *PRIO_COLORS[1:]]
          and PALETTE[9] in await page.get_attribute(high, 'style') and await page.is_hidden('#prio-editor')
          and PALETTE[9] in await page.get_attribute('#add-opts [data-prio="1"]', 'style'), colors)
    check('tasks themselves are not colored by priority', await page.locator('#list .task[style]').count() == 0)

    # ── Dates (D38) ──
    await page.click('[data-view="work"]')
    await page.fill('#add-title', 'Quarterly review'); await page.dispatch_event('#add-title', 'input')
    await page.fill('#add-start', day(5)); await page.fill('#add-end', day(3)); await page.press('#add-title', 'Enter')
    await page.wait_for_timeout(100)
    message = await page.eval_on_selector('#add-end', 'e => e.validationMessage')
    check('an end before the start is refused, with a reason', find(await stored_tasks(page), 'Quarterly review') is None
          and 'before the start' in message, message)
    await page.fill('#add-end', day(8)); await page.press('#add-title', 'Enter'); await page.wait_for_timeout(100)
    review = find(await stored_tasks(page), 'Quarterly review')
    check('start and end are stored as calendar dates', review and (review['start'], review['end']) == (day(5), day(8)), review)
    row = '#list .task:has-text("Quarterly review")'
    check('the row shows its dates', '–' in await page.inner_text(f'{row} .tags'))
    await page.click(f'{row} .body')
    check('the editor shows the dates', await page.input_value('#edit-start') == day(5))
    await page.fill('#edit-start', ''); await page.click('#edit-form .btn-primary'); await page.wait_for_timeout(100)
    review = find(await stored_tasks(page), 'Quarterly review')
    check('an end without a start is a due date', review['start'] is None and review['end'] == day(8)
          and 'Due' in await page.inner_text(f'{row} .tags'), review)

    # ── Links (D40) ──
    await page.click(f'{row} .body')
    await page.fill('#edit-url', 'javascript:alert(1)'); await page.click('#edit-form .btn-primary'); await page.wait_for_timeout(100)
    message = await page.eval_on_selector('#edit-url', 'e => e.validationMessage')
    check('only web addresses are accepted as links', find(await stored_tasks(page), 'Quarterly review')['url'] is None
          and 'web address' in message, message)
    await page.fill('#edit-url', 'example.com/q3'); await page.click('#edit-form .btn-primary'); await page.wait_for_timeout(100)
    link = f'{row} a.url'
    check('a link typed without https:// gets it, and shows as the site name', find(await stored_tasks(page), 'Quarterly review')['url']
          == 'https://example.com/q3' and await page.get_attribute(link, 'href') == 'https://example.com/q3'
          and (await page.inner_text(link)).startswith('example.com'))
    async with ctx.expect_page() as opened:
        await page.click(link)
    tab = await opened.value
    check('clicking a link opens it in a new tab, not the editor', tab.url == 'https://example.com/q3' and await page.is_hidden('#editor'))
    await tab.close()
    await page.fill('#add-title', 'Read the style guide'); await page.dispatch_event('#add-title', 'input')
    await page.fill('#add-url', 'https://example.com/style'); await page.press('#add-title', 'Enter'); await page.wait_for_timeout(100)
    check('add a link while adding a task', find(await stored_tasks(page), 'Read the style guide')['url'] == 'https://example.com/style')

    # ── Project timeline (D38) ──
    await page.click('[data-view="all"]')
    await page.click('#list > .task:has-text("Plan Lisbon trip") .line .body'); await page.wait_for_timeout(150)
    check('a project shows its link', await page.get_attribute('#project-head a.url', 'href') == 'https://www.visitlisboa.com/en')
    names = await page.locator('.gantt .g-name').all_inner_texts()
    check('the timeline lists the project, then its dated subtasks by start date',
          names == ['Plan Lisbon trip', 'Book flights', 'Travel adapter', 'Find a hotel near Alfama'], names)
    bars = await page.eval_on_selector_all('.gantt .g-bar', 'els => els.map(e => [parseFloat(e.style.left), parseFloat(e.style.width)])')
    check('bars share one time axis, the project spanning it', bars[0] == [0, 100]
          and [b[0] for b in bars[1:]] == sorted(b[0] for b in bars[1:]), bars)
    check('bars take their priority\'s color', PALETTE[9] in await page.locator('.gantt .g-bar').nth(1).get_attribute('style'))
    check('the timeline marks today, with a legend', await page.locator('.gantt i.today').count() == 1
          and await page.locator('.g-legend span').all_inner_texts() == ['High', 'Normal', 'Low', 'Today'])
    await page.screenshot(path=f'{SHOTS}/project-timeline.png')
    await page.locator('.gantt .g-bar').nth(1).click()
    check('clicking a bar opens that subtask', await page.input_value('#edit-title') == 'Book flights')
    await page.click('#editor [data-act="close"]')
    await add(page, 'Pack sunscreen')
    check('subtasks without dates are counted under the timeline', '(1)' in await page.inner_text('.gantt .g-note'))
    check('dates, colors and links: no console errors', not page.errors, page.errors)
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
            await page.tap('#lists-rows li:last-child .swatch')
            await page.screenshot(path=f'{shot}-lists.png')
            await page.tap('#lists-form .btn-primary'); await page.wait_for_timeout(100)
            fits = await page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            check(f'{name}: a sixth list wraps instead of overflowing', 'Garden' in await tab_names(page) and fits)
            await page.tap('[data-view="all"]'); await page.tap('#list > .task:has-text("Plan Lisbon trip") .expand')
            await page.screenshot(path=f'{shot}-project-row.png')
            await page.tap('#list > .task:has-text("Plan Lisbon trip") .line .body'); await page.wait_for_timeout(150)
            await page.screenshot(path=f'{shot}-project.png')
            fits = await page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            check(f'{name}: project page opens and fits', fits and await page.is_visible('#project-head'))
            check(f'{name}: no console errors', not page.errors, page.errors)
            await ctx.close()

async def test_real_sdk(browser, url):
    d = os.path.join(TMP, f'firebase-{SDK_VERSION}')
    if not os.path.exists(f'{d}/node_modules/firebase/firebase-app.js'):   # the CDN build ships in the npm package
        subprocess.run([shutil.which('npm') or 'npm', 'install', '--silent', '--prefix', d, f'firebase@{SDK_VERSION}'], check=True)
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
    source = open(html, encoding='utf-8').read()   # read first: open(..., 'w') empties the file
    open(html, 'w', encoding='utf-8').write(source.replace('<title>Todo</title>', '<title>Todo v2</title>'))
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
            await test_projects_and_prices(browser, url)
            await test_dates_colors_links(browser, url)
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
