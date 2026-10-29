# How to write John's "What I did today" post

These are instructions for an AI agent: Claude Code running on John's Mac, with shell access, the `basecamp` CLI, `pandoc`, `curl` and ssh to the deweb server.

The goal is a short, factual Basecamp comment that tells Decent's **non-technical staff** what John got done today. You build it from his Claude Code session transcripts.

---

## 1. Gather the day's work

### Source: Claude Code transcripts

- **Where they are:** every session is a JSONL file in `~/.claude/projects/<project-dir>/<session-id>.jsonl`. Most are in `~/.claude/projects/-Users-john/`.
- **Which files:** those modified in the time window (default: the last 18 hours): `find ~/.claude/projects -name '*.jsonl' -mmin -1080 -size +5k`.
  - Under RTK, run it as `rtk proxy find …`, because RTK mangles `find` output.
- **Skip your own session.** Its id is in your scratchpad path.
- **Check every line's timestamp.** Old sessions that were resumed today contain days of history, so a file's modified time isn't enough.
  - Each line's `timestamp` is ISO **UTC** (`…Z`). Convert the window start to UTC before comparing.
  - John is in the UK (BST/GMT). Write times in local time.
- **What to pull from each session:**
  - **User prompts:** `type=="user"` lines whose content is text. Skip strings starting with `<`, which are system or tool output.
  - **The assistant's last 2 or 3 long text replies**, over 200 characters. These are the session's own wrap-up and usually say what was committed, deployed and left open.
  - **The session title:** `type` is `summary`, `custom-title` or `ai-title`.
  - **Skip `isSidechain: true` lines.** Those are subagents.
- **Sample extractor:**

```python
import json, glob, os, datetime
cut = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=18)
for f in sorted(glob.glob(os.path.expanduser('~/.claude/projects/*/*.jsonl')), key=os.path.getmtime):
    if os.path.getmtime(f) < cut.timestamp(): continue
    users, replies, title = [], [], None
    for line in open(f, errors='replace'):
        try: d = json.loads(line)
        except: continue
        title = d.get('summary') or d.get('customTitle') or d.get('aiTitle') or title
        ts = d.get('timestamp')
        if not ts or d.get('isSidechain'): continue
        t = datetime.datetime.fromisoformat(ts.replace('Z', '+00:00'))
        if t < cut: continue
        c = d.get('message', {}).get('content')
        if d.get('type') == 'user':
            txt = c if isinstance(c, str) else ' '.join(x.get('text', '') for x in c if isinstance(x, dict) and x.get('type') == 'text') if isinstance(c, list) else ''
            if txt and not txt.startswith('<'): users.append((t.astimezone().strftime('%H:%M'), txt[:400]))
        elif d.get('type') == 'assistant' and isinstance(c, list):
            replies += [x['text'] for x in c if x.get('type') == 'text' and len(x['text']) > 200]
    if users or replies:
        print('=====', os.path.basename(f)[:8], title)
        for u in users[:25]: print('  U', *u)
        for a in replies[-2:]: print('  A>>', a[:1500].replace('\n', ' | '))
```

### Decide what's in scope

- **Include only Decent Espresso work.** Exclude Magnatune, BookMooch, and John's personal projects and tools: his own Mac apps, file conversions, video copies.
- **Leave out work staff won't notice.** Restart tooling, debug harnesses and memory profiling are examples. One "Behind the scenes" line is enough for infrastructure staff might care about: the server upgrade, the accounting backup.
- **Don't treat the session's last word as the final state.** A reply saying "committed, not deployed" may be followed by John saying "deployed". Read the prompts after it.

---

## 2. Check what's live

For each item, decide which of these it is:

- **Live:** John said "deployed", or you verified the code on prod.
- **Committed, not live:** write "(goes live shortly)".
- **Not committed or in progress:** leave it out, or list it under "In progress" if staff would care.

Check prod when you're unsure. deweb is `ssh -l decent vm.decentespresso.com`, tree `/decentespresso`. `ls -l` the file and compare dates. Admin URLs return 401 to anyone not logged in, whether or not the page exists, so curl can't prove an admin page exists.

---

