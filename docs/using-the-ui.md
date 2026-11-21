# Using the UI

![Recon Suite tool page with the sidebar, parameters panel and theme switcher](screenshot.png)

## Layout

- **Top bar:** logo (back to the dashboard), UTC clock, API status ("uplink"), the active
  engagement, and the theme switcher.
- **Quick open** (`Cmd+K` on macOS, `Ctrl+K` elsewhere, or **Search** in the top bar): type a
  tool or page name, code (`W-15`) or a few of its letters, pick a result with the arrow keys
  and press Enter to open it. Esc closes it.
- **Sidebar:** every tool grouped by category (DNS, Intel, Web, Network, Wireless) with its
  code, e.g. `D-01`. On small screens it becomes a horizontal strip under the top bar.
- **Dashboard:** tool cards with passive/active badges, a quick-target field, a **Host** panel
  (internet status with public IP, DNS/HTTPS latency; network interfaces with IP and MAC,
  default gateway, DNS servers; OS, CPU, memory, load, uptime of the machine running the API)
  and a summary of the active engagement.
- **System:** status checks, database, tool support and all settings (secrets only as set/unset).
- **Session target** (crosshair in the top bar): set a URL, domain or IP once and every tool
  page prefills it in the form it accepts (`https://example.com/login` becomes `example.com` for
  DNS or Port Probe and stays a URL for the HTTP Inspector; tools with free-text, CIDR or no
  target ignore it). Set it in the top bar, with **Pin for session** under Quick target, or
  with the pin icon in any tool's target field. Nothing runs automatically: press **Execute** on
  each tool. A stored last run against another target is hidden while a session target is set.
  It lasts until you clear it or close the browser tab (`sessionStorage`).
- **Batch** and **Engagements** pages, linked from the sidebar.

## Tool pages

Every remote tool page has the same structure:

1. **Header** with code, category and a `PASSIVE` or `ACTIVE` badge. Active tools also show an
   authorisation notice: they connect to the target itself.
2. **Parameters panel:** the target field plus tool options (record types, resolver, ports,
   DKIM selectors, ...). Press **Execute** or Enter.
3. **Output:** a loading terminal while the tool runs, then the results. A meta bar shows the
   target, start time and duration. The **Raw JSON** tab shows the full API response, with a
   copy button.
4. **Last run:** the API stores each tool's most recent run in the database. When you open a
   tool page again (after navigating away, reloading or from another browser), it shows that
   run with its target and a **Run again** button. A scan that is still running keeps going
   when you leave; coming back shows the loading terminal until it finishes. Tool options
   (ports, resolver, ...) are not restored.

Local tools (WiFi, Bluetooth, Host Scan) have no target field. They show a scan panel instead,
and options such as the network interface.

Many tools also list **findings**: pass, warning, fail or info, with a short explanation. These
are what an engagement collects for the report.

Discovery tools show a **radar** above their results: the target in the centre and every
discovery as a blip connected to it, one ring per category (e.g. subdomains one level deep,
deeper, wildcards). Click a ring name to hide or show that category; click a blip, or focus the
radar and use the arrow keys, to see its details and pivot links. In the WiFi and Bluetooth
radars, the distance from the centre is the signal strength (closer is stronger). Tools with a
radar: Subdomain Finder, Org Cert Search, Reverse IP, Subdomain Takeover, JS Endpoints, API
Discovery, Network Scan, Host Scan, WiFi Scanner and Bluetooth Scanner. Up to 150 blips are
drawn; the tables below the radar always hold the full results.

## Engagements

An engagement groups everything for one assessment: every tool run, findings and notes.

1. Open **Engagements**, create one (name, client, description). It becomes the active
   engagement; switch between engagements in the top bar, or pick "No engagement".
2. Run tools as usual. While an engagement is active, tool pages show "Recording to ..." and
   every run is saved. Tools are not restricted to particular targets.

The engagement page has these tabs:

| Tab      | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview | Counts and all findings, from the latest run of each tool and target, most severe first                                                                                                                                                                                                                                                                                                                                                                                                                 |
| History  | Every run with filters (tool, target, tag), tags, delete. "Open" shows a saved run on its tool page; select two runs of the same tool and "Compare" shows what changed                                                                                                                                                                                                                                                                                                                                  |
| Changes  | Change monitoring: the latest run of each tool and target compared with the run before, as readable changes (new subdomains, opened or closed ports, changed certificates, findings that changed status, grade changes, ...). Shows only pairs with changes by default. "Re-run" repeats a run with the same options in this engagement; "Re-run all" does it for every pair, one after another (stoppable). Raw output differences alone (timestamps, counting-down lifetimes) don't count as a change |
| Notes    | Free-text notes with optional target and tags                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Export   | Download a Markdown report (summary, findings, notes, run list), JSON (everything) or CSV (one row per finding)                                                                                                                                                                                                                                                                                                                                                                                         |

Tool pages also show a **Changes since last run** panel above the result when the run was
recorded in an engagement and an earlier successful run of the same tool and target exists.

Archive an engagement when it is finished: it stays readable but refuses new runs. Deleting
removes its history and notes.

## Batch runs

**Batch** runs several tools against several targets in one go. Enter targets (one per line), pick the
tools, and start. Each target
only runs with the tools that accept its kind (domain, IP or URL), with default options, two at
a time. Up to 300 jobs per batch.
With an active engagement every result is saved and linked; without one, results are only shown.

Active tools contact every target in the batch: only include systems you may test.

## Pivots

Wherever a result contains a hostname, IP address or URL, small icons next to it open that
value in another compatible tool. For example: an MX host from Email Security opens in DNS
Recon, TLS Inspector or IP Intel; a sitemap URL from Web Files opens in HTTP Inspector or Tech
Fingerprint. Which tools are offered depends on the kind of value (domain, IP or URL).

## Deep links

Every remote tool accepts `?target=` and runs immediately when opened with it:

```
http://localhost:5173/tools/dns?target=example.com
http://localhost:5173/tools/ip-intel?target=1.1.1.1
http://localhost:5173/tools/web-files?target=https://example.com
```

Use this for bookmarks or to link findings in a report. A saved run opens with
`?run=<run id>` (from the engagement history); "Run again" repeats it with the current form.

## Themes

The theme switcher in the top bar offers:

| Theme     | Look                                                                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `Cyber`   | Default. Neon cyberpunk HUD: glow, scanlines, clipped corners, Orbitron headings.                                                       |
| `Nothing` | Inspired by the Nothing design language: true black, white type, one red accent, dot-matrix headings, dot grid, rounded cards, no glow. |

The choice is stored in the browser (`localStorage`, key `recon-theme`) and applied before the
page renders. Colours keep their meaning in every theme: green is pass/success, yellow is a
warning, red/magenta is an error or critical finding.
