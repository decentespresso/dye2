# DYE2 User Manual

DYE2 ("Describe Your Espresso") is an add-on for the Decaid tablet software on your Decent
Espresso machine. It gives you screens for the things Decaid stores but doesn't show you:
your coffee, your grinders, your shot history, and the settings for the shot you're about
to pull.

This manual assumes no technical knowledge. Read the first three sections, then dip into
"How do I…?" when you need something specific.

---

## What DYE2 does

- **Look back at the shot you just pulled** — the graph, the numbers, the coffee you used.
  Give it stars and a tasting note.
- **Set up the next shot** — dose, drink weight, grind, RPM, profile, beans, who made it,
  who drank it.
- **Keep a coffee library** — roaster, origin, roast date, bag weight, price, notes. One
  entry per coffee, plus a *batch* for each bag you buy.
- **Keep a grinder library** — burrs, step sizes, notes.
- **Save recipes and favourites** — one tap puts a whole set of settings back in place.
- **Send shots to Visualizer** — if you also have the Visualizer plugin installed.

Everything you type into DYE2 is stored by Decaid itself, not hidden inside DYE2. Other
Decaid screens see the same beans, the same shots, the same grinders.

---

## Getting DYE2 on the tablet

Most people already have it: Decaid ships with a copy of DYE2 built in, so you only need
to switch it on in Decaid's plugin settings.

If you want a specific version, download `dye2.reaplugin-vX.Y.Z.zip` from the
[Releases page](../../releases) and install it through Decaid's plugin settings screen.

Once it's enabled, open the DYE2 **Dashboard**. That's the front door — every other DYE2
screen is reached from it. Its address, if a screen ever asks you for one, is:

```
http://localhost:8080/api/v1/plugins/dye2.reaplugin/dashboard
```

The screens are drawn for a tablet held sideways (landscape). They also work in a normal
web browser on a laptop, if you'd rather poke around there first.

---

## The dashboard

The dashboard is split down the middle:

- **Left half = the shot you already pulled.**
- **Right half = the shot you're about to pull.**

### Left: Last Shot

| What you see | What it does |
| --- | --- |
| `Last Shot: Today (3/248)` and a date | Which shot you're looking at — "Today", "Yesterday", or "N days ago" — and where it sits in your history. |
| The graph | Pressure, flow, temperature and weight flow (how fast espresso is landing in the cup — not the total in the cup) during that shot. Dotted lines show what the profile *asked for*; solid lines show what actually happened. Temperature is drawn at one tenth of its real value so it fits on the same scale. |
| The magnifying glass | Search your shots. Tap it, type, and the list narrows to matching shots — it matches coffee name, roaster, profile, grinder and your tasting notes, across your whole history. Beside the box it tells you where you are ("2 of 4 matches"), and `‹ ›` step through them. Tap the glass again (or press Escape) to go back to all shots. |
| `‹` and `›` | Step back and forward through your shots. Every shot the machine has stored is reachable — older ones are fetched as you reach them, so the first tap past the fiftieth may pause for a moment. Past the oldest it loops back to the newest. |
| `All Shots` / `Same Beans` | Tap to switch between them. `Same Beans` shows only shots pulled with the same coffee from the same roaster, searched across your whole history rather than just the recent ones. **The button shows the mode you are in now**, not the one you'd switch to. Switching jumps you to the newest shot in the new list. If the shot on screen has no coffee recorded, the button does nothing. |
| Profile, dose/drink, beans, grinder, barista, drinker | A read-only summary of that shot. To change any of it, use `Edit Shot`. |
| The five stars | Tap a star to rate the shot. It saves immediately — there is no extra confirm step. |
| `Read Note` | Shows the tasting note saved with that shot. Greyed out when there is no note. |
| `Edit Shot` | Opens the full shot editor (see "…fix the details on a shot I already pulled"). |
| The `⌃` next to `Edit Shot` | A small menu: `Export Shot`, `View Text Profile`, `Delete Shot`. **Delete asks first, and cannot be undone.** |
| `DYE Settings ⌃` | Opens `Favourites` or `Recipes` (their own sections below). |
| `Visualizer ⌃` | `Upload to Visualizer` sends the shot currently on screen; `Visualizer Settings` opens the login box (see "Visualizer"). |

### Right: Next Shot Planning

Everything on this side goes into Decaid's live settings — the ones the machine will use
for your next shot.

**Most of it saves as you go:** dose, drink, grind, RPM, barista, drinker, the note, and a
favourite you apply are all written straight away.

