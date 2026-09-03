import importlib.util
import os
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch


MODULE_PATH = Path(__file__).parents[1] / "janitor.py"
SPEC = importlib.util.spec_from_file_location("janitor", MODULE_PATH)
JANITOR = importlib.util.module_from_spec(SPEC)
BOTO3 = MagicMock()
sys.modules["boto3"] = BOTO3
SPEC.loader.exec_module(JANITOR)


class JanitorTests(unittest.TestCase):
    def test_parse_expiry_requires_utc_z(self):
        expected = datetime(2026, 8, 31, 12, 0, tzinfo=timezone.utc)
        self.assertEqual(JANITOR.parse_expiry("2026-08-31T12:00:00Z"), expected)
        for invalid in ("2026-08-31T12:00:00", "2026-08-31T12:00:00+00:00", "not-a-date"):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                JANITOR.parse_expiry(invalid)

    def test_selects_expired_and_fail_closed_instances(self):
        enforced = {"Key": "ExpiryEnforcement", "Value": "required"}
        reservations = [{"Instances": [
            {"InstanceId": "i-expired", "Tags": [enforced, {"Key": "AutoTerminateAt", "Value": "2026-08-31T11:59:59Z"}]},
            {"InstanceId": "i-current", "Tags": [enforced, {"Key": "AutoTerminateAt", "Value": "2026-08-31T12:00:01Z"}]},
            {"InstanceId": "i-missing", "Tags": [enforced]},
            {"InstanceId": "i-invalid", "Tags": [enforced, {"Key": "AutoTerminateAt", "Value": "tomorrow"}]},
            {"InstanceId": "i-unmanaged", "Tags": [{"Key": "AutoTerminateAt", "Value": "2000-01-01T00:00:00Z"}]},
        ]}]
        expired, invalid = JANITOR.select_expired_instances(
            reservations, datetime(2026, 8, 31, 12, 0, tzinfo=timezone.utc)
        )
        self.assertEqual(expired, ["i-expired", "i-missing", "i-invalid"])
        self.assertEqual([item["instanceId"] for item in invalid], ["i-missing", "i-invalid"])

    @patch.dict(os.environ, {"PROJECT_TAG_VALUE": "kimi-k2.5"}, clear=True)
    def test_handler_terminates_only_selected_instances(self):
        ec2 = MagicMock()
        JANITOR.boto3.client.return_value = ec2
        enforced = {"Key": "ExpiryEnforcement", "Value": "required"}
        ec2.describe_instances.return_value = {"Reservations": [{"Instances": [
            {"InstanceId": "i-expired", "Tags": [enforced, {"Key": "AutoTerminateAt", "Value": "2000-01-01T00:00:00Z"}]},
            {"InstanceId": "i-current", "Tags": [enforced, {"Key": "AutoTerminateAt", "Value": "2999-01-01T00:00:00Z"}]},
        ]}]}
        result = JANITOR.handler({}, None)
        ec2.terminate_instances.assert_called_once_with(InstanceIds=["i-expired"])
        self.assertEqual(result["terminatedInstanceIds"], ["i-expired"])


if __name__ == "__main__":
    unittest.main()
