"""Render public app configuration; never read or write a deployment secret."""
import os
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]


def render_config(client_id, directory=None):
    if not isinstance(client_id, str) or not re.fullmatch(r"[a-fA-F0-9]{32}", client_id):
        raise ValueError("Set SHOPIFY_APP_CLIENT_ID to Gooidy's 32-character Client ID.")
    template = (ROOT / "ops/shopify/shopify.app.production.toml.template").read_text()
    if template.count("__GOOIDY_CLIENT_ID__") != 1:
        raise ValueError("The Shopify configuration template needs one Client ID placeholder.")
    target = Path(directory) if directory else ROOT / "ops/shopify"
    target.mkdir(parents=True, exist_ok=True)
    path = target / "shopify.app.production.toml"
    path.write_text(template.replace("__GOOIDY_CLIENT_ID__", client_id))
    return path


if __name__ == "__main__":
    try:
        render_config(os.environ.get("SHOPIFY_APP_CLIENT_ID"))
    except ValueError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
    print("Shopify app configuration prepared. No credentials were written.")
