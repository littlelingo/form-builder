# 1. Getting started

This page takes you from zero to a working form in about ten minutes. No code required.

## Before you start

You need:

- A computer with **Node.js 20+** and **npm** installed.
- The form-builder repository cloned to your machine.
- A browser (Chrome, Edge, Firefox, or Safari — recent versions).

> If you don't have Node installed, ask your engineer or download from <https://nodejs.org/>. You only have to install it once.

## Start the builder

From a terminal, in the project folder:

```bash
npm install        # only needed the first time
npm run builder:dev
```

The terminal prints a URL like `http://localhost:5173`. Open it in your browser.

The first time you visit, the app loads a blank form. After that, it auto-restores whatever you were last working on (saved in your browser's local storage).

<!-- TODO: screenshot — initial blank-form view with header strip and three panels visible -->

## Your first form in 10 minutes

We'll build a tiny "feedback" form with two pages and a few fields.

### Step 1 — Set the form's identity

1. In the **right panel**, click the **Setup** tab.
2. Set the **Internal title** to *Feedback form*.
3. Set the **Form ID** to *feedback-demo*.
4. Leave the URL fields blank for now.

> The **Form ID** becomes the filename when you save (`feedback-demo-authoring.json`) and is the identifier engineers use when they wire the form into VA.gov.

### Step 2 — Rename the chapter and page

A blank form starts with one **chapter** (also called a "section") containing one **page** (also called a "screen"). See [Form structure](03-form-structure.md) for what these are.

1. In the **left panel**, click the **Outline** tab. You'll see a tree:
   ```
   ▸ Chapter 1
       ▸ Page 1
   ```
2. Click *Chapter 1*. The right panel switches to the **Properties** tab and shows chapter settings.
3. Change the chapter **Title** to *Your feedback*.
4. Click *Page 1* in the outline. Change its **Title** to *About you*.

### Step 3 — Drop in a field

1. In the **left panel**, click the **Build** tab.
2. The palette shows components grouped by category (Fields, Choice, Date/time, Identity, Content, Actions).
3. Drag **Email** (under *Identity*) onto the canvas in the center.
4. The new field appears in the canvas. The right panel switches to the **Properties** tab for that field.
5. Set its **Label** to *Your email*. Leave **Required** off for now.

Repeat to add a **Textarea** (under *Fields*) below the email — set its label to *What's on your mind?*.

### Step 4 — Add a second page

1. Right-click the chapter in the **Outline** (or use the chapter's actions menu) → **Add page**.
2. Rename the new page *Thanks*.
3. From the **Build** palette, drag a **Text content** component onto the new page.
4. In the field's properties, set **Label** to *Thanks!* and **Description** to *We received your feedback.*

### Step 5 — Try it out

1. In the **header strip** at the top, click the **Run** button.
2. The center panel switches to the **Run** view — an interactive simulator.
3. Type a fake email and message; click **Continue** to advance pages.
4. Click **Submit** at the end to see the simulated submit payload.

<!-- TODO: screenshot — Run mode with sample answers filled in -->

### Step 6 — Save your form

1. Click **Save** in the header strip. A file named `feedback-demo-authoring.json` downloads to your computer.
2. The asterisk on the **Save** button (`Save *`) disappears, indicating no unsaved changes.

You can re-load this file any time via **Open JSON** in the header.

## Where forms are stored

There is **no server**. Forms live in two places:

1. **Your browser's local storage** — auto-saved on every change. If you reload the tab, your work comes back.
2. **A downloaded JSON file** — the canonical record. Treat the downloaded `*-authoring.json` as you would a Word document: store it where your team stores documents, version-control it, share it.

The browser cache can be wiped (clearing site data, switching browsers, switching machines), so **always Save when you finish a session**.

## What's next

- [Builder tour](02-builder-tour.md) — every panel and button explained.
- [Form structure](03-form-structure.md) — chapters, pages, fields, repeating sections.
- [Field reference](04-field-reference.md) — when to use each field type.
- [Import a PDF](12-import-pdf.md) — start from an existing PDF instead of a blank form.

## Related

- [Glossary](glossary.md)
- [Save, export, publish](13-save-export-publish.md)
