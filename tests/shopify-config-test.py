import importlib.util
from pathlib import Path
import tempfile
import tomllib
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("renderer", ROOT / "scripts/render-shopify-config.py")
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)


class ShopifyConfigTests(unittest.TestCase):
    def test_rejects_wrong_identifiers_without_echoing_them(self):
        for bad in [None, "", "private-secret-sentinel", "a" * 31, "a" * 33, 'a"\nclient_id="bad']:
            with self.subTest(value=type(bad).__name__):
                with self.assertRaises(ValueError) as result:
                    renderer.render_config(bad)
                self.assertNotIn("private-secret-sentinel", str(result.exception))

    def test_production_config_preserves_oauth_and_only_read_scopes(self):
        with tempfile.TemporaryDirectory() as folder:
            path = renderer.render_config("1a" * 16, folder)
            data = tomllib.loads(path.read_text())
            self.assertEqual(data["client_id"], "1a" * 16)
            self.assertEqual(data["application_url"], "https://gooidy.com/dashboard/stores")
            self.assertFalse(data["embedded"])
            self.assertEqual(data["access_scopes"]["scopes"], "read_products,read_inventory")
            self.assertTrue(data["access_scopes"]["use_legacy_install_flow"])
            self.assertEqual(data["auth"]["redirect_urls"], ["https://gooidy.com/api/shopify/callback"])

    def test_registers_operational_and_compliance_topics_at_the_signed_handler(self):
        with tempfile.TemporaryDirectory() as folder:
            text = renderer.render_config("a" * 32, folder).read_text()
            data = tomllib.loads(text)
            self.assertEqual(data["webhooks"]["api_version"], "2026-10")
            subscriptions = data["webhooks"]["subscriptions"]
            self.assertEqual(len(subscriptions), 2)
            self.assertEqual(set(subscriptions[0]["topics"]), {"products/create", "products/update", "app/uninstalled"})
            self.assertEqual(set(subscriptions[1]["compliance_topics"]), {"customers/data_request", "customers/redact", "shop/redact"})
            for subscription in subscriptions:
                self.assertEqual(subscription["uri"], "https://gooidy.com/api/shopify/webhooks")
            self.assertNotIn("client_secret", text)
            self.assertNotIn("token", text)


if __name__ == "__main__":
    unittest.main()
