# How to write Mark's "What I did today" post

These are instructions for an AI agent: Claude Code running on Mark's Mac, with shell access,
`git`, `gh`, and the **Basecamp MCP** tools (`mcp__claude_ai_Basecamp__*`).

The goal is a short, factual Basecamp comment that tells Decent's **non-technical staff** what
Mark got done today. You build it from his Claude Code session transcripts.

There is no `basecamp` CLI and no `pandoc` on this machine. Use the Basecamp MCP tools and the
Python converter in section 6.

---

## 1. Gather the day's work

### Source: Claude Code transcripts

- **Where they are:** every session is a JSONL file in `~/.claude/projects/<project-dir>/<session-id>.jsonl`.
  Mark's work spans several project dirs, mainly:
  - `-Users-markc-Documents-streamline-js-dye2` — the DYE2 plugin
  - `-Users-markc-Documents-streamline-js-streamline-project` — the Streamline skin (streamline-js)
  - `-Users-markc-Documents-streamline-js-reaprime-reaprime` — Decaid, the host app
  - `-Users-markc-Documents-de1app-de1app`, `-Users-markc-Documents-markstreamline`, `-Users-markc`
- **Which files:** those modified in the time window (default: the last 18 hours):
  `find ~/.claude/projects -name '*.jsonl' -mmin -1080 -size +5k`.
- **Skip your own session.** Its id is in your scratchpad path.
- **Check every line's timestamp.** Old sessions that were resumed today contain days of history,
  so a file's modified time isn't enough.
  - Each line's `timestamp` is ISO **UTC** (`…Z`). Convert the window start to UTC before comparing.
  - **Mark is in Hong Kong (HKT, UTC+8).** Write times in local time. Because he often works late,
    an 18-hour window usually covers *yesterday afternoon and evening plus this morning* — so the
    bulk of the work frequently belongs to **yesterday's date**. Date the post by the day the work
    was actually done, and say so in your reply if it isn't today.
- **What to pull from each session:**
  - **User prompts:** `type=="user"` lines whose content is text. Skip strings starting with `<`,
    which are system or tool output.
  - **The assistant's last 2 or 3 long text replies**, over 200 characters. These are the session's
    own wrap-up and usually say what was committed, released and left open.
  - **The session title:** `type` is `summary`, `custom-title` or `ai-title`.
  - **Skip `isSidechain: true` lines.** Those are subagents.
- **Sample extractor** (write it to the scratchpad and run it with `python3 -I`):

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
        print('=====', f.split('/')[-2], os.path.basename(f)[:8], title)
        for u in users[:25]: print('  U', *u)
        for a in replies[-2:]: print('  A>>', a[:1500].replace('\n', ' | '))
```

### Cross-check against git

The transcripts say what was *attempted*. Git says what *landed*. Always read both:

```bash
for d in ~/Documents/streamline_js/dye2 \
         ~/Documents/streamline_js/streamline_project \
         ~/Documents/streamline_js/reaprime/reaprime; do
  echo "=== $d"
  git -C "$d" log --all --since="<window start>" --pretty='%h %an %ad %d %s' --date=iso-local
