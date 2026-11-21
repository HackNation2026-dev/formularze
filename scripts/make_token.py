"""Print a JWT for the API using JWT_SECRET from the environment / .env."""

import sys

from formgen.api.security import issue_token
from formgen.api.settings import get_settings

if __name__ == "__main__":
    s = get_settings()
    if not s.jwt_secret:
        sys.exit("JWT_SECRET is not set")
    print(issue_token(s, subject=sys.argv[1] if len(sys.argv) > 1 else "demo"))
