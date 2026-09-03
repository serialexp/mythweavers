import os
from datetime import datetime, timezone

import boto3

PROJECT_TAG = "Project"
EXPIRY_TAG = "AutoTerminateAt"
ENFORCEMENT_TAG = "ExpiryEnforcement"
ENFORCEMENT_VALUE = "required"


def parse_expiry(value: str) -> datetime:
    if not value.endswith("Z"):
        raise ValueError("expiry must be an RFC3339 UTC timestamp ending in Z")
    parsed = datetime.fromisoformat(value[:-1] + "+00:00")
    if parsed.tzinfo is None or parsed.utcoffset() != timezone.utc.utcoffset(parsed):
        raise ValueError("expiry must use UTC")
    return parsed


def select_expired_instances(reservations: list[dict], now: datetime) -> tuple[list[str], list[dict]]:
    expired = []
    invalid = []
    for reservation in reservations:
        for instance in reservation.get("Instances", []):
            instance_id = instance["InstanceId"]
            tags = {tag["Key"]: tag["Value"] for tag in instance.get("Tags", [])}
            if tags.get(ENFORCEMENT_TAG) != ENFORCEMENT_VALUE:
                continue
            expiry = tags.get(EXPIRY_TAG)
            if expiry is None:
                invalid.append({"instanceId": instance_id, "reason": f"missing {EXPIRY_TAG}"})
                expired.append(instance_id)
                continue
            try:
                if parse_expiry(expiry) <= now:
                    expired.append(instance_id)
            except ValueError as error:
                invalid.append({"instanceId": instance_id, "reason": str(error)})
                expired.append(instance_id)
    return expired, invalid


def handler(event, context):
    project = os.environ["PROJECT_TAG_VALUE"]
    ec2 = boto3.client("ec2")
    response = ec2.describe_instances(
        Filters=[
            {"Name": f"tag:{PROJECT_TAG}", "Values": [project]},
            {"Name": "instance-state-name", "Values": ["pending", "running", "stopping", "stopped"]},
        ]
    )
    now = datetime.now(timezone.utc)
    expired, invalid = select_expired_instances(response.get("Reservations", []), now)
    if expired:
        ec2.terminate_instances(InstanceIds=expired)
    result = {
        "checkedAt": now.isoformat(),
        "terminatedInstanceIds": expired,
        "invalidExpiryTags": invalid,
    }
    print(result)
    return result