done
```

- **Check the author.** These repos carry commits from Vid Tadel and others. Only `allofmeng` /
  Mark Chau commits belong in Mark's post.
- A commit message is the most reliable one-line description of a change. Prefer it over the
  session's prose.

### Source: Mark's replies to other people

Answering customers and teammates is a real part of the day and belongs in the post. The
transcripts won't show it, because he writes those replies in Basecamp himself.

- **Basecamp:** `mcp__claude_ai_Basecamp__get_person_progress` with `person_id: 47088403` returns
  his activity timeline, newest first — every comment, message and completed to-do, with a
  `summary_excerpt` of each. `created_at` is **UTC**; convert to HKT. Page back with `page` until
  you are past the window.
  - Read the excerpt to judge each one. Keep replies to **customers** (mostly in **Decent
    Diaspora**, bucket `7351439`) and threads he **started** for someone else's problem.
  - Drop his comments on his own to-dos — progress notes to himself, or deep technical analysis for
    Vid and John. Staff won't notice those.
- **GitHub:**
  `gh api "repos/<owner>/<repo>/issues/comments?since=<ISO>&per_page=100" --jq '.[] | select(.user.login=="allofmeng") | "\(.created_at) \(.issue_url|split("/")|last) \(.body|.[0:110])"'`
  over `decentespresso/dye2`, `decentespresso/streamline-js` and `decentespresso/decaid`.
  - These usually restate a fix that is already a bullet in the post. Don't give them their own
    bullet, and don't link GitHub.
- **For each kept reply, one bullet:** who asked, what they wanted, what you told them. Use the
  person's first name. Link the Basecamp thread — staff can read those.

### Decide what's in scope

- **Include only Decent Espresso work:** the DYE2 plugin, the Streamline skin, Decaid, Bengle,
  the Decent Scale / HDS, profiles, plugin and release tooling where staff would notice it.
- **Leave out Mark's personal projects and tools**, file conversions, and anything unrelated to
  Decent.
- **Leave out work staff won't notice.** Test harnesses, refactors, docs for agents, memory rules,
  CI plumbing. One "Behind the scenes" line is enough for infrastructure staff might care about:
  a release pipeline change, an automatic update, a merged host change.
- **Don't treat the session's last word as the final state.** A reply saying "committed, not
  released" may be followed by a release later the same evening. Read the prompts after it, and
  check git and the GitHub releases.

---

## 2. Check what's live

Mark's work reaches users through three different doors. Check the right one for each item.

| Work | Live when |
| --- | --- |
| **Streamline skin** (`streamline_project`) | the commit is in `origin/dist`. The tip of `dist` is a `deploy: <sha>` commit naming the `main` commit it shipped: `git -C ~/Documents/streamline_js/streamline_project log origin/dist -1` |
| **DYE2 plugin** (`dye2`) | the commit is at or before the latest release tag: `gh release list --repo decentespresso/dye2 -L 5` and `git tag --sort=-creatordate \| head -3`. Commits after the newest tag are **not** released |
| **Decaid** (`reaprime`) | the PR is merged into `main`, and a Decaid release carries it |

Then label each item:

- **Live:** verified by one of the checks above.
- **Committed, not live:** write "(goes live shortly)".
- **Not committed or in progress:** leave it out, or list it under "In progress" if staff would care.

**Workflow writes need the endpoint check.** Per dye2's `CLAUDE.md`, any change that writes to the
workflow is not done until the value is confirmed on Decaid's own `/workflow` endpoint. If a
session verified an item that way, it is safe to report as working; if it was only unit-tested, say
"verified by tests, not on a machine" in your reply to Mark — not in the post, which stays
non-technical.

---

## 3. Link the Basecamp to-dos

- **Where they are:** Mark's to-dos live in the **Mark Chau Projects** project (bucket `39931847`),
  mostly under the lists "John found bugs / changes for Streamline app", "streamline.js project"
  and "DYE2 on decaid". Some shared work sits in **Vid Codes** (`42895019`) and **Soso Hardware
  Hacking** (`37071692`).
  - Bucket `47525979` is **John Todo** — John's own list. Do not link it for Mark's work.
- **Find them:** `mcp__claude_ai_Basecamp__get_my_assignments` lists Mark's open to-dos with ids and
  titles. `mcp__claude_ai_Basecamp__search` finds closed or unassigned ones by keyword.
  Sessions sometimes name a to-do URL in the first prompt — `grep -oE 'buckets/[0-9]+/todos/[0-9]+'
  <session>.jsonl | sort | uniq -c | sort -rn`.
- **Confirm each title** with `mcp__claude_ai_Basecamp__get_todo` before linking. Drop ids that
  aren't about the item.
- **Link format:** `https://3.basecamp.com/3671212/buckets/39931847/todos/<id>`
- Much of Mark's work is tracked as **GitHub issues** in `decentespresso/dye2` and
  `decentespresso/streamline-js`, not as Basecamp to-dos. That is fine: a section with no to-do
  simply has no link. Never invent one, and don't link GitHub — staff can't read it.

**Link style:**

- **Inline after the thing it belongs to:** `(to-do)`, where only the word "to-do" is the link.
- **One to-do in a section:** put it after the section title, as in `Profiles (to-do)`.
- **Several in a section:** put one after each bullet.
- **Never** a separate "📌 Basecamp to-do" line.

