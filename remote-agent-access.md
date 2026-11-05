# Remote Agent Access — slide deck content

12 slides, 4 sections. Each slide lists its on-slide content, followed by speaker notes.

- **Section 0 — Opening:** why remote agent access matters (slides 1–2)
- **Section 1 — Connectivity:** reaching your machine from anywhere with Tailscale (slides 3–4)
- **Section 2 — Five options:** from self-hosted to Claude-hosted (slides 5–10)
- **Section 3 — Choosing:** comparison and takeaway (slides 11–12)

Visual style: dark terminal look. Fonts: Space Grotesk (text) and JetBrains Mono (labels, code). Colours: dark `#14161a`, light `#f3f1ec`, orange accent `#ff8a3d`, blue accent `#5aa9ff` (used for the cloud option).

---

## 1. Cover — Remote agent access

- Label: `$ claude --remote`
- Title: **Remote agent access**
- Subtitle: Keep your coding agents running — and reach them from anywhere
- Footer: Peter Cosemans · Euricom

**Speaker notes:** Welcome. Today: how to keep Claude Code working while you are away from your desk, and five concrete setups to reach it — starting with the network layer that makes it all possible.

---

## 2. Why remote access

Three cards:

1. **Agents run for hours** — Long tasks shouldn't stop when you close the laptop.
2. **They need you briefly** — A permission prompt or a question — answer it from your phone.
3. **Many in parallel** — Several sessions at once — you supervise, they work.

**Speaker notes:** The shift: from pairing with an agent at your desk to supervising agents that keep running. You check in, unblock, review — from wherever you are.

---

## 3. Part 1 · Connectivity — First problem: reaching your machine at all

Diagram: **Phone / laptop** (4G, hotel Wi-Fi, client network) — *NAT · firewall · no public IP* — **Dev machine** (Home PC, Linux server, VM)

Port forwarding and public SSH are fragile and risky. We want a private network that just works.

**Speaker notes:** Every self-hosted option that follows depends on this. Your machine sits behind a home router or corporate NAT. Opening ports to the internet is the classic answer, and the wrong one.

---

## 4. Tailscale

A private WireGuard mesh between all your devices. Install, log in, done.

```
$ tailscale up
$ ssh peter@devbox
# works from anywhere
```

- **No open ports** — NAT traversal; nothing exposed to the internet
- **MagicDNS** — Reach machines by name: devbox, winpc
- **Identity-based access** — SSO login, ACLs, Tailscale SSH
- **Every platform** — Windows, macOS, Linux, iOS, Android

**Speaker notes:** Tailscale builds a peer-to-peer WireGuard network, your "tailnet". Every device gets a stable private IP and a name. Free for personal use. The terminal and t3code options ride on this; the Claude App options connect through Anthropic, so Tailscale is optional there.

---

## 5. Part 2 · Five options — From your hardware to Claude's

| # | Option | Type |
|---|--------|------|
| 01 | Claude App on Windows | Self-hosted · GUI |
| 02 | Terminal + mosh | Self-hosted · TUI |
| 03 | herdr + Claude Code | Self-hosted · TUI |
| 04 | t3code on Linux | Self-hosted · Web |
| 05 | Claude App, Claude-hosted | Cloud · GUI |

More control ← → less to maintain

**Speaker notes:** Five setups, ordered from "you own the machine" to "Claude owns the machine". For each: what it is, how it's set up, and where it shines or hurts.

---

## 6. Option 01 · Self-hosted · GUI — Claude App on your Windows PC

The Claude desktop app runs the sessions on your own machine; you follow and steer them from the Claude mobile or web app.

**Good**
- Zero setup beyond the app
- Your files, tools and network
- Same UI on desktop and phone

**Watch out**
- PC must stay on and awake
- Windows only as good as its uptime
- Tied to one machine

**Speaker notes:** Easiest start for most people. Demo: start a session on the Windows PC, pick it up on the phone. Disable sleep or use a power plan that keeps the machine awake. [Add your specific setup steps.]

---

## 7. Option 02 · Self-hosted · TUI — Simple terminal + mosh

Claude Code in a terminal on your server. mosh keeps the connection alive across Wi-Fi switches, sleep and flaky 4G.

