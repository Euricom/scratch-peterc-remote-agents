**Remote sessions: what survives a dropped connection?**

|            | Survives Wi-Fi switch                      | Survives sleep / long outage | Reattach after closing terminal | Server-side timeout (default)                                                  |
| ---------- | ------------------------------------------ | ---------------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| **SSH**    | Only if IP stays the same (e.g. Tailscale) | ❌                           | ❌                              | None in sshd; kernel TCP ends it after ~15 min (output pending) or ~2 h (idle) |
| **Mosh**   | ✅                                         | ✅                           | ❌                              | Never (`MOSH_SERVER_NETWORK_TMOUT` unset)                                      |
| **+ tmux** | ✅                                         | ✅                           | ✅                              | Runs until killed                                                              |
| **herdr**  | ✅ (reconnects automatically)              | ✅                           | ✅                              | Server keeps running                                                           |

**Key takeaways**
- **Tailscale gives SSH a stable IP**, so switching Wi-Fi doesn't break it, which removes mosh's main advantage.
- **Mosh** helps with sleep, long outages and laggy networks (it shows your typing instantly), but **can't reattach** once the client is closed.
- **tmux is what makes a session persistent.** Without it, processes such as Claude Code die when the session ends.
- **Timeouts are configurable:** server side with `ClientAliveInterval` (sshd) or `MOSH_SERVER_NETWORK_TMOUT`, client side with `ServerAliveInterval` in `~/.ssh/config`.

**Recommendation:** `mosh k99 -- tmux new -A -s main`

That's probably more than fits on one slide. If you need it shorter, the table on its own carries the message, with the recommendation as the footer line. I can also turn this into a finished slide in the Euricom PowerPoint template.