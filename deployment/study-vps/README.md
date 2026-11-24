# University Radar study preview on a shared VPS

This is a browser-local, fictional-data prototype for usability research. It does
not receive participant profiles, feedback or messages on the server. Collect
feedback separately; do not ask participants to enter real contact details.

The independent Caddy service serves `/srv/university-radar-preview/site` on
`ent01.mozelle.top:2053`; `/` redirects to `/?study=1`. It does not change the
existing 443 listener. Caddy uses HTTP-01 on port 80 for certificate issuance
and renewal, so port 80 must be available and reachable during those operations.
The Cloudflare proxy must permit HTTPS port 2053 and pass the HTTP-01 challenge.
No firewall, DNS, Xray or existing service configuration is modified here.

The service is `university-radar-preview.service`, configured with a standalone
Caddy binary and its own state directory. Before starting or updating it, check
that its directory, unit and required ports do not collide with other services.
Only install the built `software/dist` contents, never repository secrets,
device backups, SDKs or participant data. Do not share SSH credentials.

Useful read-only checks: `systemctl status university-radar-preview`,
`journalctl -u university-radar-preview -n 100`, and `ss -lntp`. Restart only
this service when its own configuration changes. Keep server authentication
and backup policy under the server owner's control.