**Three things wait for `DONE`:** loading a recipe pill, the clipboard copy, and `Clear`.
Those only change the screen until you press `DONE` — leave with `CANCEL` and they're
thrown away.

| What you see | What it does |
| --- | --- |
| Recipe pills (the row of names at the top) | Your saved recipes. Tap one to load its dose, drink weight, grind, RPM, profile, barista and drinker. `‹ ›` scroll along the row. Says "No recipes yet" until you save one. |
| Profile name | Tap it to choose a different profile. |
| `Dose` / `Drink` | Grams of coffee in, grams of espresso out. The brew ratio is shown under the drink weight. Use `−` and `+`, or **tap the number and type a value**. |
| The row of grinder names | Tapping one highlights it, so you can see which grinder the numbers below belong to. The highlight itself isn't saved — the `Grind` and `RPM` values are. |
| The word `Grind` itself | Tap the **label** `Grind` (not the number) to open the grinder library. This is the only way in. |
| `Grind` / `RPM` | Your grind setting and the grinder's RPM. Each tap moves grind by 0.1 and RPM by 1 (dose moves by 0.5 g, drink by 1 g). |
| `Beans` card | The coffee, its roaster, and how many days it is since roasting. Tap it to pick a different coffee. |
| `Barista` / `Drinker` | Tap either one and type a name. Names you've used before appear in a drop-down; tap one, or finish typing and press Enter. |
| `Add Note` | Writes a note for the **next** shot. After you pull it, `Read Note` on the left shows that note. |
| History icon (top right) | A one-step undo for this panel. Tap it to go back to the values you had before your last change; tap again to bring them back. Greyed out until you change something. |
| Clipboard icon (top right) | Copies every setting from the shot shown on the left into the next-shot panel. The quickest way to repeat a shot you liked. |
| `Clear` | Empties the next-shot panel. The history icon undoes it. |
| `CANCEL` / `DONE` | Both leave the dashboard. `DONE` saves the panel first. |

---

## How do I…?

### …rate the shot I just pulled
Open the dashboard and tap a star on the left. Done — it saves itself. For a written note,
tap `Edit Shot` and use the notes field there.

### …pull the same shot again
Find the shot with `‹ ›` on the left, then tap the **clipboard icon** on the right. Every
setting from that shot lands in the next-shot panel — then press `DONE`, or the copy is
thrown away when you leave.

### …change dose, drink weight, grind or RPM
Use `−` / `+` on the right, or tap the number itself and type. Press Enter to accept,
Escape to cancel. **Tapping elsewhere also accepts** what you typed — it doesn't cancel.

### …use a different profile
Tap the profile name on the right of the dashboard. You get a grid of profile cards with a
search box; the sort rail here offers only `A-Z`, `Z-A`, `Recent` and `Oldest`. Tap a
profile, then `CONFIRM`. `READ MORE` on a card shows its full description.

### …use a different coffee
Tap the `Beans` card on the right. You get a grid of coffee cards:

1. Tap a coffee to select it (it turns blue).
2. Tap the button in the top right. It says **CONFIRM** if that coffee already has a
   roaster, or **SELECT ROASTER** if it doesn't — in which case you pick the roaster on the
   next screen and tap **SELECT ROASTER** again there to finish.

The roaster screen has no search box, and its **ADD NEW ROASTER +** card opens the
add-a-coffee form rather than a roaster-only form — you add a roaster by adding a coffee
with that roaster's name on it.

The coffee, its roaster, its roast date and its bag are all written into the next shot.

Use the search box at the top and the sort buttons down the left (`Recent`, `Oldest`,
`A-Z`, `Z-A`) when the list gets long. The little **pencil** on a card opens that coffee
for editing instead of selecting it.

### …add a bag of coffee
In the bean picker, tap **ADD NEW BEANS**. The form is one long page you scroll through:

- **Top** — bean name, roaster, roast date. Both name and roaster suggest entries you
  already have as you type.
- **Origin** — species, processing, country, region, producer, variety, altitude range, and
  a decaf switch (turning it on reveals a decaf-process field).
- **Roast & Batch Details** — roast level, harvest date, quality score, frozen switch.
- **Purchase & Storage** — price and currency, total and remaining weight, and dates for
  buying, opening, best-before, freezing and unfreezing.
- **Notes** — bean notes (about the coffee in general) and batch notes (about this bag).

**Bean name and roaster are both required.** If either is empty, that box turns red and
`CONFIRM` does nothing. Everything else is optional — fill in as much or as little as you
like. `CONFIRM` saves; `CANCEL` throws the form away.