```
$ mosh devbox
$ tmux attach
$ claude
```

**Good**
- Roams, survives sleep
- Instant local echo
- Minimal moving parts

**Watch out**
- Typing on a phone
- No scrollback: use tmux
- UDP must be allowed

**Speaker notes:** mosh (mobile shell) replaces SSH for the interactive session: it uses UDP, so your IP can change and the session simply resumes. Pair it with tmux so sessions survive disconnects and you get scrollback. Over Tailscale, UDP just works. On the phone: Blink Shell (iOS) or Termux (Android).

---

## 8. Option 03 · Self-hosted · TUI — herdr + Claude Code TUI

herdr is a terminal multiplexer built for agents: it knows which session is working, waiting for input or done.

Illustrative status panel:
```
● api-refactor
◐ docs   waiting
✓ tests  done
```

**Good**
- Herd many agents at once
- See who needs you
- Combine with mosh

**Watch out**
- Young open-source tool
- Still a terminal on phone
- New keybindings to learn

**Speaker notes:** Think tmux, but agent-aware. Each pane runs a Claude Code TUI and herdr surfaces its state, so after reconnecting you immediately see which agent is blocked on a question. The status panel on the slide is illustrative. [Add herdr install / config used in the demo.]

---

## 9. Option 04 · Self-hosted · Web — t3code on a Linux server

An open-source web GUI for coding agents. Run it on an always-on server; control it from the T3 Code app for iOS and Android, or a browser.

```
# Linux + Tailscale
$ npx t3 connect
→ pair the phone app
```

**Good**
- Native iOS + Android app
- Always on, 24/7
- Claude, Codex and more

**Watch out**
- You run the server
- Keep it off the internet
- Fast-moving project

**Speaker notes:** My own setup: a Linux server on Tailscale running t3code. T3 Code has its own mobile app on iOS and Android (Google Play: T3 Code by t3tools). Run "npx t3 connect" on the server, install the app and pair — then control Claude and Codex fully remotely. Free and open source. The browser UI also works. Keep the server bound to the tailnet only.

---

## 10. Option 05 · Cloud · GUI — Claude App, hosted by Claude

Sessions run in a cloud sandbox managed by Anthropic. Start from desktop, web or phone — no machine of yours involved.

**Good**
- Nothing to install or keep awake
- Isolated, disposable environments
- Works from any device

**Watch out**
- Code must live in a reachable repo
- No access to private LAN or VPN
- Less control over the toolchain

**Speaker notes:** The zero-ops end of the spectrum. Great for repo-based work and parallel tasks; less suited when the agent needs internal systems. Mention that a cloud session can still link to your own computer when needed.

---

## 11. Part 3 · Choosing — Side by side

| Option | Runs on | Client | Tailscale | Setup |
|--------|---------|--------|-----------|-------|
| 01 Claude App, Windows | Your PC | Claude app | Optional | Low |
| 02 Terminal + mosh | Your server | Terminal (mosh) | Yes | Low |
| 03 herdr (terminal) | Your server | Terminal (mosh) | Yes | Medium |
| 04 t3code, Linux | Your server | T3 Code app | Yes | Medium |
| 05 Claude App, cloud | Anthropic | Claude app | No | None |

**Speaker notes:** Quick recap of the trade-offs. The real choice: where must the agent run (your network or the cloud), and how do you want to interact (GUI, terminal, browser)?

---

## 12. Takeaway

**Start with Tailscale. Then pick the interface you'll actually use.**

Easy start: Claude App · Power users: mosh + herdr · Always-on: t3code · Zero-ops: cloud

Footer: Questions?

**Speaker notes:** Close with the recommendation and open the floor. Offer to share the setup notes after the session.

---

## Sources

- herdr: https://www.bitdoze.com/herdr-agent-multiplexer/ · https://betterstack.com/community/guides/ai/herdr-ai-agent/
- T3 Code: https://github.com/pingdotgg/t3code · https://play.google.com/store/apps/details?id=com.t3tools.t3code
- mosh: https://mosh.org/
- Claude Code desktop: https://code.claude.com/docs/en/desktop
