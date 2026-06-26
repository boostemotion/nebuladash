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

Copy this folder to the router and run:

```sh
sh router-updater/install.sh
```

The installer prints a generated token. Save that token in NebulaDash settings.

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