## 3. Link the Basecamp to-dos

- **Where they are:** John's to-dos live in the **John Todo** project (bucket `47525979`). Each session usually started from one, and its URL is in the first prompt or the wrap-up.
- **Find the ids:** `grep -oE 'buckets/47525979/todos/[0-9]+' <session>.jsonl | sort | uniq -c | sort -rn`. The most frequent id is usually the session's own to-do.
- **Confirm each title:** `basecamp todos show <id> --in 47525979 --jq '.data.title'`. Drop ids that aren't about the item.
- **Link format:** `https://3.basecamp.com/3671212/buckets/47525979/todos/<id>`

**Link style (John's standard):**

- **Inline after the thing it belongs to:** `(to-do)`, where only the word "to-do" is the link.
- **One to-do in a section:** put it after the section title, as in `Page speed (to-do)`.
- **Several in a section:** put one after each bullet.
- **Never** a separate "📌 Basecamp to-do" line.

---

## 4. Link to what staff can see

Wherever a result is visible on a website, link to it. **Put the link on the relevant words in the sentence.** Never use "(example)", "(see it)" or "(try it)".

> ✅ New **[Speed Test page](…/admin/speed_test)** in the admin Content section.
> ❌ New Speed Test page in the admin Content section. ([see it](…))

- **Public pages:** check each with `curl -s -o /dev/null -w '%{http_code}' -A Mozilla <url>`. Expect 200, or the expected 301 for redirects.
- **Language hosts:** use subdomains such as `de.`, `fr.`, `es.`, `kr.`, `ar.` and `zh-hans.decentespresso.com`. Slugs end in `_<lang>`, for example `bengle_documentation_zh-hans`.
  - Find the right one from the page's `hreflang` links. Don't guess: Chinese is `zh-hans`, not `zh` or `cn`.
- **Admin pages:** link a real example, such as a customer's billing page `/admin/billing?memberid=N`. Use the same example customer the session tested with.
- **Don't link:** work that isn't live yet, or work with nothing visible to show.

---

## 5. Writing style

The audience is non-technical staff. **Facts only. Short and clear.**

- **No hype or salesmanship.**
  - No "Big day here", "in one click", "it's done for you", "faster website" (unless measured), "Coming soon", or exclamation marks.
  - Say what changed and where.
- **No technical words.** No file names, version numbers, commit hashes, CVS/git, server names, procs, SQL or APIs. "The website server is on the latest version", not "NaviServer e8aaec6".
- **Plain verbs:** "now shows", "is linked to", "no longer scrolls sideways", "goes live shortly".
- **Numbers are welcome when they're facts:** "22 untagged posts now have tags", "all 207 linked team members".
- **No emoji** in section titles or anywhere else.
- **Bullets, not paragraphs.** At most one short intro sentence per section.
- **Each bullet:** a short key phrase, then one or two sentences.

### Structure

Use only the sections that have content, in this order:

1. **Customer chats on respond.io** (or another customer-facing tool)
2. **Website content and translations**
3. **Page speed**
4. **Google search**
5. **Fixes:** one bullet per fix, each with its own (to-do)
6. **Team chat (dcamp)**
7. **Behind the scenes:** infrastructure only, 1 or 2 lines

Start with a date line: `Friday 23 October 2026`. No title: the parent Basecamp message already has one ("What I did today").

### Example bullets (from 23 Oct 2026)

```
Customer chats on respond.io (to-do)
WhatsApp, Instagram and Messenger chats are now linked to customer records.
• Read any [customer's chats] from their admin page. There's a new respond.io button on the [billing page] and on the [email page], next to the dcamp button.
• Chats are matched to customers automatically. If the phone number or email matches, the chat is linked automatically. Unclear matches go to a [review page].
• In progress: an inbox listing all chats, including from people who aren't customers, and a stats page showing reply times and busiest hours.

Fixes
• Password reset: a customer couldn't reset their password, because email security scanners were "clicking" the reset link before the customer could. Fixed (goes live shortly). (to-do)
• [Billing page]: it no longer scrolls sideways on smaller screens. (to-do)
```

(In the source markdown, key phrases are written in `**bold**` only as a marker. Step 6 turns them into colour contrast, not bold.)

---

## 6. Basecamp formatting (important)

Write the post in Markdown first, then convert it to HTML for Basecamp with these rules:

| Element | HTML to send | Why |
|---|---|---|
| Section title | `<h1>Title (<a href="…">to-do</a>)</h1>` | Basecamp's editor has one heading level |
| Blank line before each section | `<p><br></p>` | **Never a bare `<br>`.** It displays, but Basecamp's editor deletes it as soon as John edits the post |
| Normal text | `<mark style="color: var(--highlight-9);">…</mark>` | John's chosen light grey. It's a Basecamp palette colour, so it adapts to dark mode |
| Key phrases | plain text, no wrapper | Default text colour gives the contrast. **No bold, no black `rgb(0,0,0)`** (invisible in dark mode) |
| Links inside grey text | `<a href="…"><mark style="color: var(--highlight-9);">words</mark></a>` | Keeps the link grey and survives editing |
| Horizontal rules | drop them | |

The editor rewrites `<span style="color…">` as `<mark>`, so send `<mark>` from the start.

### Converter

Markdown to Basecamp HTML:

```bash
pandoc summary.md -f gfm -t html5 --wrap=none \
 | sed -e '/^<hr \/>$/d' -e '/^<h1/d' -e 's#<h2[^>]*>\(.*\)</h2>#<p><br></p>\n<h1>\1</h1>#' > bc0.html
python3 - bc0.html bc.html <<'EOF'
import sys, re
G = '<mark style="color: var(--highlight-9);">'
s = open(sys.argv[1]).read()
def wrap(t):
    t = re.sub(r'(<a [^>]+>)(.*?)</a>', lambda m: '</mark>' + m.group(1) + G + m.group(2) + '</mark></a>' + G, t)
    return (G + t + '</mark>').replace(G + '</mark>', '')
def fix(m):
    tag, body = m.group(1), m.group(2)
    if body == '<br>': return m.group(0)   # blank line: leave as <p><br></p>
    parts = re.split(r'(<strong>.*?</strong>)', body)
    return f'<{tag}>' + ''.join(p[8:-9] if p.startswith('<strong>') else wrap(p) for p in parts) + f'</{tag}>'
open(sys.argv[2], 'w').write(re.sub(r'<(p|li)>(.*?)</\1>', fix, s))
EOF
```

(In the markdown, `# Title` is dropped, `## Section` becomes `<h1>`, and `**phrase**` marks a key phrase.)

---

## 7. Post and verify

1. **Run the Basecamp CLI rules first:** `basecamp comments create --agent --help`, and parse the URL John gives you with `basecamp url parse "<url>" --json`.
2. **Post:** `basecamp comments create <message_id> - --in <project_id> --format html --json < bc.html`
3. **Revise:** to change it later, update the same comment: `basecamp comments update <comment_id> - --in <project_id> --format html --json < bc.html`. Never post a second comment.
4. **Read it back** and check that it saved correctly: `basecamp comments show <comment_id> --in <project_id> --jq '.data.content'`. Count `<p dir="auto"><br></p>` (one per section) and make sure no `rgb(0, 0, 0)` or `<strong>` is left.
5. **If John has edited it by hand,** read it back first and keep his changes, such as a colour he picked or a reworded sentence. Then rebuild from your markdown with his edits merged in.
6. **Optional:** a styled HTML copy on John's Desktop, using `pandoc -s` with CSS where body text is light grey (`#8a8a8a`), `strong` is `font-weight:normal` in the default dark colour, and there's a dark-mode variant.

---

## 8. Final checklist

- [ ] Only Decent work; Magnatune, BookMooch and personal tools left out
- [ ] Every item's live / not-live status checked
- [ ] To-dos found, titles confirmed, linked as "(to-do)" after the title or bullet
- [ ] Visible results linked on the relevant words; public URLs return 200
- [ ] No hype, no jargon, no emoji, no bold
- [ ] Blank lines are `<p><br></p>`; normal text is `var(--highlight-9)` grey; no black
- [ ] Posted with `--format html`, read back, and checked