---

## 4. Link to what staff can see

Mark's work is tablet software, so there is usually **nothing on a website to link**. Don't force it.

- Where a result *is* visible on a public page, link it, and put the link on the relevant words in
  the sentence. Never "(example)", "(see it)" or "(try it)".
- Check any public page with `curl -s -o /dev/null -w '%{http_code}' -A Mozilla <url>`. Expect 200.
- **Don't link:** GitHub issues, pull requests, releases, commits, or anything behind a login.
  Don't link work that isn't live yet.
- Where something is worth showing, a **screenshot** beats a link. Say in your reply that Mark can
  drop one into the comment himself — image upload isn't worth the trouble from here.

---

## 5. Writing style

The audience is non-technical staff. **Facts only. Short and clear.**

- **No hype or salesmanship.** No "Big day here", "in one click", "Coming soon", or exclamation
  marks. Say what changed and where.
- **No technical words.** No file names, version numbers, commit hashes, git, branches, endpoints,
  JSON, APIs or repository names. "The tablet app now installs the newest plugin by itself", not
  "the build script resolves the latest release tag".
  - "DYE2" and "Streamline" are fine — staff know those names. "the workflow", "the KV store",
    "deep merge" are not.
- **Plain verbs:** "now shows", "is cleared", "no longer renames", "goes live shortly".
- **Numbers are welcome when they're facts:** "all three bean fields", "8 languages".
- **No emoji** in section titles or anywhere else.
- **Bullets, not paragraphs.** At most one short intro sentence per section.
- **Each bullet:** a short key phrase, then one or two sentences — what was wrong, then what happens
  now. A bug fix means nothing to staff unless they know what the customer saw.

### Structure

Use only the sections that have content, in this order:

1. **Profiles**
2. **Recipes and favourites**
3. **Shot chart and dashboard**
4. **Beans, grinders and equipment**
5. **Fixes:** anything that doesn't fit a section above, one bullet per fix
6. **Customer and team replies:** who he answered and what he told them, plus any customer problem
   that was diagnosed rather than fixed. One bullet each, the thread linked.
7. **Behind the scenes:** infrastructure and host changes only, 1 or 2 lines

Start with a date line: `Tuesday 27 October 2026`. No title: the parent Basecamp message already
has one ("What I did today").

### Example bullets

```
Recipes
• Tapping a recipe loads its profile. A recipe that had stored a complete profile was being
  ignored: whatever profile was already loaded stayed on the machine and simply took the recipe's
  name.
• Switching recipes clears the old coffee. Tapping a recipe with no coffee attached used to leave
  the previous recipe's coffee, roaster and batch in place. All three are now cleared together.
  (goes live shortly)

Fixes
• Grind setting keeps a second dot. Typing 1.1.0 as a grind size reverted to 1. It is now kept as
  typed. (to-do)
```

(In the source markdown, key phrases are written in `**bold**` only as a marker. Step 6 turns them
into colour contrast, not bold.)

---

## 6. Basecamp formatting (important)

Write the post in Markdown first, then convert it to HTML for Basecamp with these rules:

| Element | HTML to send | Why |
|---|---|---|
| Section title | `<h1>Title (<a href="…">to-do</a>)</h1>` | Basecamp's editor has one heading level |
| Blank line before each section | `<p><br></p>` | **Never a bare `<br>`.** It displays, but Basecamp's editor deletes it as soon as the post is edited |
| Normal text | `<mark style="color: var(--highlight-9);">…</mark>` | The light grey the thread uses. It's a Basecamp palette colour, so it adapts to dark mode |
| Key phrases | plain text, no wrapper | Default text colour gives the contrast. **No bold, no black `rgb(0,0,0)`** (invisible in dark mode) |
| Links inside grey text | `<a href="…"><mark style="color: var(--highlight-9);">words</mark></a>` | Keeps the link grey and survives editing |
| Horizontal rules | drop them | |

The editor rewrites `<span style="color…">` as `<mark>`, so send `<mark>` from the start.

### Converter

