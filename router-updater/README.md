# NebulaDash Router Updater

This folder contains the optional router-side updater used by NebulaDash.

It is for the workflow where the NebulaDash frontend button triggers a router-side script, instead
of manually copying `dist/` into `/www/nebuladash` each time.

## Runtime Layout

```text
/usr/share/nebuladash-updater/
  config
  updater.sh
  state.json
  logs/
  work/

/www/cgi-bin/nebuladash-updater
/www/nebuladash -> /www/nebuladash-a or /www/nebuladash-b
/www/nebuladash-a
/www/nebuladash-b
```

Most updater files live under `/usr/share/nebuladash-updater/`. The CGI file is a thin uHTTPd entry
point because OpenWrt serves CGI from `/www/cgi-bin`.

## Install

Copy `router-updater.zip` to the router, extract it, and run:

```sh
rm -rf /tmp/nebuladash/router-updater
unzip -oq /tmp/nebuladash/router-updater.zip -d /tmp/nebuladash
sh /tmp/nebuladash/router-updater/install.sh
```

The installer prints a generated token on first install. Save that token in NebulaDash settings.
Re-running the installer keeps an existing `/usr/share/nebuladash-updater/config`.

The installer also normalizes CRLF line endings in installed scripts and config, which avoids token
comparison failures caused by Windows-generated archives.

## Frontend Settings

Endpoint:

```text
http://192.168.6.1/cgi-bin/nebuladash-updater
```

Token:

```text
Use the generated NEBULADASH_TOKEN value.
```

The token is a local updater token. It is not a GitHub token, not an OpenClash secret, and not the
Mihomo API password.

Do not append the token to the endpoint manually in the settings page. NebulaDash adds the token to
requests automatically.

## Safety

The updater deploys into the inactive partition first. It switches `/www/nebuladash` only after the
new partition contains:

- `index.html`
- `assets/`
- `manifest.webmanifest`

The default release URL is:

```text
https://github.com/boostemotion/nebuladash/releases/latest/download/dist.zip
```

The updater rejects non-NebulaDash GitHub release ZIP URLs.

The frontend checks the latest NebulaDash Release before running `update`. If the version cannot be
confirmed, is the same version, or is older than the current build, NebulaDash shows a confirmation
dialog. Confirming still allows the update so intentional rollback or overwrite remains possible.

OpenWrt/uHTTPd may not forward custom HTTP headers to CGI scripts. The CGI therefore accepts both:

- `X-NebulaDash-Token: <token>` header
- `token=<token>` query parameter fallback

The header is preferred. The query fallback is present for uHTTPd compatibility.

## Update

Use the NebulaDash settings button, or run the HTTP endpoint from the router:

```sh
wget -qO- \
  "http://127.0.0.1/cgi-bin/nebuladash-updater?action=update&token=<token>"
```

The update downloads:

```text
https://github.com/boostemotion/nebuladash/releases/latest/download/dist.zip
```

It deploys to the inactive partition and switches `/www/nebuladash` only after verification passes.

## Rollback

Use the NebulaDash settings rollback button or run:

```sh
NEBULADASH_UPDATER_CONFIG=/usr/share/nebuladash-updater/config \
  /usr/share/nebuladash-updater/updater.sh rollback
```

## Status

Check status from the router:

```sh
NEBULADASH_UPDATER_CONFIG=/usr/share/nebuladash-updater/config \
  /usr/share/nebuladash-updater/updater.sh status
```

Or from HTTP:

```sh
curl -H "X-NebulaDash-Token: <token>" \
  "http://192.168.6.1/cgi-bin/nebuladash-updater?action=status"
```

If that returns `Unauthorized updater request` on OpenWrt, test the query-token fallback:

```sh
wget -qO- \
  "http://127.0.0.1/cgi-bin/nebuladash-updater?action=status&token=<token>"
```

`No update has run yet` is a normal idle status before the first successful update.

## Uninstall

Remove the CGI entry and runtime folder:

```sh
rm -f /www/cgi-bin/nebuladash-updater
rm -rf /usr/share/nebuladash-updater
```

The A/B panel directories are not removed automatically. Remove them only after confirming you no
longer need rollback:

```sh
rm -rf /www/nebuladash-a /www/nebuladash-b
```
