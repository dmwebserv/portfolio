"""Run on your own machine: prints ONLY a salted hash for host secret settings."""
from getpass import getpass
from werkzeug.security import generate_password_hash

if __name__ == '__main__':
    password = getpass('New Studio password (16+ characters): ')
    if len(password) < 16:
        raise SystemExit('Use at least 16 characters. A password manager can generate one.')
    if getpass('Confirm password: ') != password:
        raise SystemExit('Passwords did not match.')
    print('\nHUB_PASSWORD_HASH (copy into hosting secret settings):')
    print(generate_password_hash(password))