There is no `pandoc` here. This Python script takes the Markdown and writes Basecamp HTML:

```bash
python3 -I - summary.md bc.html <<'EOF'
import sys, re, html
G = '<mark style="color: var(--highlight-9);">'
src = open(sys.argv[1]).read()

def inline(t):
    t = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', lambda m: f'<a href="{html.escape(m.group(2), quote=True)}">{m.group(1)}</a>', t)
    return t

def wrap(t):
    t = re.sub(r'(<a [^>]+>)(.*?)</a>', lambda m: '</mark>' + m.group(1) + G + m.group(2) + '</mark></a>' + G, t)
    return (G + t + '</mark>').replace(G + '</mark>', '')

def body(t):
    # **phrase** stays in the default colour; everything else goes grey
    parts = re.split(r'(\*\*.*?\*\*)', inline(t))
    return ''.join(p[2:-2] if p.startswith('**') else wrap(p) for p in parts)

out, items = [], []
def flush():
    if items:
        out.append('<ul>\n' + '\n'.join(f'<li>{body(i)}</li>' for i in items) + '\n</ul>')
        items.clear()

for raw in src.split('\n'):
    line = raw.rstrip()
    if line.startswith('## '):
        flush(); out.append('<p><br></p>'); out.append(f'<h1>{inline(line[3:])}</h1>')  # headings stay plain
    elif line.startswith('# '):
        flush()                                   # drop the document title
    elif line.startswith(('- ', '* ', '• ')):
        items.append(line[2:].strip())
    elif line.strip():
        flush(); out.append(f'<p>{body(line.strip())}</p>')
flush()                                           # the last section's bullets
assert '<h1>' in out[-2] or '<ul>' in out[-1], 'last section lost its bullets'
open(sys.argv[2], 'w').write('\n'.join(out))
EOF
```

(In the markdown, `# Title` is dropped, `## Section` becomes `<h1>`, and `**phrase**` marks a key
phrase. Check `bc.html` by eye before posting: no `<strong>`, no `rgb(0, 0, 0)`, one `<p><br></p>`
per section.)

---

## 7. Post and verify

The post is a **comment on the existing "What I did today" message**, not a new message:

- Project: **Tech support team**, bucket `23581669`
- Message: `10437472478` — https://app.basecamp.com/3671212/buckets/23581669/messages/10437472478
- John posts there, and so does Vid. Read the last two or three comments first
  (`mcp__claude_ai_Basecamp__list_comments` on `10437472478`) so you don't repeat what Vid already
  covered about Streamline and DYE2, and so your formatting matches the thread.

Then:

1. **Always show Mark the draft and wait for a clear yes before posting.** Posting puts it in front
   of the whole team; it is not reversible by you.
2. **Post:** `mcp__claude_ai_Basecamp__create_comment` with `recording_id: 10437472478` and the HTML
   as `content`.
3. **Revise:** to change it later, update the same comment with
   `mcp__claude_ai_Basecamp__update_comment`. **Never post a second comment for the same day.**
4. **Read it back** with `mcp__claude_ai_Basecamp__get_comment` and check that it saved correctly:
   count the `<p dir="auto"><br></p>` (one per section) and make sure no `rgb(0, 0, 0)` or
   `<strong>` is left.
5. **If Mark has edited it by hand,** read it back first and keep his changes — a colour he picked, a
   reworded sentence. Then rebuild from your markdown with his edits merged in.
6. Give Mark the comment's URL when you're done.

---

## 8. Final checklist

- [ ] Only Decent work; personal projects left out
- [ ] Only Mark's own commits (checked the author), not Vid's or anyone else's
- [ ] Every item's live status checked: `dist` for Streamline, the release tag for DYE2, merge for Decaid
- [ ] Date line is the day the work was actually done, not necessarily today
- [ ] To-dos found in bucket `39931847` (not John's `47525979`), titles confirmed, linked as "(to-do)"
- [ ] No hype, no jargon, no emoji, no bold, no version numbers or repository names
- [ ] Blank lines are `<p><br></p>`; normal text is `var(--highlight-9)` grey; no black
- [ ] Draft shown to Mark and approved before posting
- [ ] Posted as a comment on message `10437472478`, read back, and checked