### …bring my coffees over from Beanconqueror
DYE2 can read a Beanconqueror backup and create the matching beans, bags and grinders for
you.

1. In **Beanconqueror** on your phone: `Settings → Export`. That gives you a zip file.
2. Unzip it and find **`Beanconqueror.json`** (if the export was split, there may also be
   `Beanconqueror_Beans_0.json`).
3. Get the file onto the tablet, or somewhere you can copy its text from.
4. In DYE2: `Beans` card → **IMPORT FROM BEANCONQUEROR**.
5. Either tap **CHOOSE FILE** and pick the file, **or** paste the text into the big box.
   Pasting is the more reliable route on the tablet, because the file chooser isn't always
   available there.
6. The right-hand panel shows you what *would* happen — how many coffees are new, which
   ones would just get blank fields filled in, how many grinders would be added.
7. Happy with it? Tap **IMPORT** in the top right and watch the progress.

Two things worth knowing:

- **It won't overwrite the coffee details you typed.** For a coffee you already have, it
  only fills in bean fields that are still empty.
- **Bags are a different story.** A bag it imported before gets *refreshed* from the new
  export, so your edits to that bag are replaced — except "remaining weight", which the
  tablet keeps because it counts down as you pull shots.
- **You can run it again.** After your next Beanconqueror export, import again — it matches
  up what's already there instead of making duplicates.

Baskets, drippers and other "preparation" gear are stored as reference data only; they
don't appear as their own screen yet.

### …add my grinder
On the dashboard, tap the **word `Grind`** on the right (the label, not the number). That
opens the grinder library: the same cards, search box and sort buttons as the coffee list,
plus an **ADD NEW GRINDER +** card. Tapping an existing card opens it for editing, and the
form appears as a pop-up with its own `CANCEL` and `SAVE`. `DONE` in the top right takes
you back.

A grinder records:

- **Model** (the only required field)
- Burrs, burr type (flat or conical), burr size in mm
- Setting type — *numeric* (a dial with numbers) or *preset* (named steps), and for preset
  grinders a comma-separated list of the setting names
- **Setting small step / big step** and **RPM small step / big step** — recorded on the
  grinder, but nothing uses them yet: the dashboard always moves grind by 0.1 and RPM by 1
- Notes

### …fix the details on a shot I already pulled
Tap `Edit Shot` on the left of the dashboard. You get a fuller editor: dose, drink, TDS and
extraction yield and the bean card on the left; grinder, grind setting, RPM, barista,
drinker, notes and the star rating on the right.

Along the bottom:

- `Delete Shot` — removes it, after asking.
- `Clear all` — empties the form.
- `Read From ⌃` — fills the form from `Current Workflow` or the `Previous Shot`, so you only
  correct what's different.
- `CANCEL` / `SAVE SHOT DATA`.

`‹ ›` in the header move to another shot without leaving the editor. Unlike the dashboard
they stop at the ends instead of looping.

Also on this screen: tap the beans card to change the coffee, tap the grinder field to open
a **Select Grinder** list (same cards, search and sorts, with its own **ADD NEW GRINDER +**),
`READ MORE` shows the bean notes, and the pencil beside the drinker notes opens a pop-up to
write in.

**Nothing in the shot editor is saved until you press `SAVE SHOT DATA`** — including the
stars, which behave differently here than on the dashboard.

### …send a shot to Visualizer
See "Visualizer" below.

---

## Recipes

`DYE Settings → Recipes` opens **Edit Recipes**. There are five recipe slots — one per tab
across the top (`Recipe 1` … `Recipe 5`).

- **Left column** — recipe name, the coffee it's for, the profile it uses, beverage type,
  barista and drinker.
- **Right column ("Dashboard Variables")** — dose, drink, brew temperature, steam (as flow
  *or* time), flush, hot water (as volume *or* temperature), grind and RPM.
- Under most of those numbers is a strip of four **preset chips**. Tap a chip to jump
  straight to that value.
  - Press and hold a chip for half a second to rewrite it with whatever the number
    currently says. **This is a temporary convenience — rewritten chips go back to their
    normal values next time the page is opened.** The recipe's actual values are saved;
    the chips aren't. Flipping the Steam or Hot Water toggle also rebuilds those chips.
  - The drink chips are *ratios* (1:2.3 and so on) and can't be rewritten this way.

At the bottom: `Clear all`, `Read From ⌃` (fill the recipe from `Current Workflow`, or
`From Favourite`, which sends you off to the favourites list to pick one), a `Show on Streamline Dashboard` switch (turn it off to hide this recipe
from the dashboard pills), `CANCEL` and `SAVE RECIPE`.

