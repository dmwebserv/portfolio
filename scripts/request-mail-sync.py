"""Scheduled HTTPS trigger. Logs only fixed diagnostics, never URLs/tokens/bodies."""
import json
import os
import socket
import ssl
import urllib.error
import urllib.parse
import urllib.request

CODES = {
    'SYNC_DISABLED': 'Cloudflare has no valid MAIL_SYNC_SECRET in this deployment.',
    'SYNC_UNAUTHORIZED': 'The scheduled endpoint rejected authentication.',
    'SYNC_DATABASE_FAILED': 'The endpoint could not read its mail database.',
    'SYNC_ACCOUNT_MISSING': 'No Gmail account is connected in this deployment.',
    'SYNC_MULTIPLE_ACCOUNTS': 'This sync supports one owner mailbox.',
    'SYNC_OWNER_DENIED': 'The connected mailbox owner is not allowlisted.',
    'SYNC_GMAIL_FAILED': 'Authentication passed, but the Gmail sync failed.',
}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Do not forward an authentication header to a redirect destination.
        return None


def error_hint(response):
    try:
        value = json.loads(response.read(4096))
        return CODES.get(value.get('code'), 'No recognised endpoint diagnostic; the response may come from Cloudflare or a proxy.')
    except Exception:
        return 'No recognised endpoint diagnostic; the response may come from Cloudflare or a proxy.'


def main():
    url = os.environ.get('SYNC_URL', '')
    token = os.environ.get('SYNC_TOKEN', '')
    try:
        parsed = urllib.parse.urlsplit(url)
        valid = (parsed.scheme == 'https' and parsed.hostname and
                 parsed.path == '/api/mail-sync' and not parsed.username and
                 not parsed.password and not parsed.query and not parsed.fragment and
                 parsed.port in (None, 443) and url == url.strip())
    except ValueError:
        valid = False
    if not valid:
        raise SystemExit('Invalid STUDIO_MAIL_SYNC_URL: use the exact HTTPS /api/mail-sync endpoint, without spaces or a trailing slash.')
    if len(token) < 32 or token != token.strip() or any(c.isspace() for c in token):
        raise SystemExit('Invalid STUDIO_MAIL_SYNC_TOKEN: missing, too short or contains whitespace. No value was logged.')
    request = urllib.request.Request(url, method='POST', headers={
        'Authorization': 'Bearer ' + token,
        'User-Agent': 'dmwebservices-Studio-Mail-Sync/1.0',
        'Accept': 'application/json',
    }, data=b'')
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=140) as response:
            if response.status != 200:
                raise SystemExit('Reply sync returned HTTP ' + str(response.status) + '. No email send was performed.')
            try:
                result = json.loads(response.read(4096))
            except Exception:
                raise SystemExit('Reply sync returned HTTP 200 but not JSON. Check for an Access login page or proxy response.')
            if not isinstance(result, dict) or result.get('ok') is not True:
                raise SystemExit('Reply sync returned HTTP 200 without the expected success marker.')
        print('Reply sync completed. No email send was performed.')
    except urllib.error.HTTPError as e:
        hint = error_hint(e)
        if 300 <= e.code < 400:
            hint = 'Unexpected redirect. Check the canonical Studio URL and any Cloudflare Access login protection; credentials were not forwarded.'
        raise SystemExit('Reply sync failed: HTTP ' + str(e.code) + '. ' + hint + ' No email send was performed.')
    except (TimeoutError, socket.timeout):
        raise SystemExit('Reply sync timed out. Check Studio manually; no automatic send or retry was performed.')
    except urllib.error.URLError:
        raise SystemExit('Reply sync connection/TLS/DNS failed before a valid response. No URL, credentials or response body logged.')
    except ssl.SSLError:
        raise SystemExit('Reply sync TLS verification failed. Do not disable certificate verification.')


if __name__ == '__main__':
    main()
