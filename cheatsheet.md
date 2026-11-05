# k99 remote access cheat sheet

## How you connect

| What | Route | Login |
|---|---|---|
| T3 Code | `https://k99.tail86a49c.ts.net/` (Tailscale Serve to `127.0.0.1:3773`) | T3 pairing session |
| SSH, Cursor, VS Code | `peter@k99` over the tailnet (`100.119.217.28`) | OpenSSH with your ED25519 key |

Shortcut for the T3 binary:
```sh
alias t3=~/.t3/runtime/versions/0.1.0/t3   # update the version after `t3 update`
```

## T3: pairing and permissions

```sh
t3 pair --tailscale --label "mac"           # pairing link + QR, valid 5 min, default (full) permissions
t3 pair --tailscale --ttl 15m --label "ipad" --scope orchestration:read --scope orchestration:operate
                                            # any --scope REPLACES the whole default set
t3 auth session list                        # sessions and their permissions (tokens never shown)
t3 auth session revoke <session-id>         # remove a client
```

- You can't edit a session's permissions. Pair again, then revoke the old session.
- Check a client's permissions in T3: **Settings → Environments → k99 → Permissions**.
- Default permissions: `orchestration:read/operate settings:write providers:manage environment:maintain preview:operate diagnostics:read terminal:read/operate source-control:write filesystem:read/write relay:read`. `access:*` and `relay:write` are not included.

| T3 symptom | Missing permission |
|---|---|
| "This connection cannot read host files" | `filesystem:read` |
| Can't save or edit files | `filesystem:write` |
| No commit or push | `source-control:write` |
| Can't see other terminals | `terminal:read` |

## T3 service

```sh
t3 service --help        # manage the background service
t3 update                # upgrade t3 (and the service)
ss -tlnp | grep 3773     # is the server listening?
```

## Tailscale

```sh
tailscale status                          # tailnet peers
tailscale serve status                    # what's exposed over HTTPS
tailscale debug prefs | grep RunSSH       # should be false (OpenSSH handles SSH)
sudo tailscale set --ssh=false            # keep Tailscale SSH off (current setting)
sudo tailscale set --ssh=true             # turns it back on: drops its SSH sessions, and
                                          # "check" mode breaks Cursor and VS Code
```

## SSH, Cursor, VS Code

```sh
ssh peter@k99                             # from the Mac
ssh-keygen -R k99                         # after a "host key changed" warning
ssh -v peter@k99                          # verbose output for debugging
```

Mac `~/.ssh/config`:
```
Host k99
  HostName k99
  User peter
  IdentityFile ~/.ssh/id_ed25519
  ServerAliveInterval 30
```

## Troubleshooting (on the server)

```sh
journalctl -u ssh --since "-1h" --no-pager | tail          # OpenSSH logins
journalctl -u tailscaled --since "-1h" --no-pager | grep -i ssh
ls -t ~/.vscode-server/data/logs ~/.cursor-server/data/logs | head   # last editor connections
rm -rf ~/.cursor-server ~/.vscode-server   # last resort: the editor reinstalls its server
```

Rules of thumb:
- **The T3 terminal works but a feature doesn't:** it's a missing T3 permission, not the network.
- **Editors hang but `ssh` works:** check `RunSSH`, then the editor's server logs.