**`SAVE RECIPE` saves the tab you're on, and only that one.** Save before switching tabs or
your changes are lost.

---

## Favourites

`DYE Settings → Favourites` shows your favourites as cards. The tabs group them by beans,
recipe, profile or grinder, and the sort buttons work as elsewhere.

- **Tap** a card to select it, then `CONFIRM` — the favourite is applied to the next shot.
- **Press and hold** a card for half a second to open it for editing instead.
- **ADD NEW FAVOURITE** creates one.

In the editor you give the favourite a title, a beverage, a number from 1 to 5, and choose
whether it always shows on the dashboard. The useful part is **Data to Copy** on the right:
each row (profile, beans, roast date, grinder, grind setting, dose, drink, barista, drinker,
note) has its own switch, and only the switched-on rows are copied when you use the
favourite. So a favourite can carry a grind setting without dragging a coffee along with it.
Profile, beans, grinder, grind setting, dose and drink start switched on. The pencil at the
end of a row lets you type that row's value by hand, instead of taking it from a shot.
`SAVE FAVOURITE` keeps the lot.

---

## Visualizer

DYE2 doesn't talk to visualizer.coffee by itself — it drives Decaid's separate **Visualizer
plugin**, which has to be installed for any of this to work.

1. `Visualizer ⌃ → Visualizer Settings`.
2. Type your visualizer.coffee username and password, and save. DYE2 checks them before
   storing them and tells you if they're wrong.
3. **Auto-upload starts switched on**, with a 5-second minimum shot length — shots shorter
   than that aren't uploaded, which keeps flushes out of your Visualizer account. Turn it
   off here if you'd rather upload by hand.

Two quirks of this box: it always opens showing auto-upload ticked and 5 seconds, whatever
you saved last time, and saving again while logged in makes you retype your password.

Once you're logged in, the tick on the `Visualizer` button turns green, the settings box
shows who you're logged in as and offers `Log Out`, and `Upload to Visualizer` sends
whichever shot is showing on the left of the dashboard.

---

## Habits worth picking up

- **Long press means "edit".** Half a second on a favourite card opens it for editing; half
  a second on a preset chip in the recipe editor rewrites that chip.
- **Tap a number to type it.** Dose, drink, grind and RPM all accept typed values — much
  faster than holding `+` when you're a long way off.
- **The next-shot panel saves as you go.** `DONE` is a save-and-leave, not the only save.
- **The history icon is a one-step undo, and it toggles.** Press it twice and you're back
  where you started.
- **Shot navigation on the dashboard wraps around**, so `‹` repeatedly cycles the whole
  list. In the shot editor it stops at the ends.
- **The dashboard reaches your whole shot history**, a page at a time as you tap `‹`. The
  bean and grinder pickers show your whole library too.
- **Searching beats tapping `‹` fifty times.** To find a shot from weeks ago, use the
  magnifying glass — it asks the machine for matches instead of walking back through
  history.

---

## Things that don't work yet

These are drawn on screen but don't do anything, so you're not doing it wrong:

- The **magnifying glass in the shot editor** (the one on the dashboard works).
- **Export Shot** in the `Edit Shot ⌃` menu.
- **View Text Profile** in the same menu (shown greyed out on purpose).
- **Most Used** and **Least Used** sorting, everywhere. In the bean, roaster and grinder
  lists they quietly fall back to A-Z; on the favourites screen nothing counts your uses,
  so the order doesn't change.

---

## Small glossary

| Word | What it means here |
| --- | --- |
| **Batch** | One bag of a coffee. The same coffee bought twice gives you one bean entry and two batches, each with its own roast date and weight. |
| **Profile** | The machine's recipe for pressure/flow/temperature during the shot. DYE2 lets you pick one; you build them elsewhere in Decaid. |
| **Workflow** | Decaid's name for the settings the next shot will use — what the right half of the dashboard edits. |
| **Dose / Drink** | Grams of dry coffee in / grams of espresso out. |
| **Brew ratio** | Drink divided by dose. 18 g in and 40 g out is about 1:2.2. |
| **RPM** | How fast your grinder's burrs turn, if your grinder can set it. |
| **Recipe** | A DYE2 slot holding a full set of next-shot settings you can re-apply in one tap. |
| **Favourite** | Like a recipe, but you choose exactly which fields it copies. |
| **Visualizer** | visualizer.coffee, a website for storing and comparing shots. |
| **Decaid** | The tablet software DYE2 plugs into (formerly ReaPrime / Streamline). |
