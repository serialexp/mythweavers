# Kimi inference infrastructure

This Pulumi stack owns the durable resources used by ephemeral Kimi K2.5 Spot experiments and enforces mandatory instance expiration.

## Managed resources

- Private, encrypted, versioned S3 model bucket.
- Read-only EC2 model-reader role and instance profile.
- S3 gateway endpoint on the selected VPC route table.
- Desktop-IP-restricted SSH security group and imported public key.
- EventBridge-triggered Lambda expiry janitor and CloudWatch log group.

The bucket, reader role/policy/profile, endpoint, security group, and key pair began as manually-created resources and are declared with protected imports. Pulumi must import them into stack state before it can create the janitor resources.

## Mandatory launch tags

Every inference instance governed by the janitor must carry all three tags:

```text
Project=kimi-k2.5
ExpiryEnforcement=required
AutoTerminateAt=<RFC3339 UTC timestamp ending in Z>
```

The janitor runs on the configured EventBridge schedule. It terminates opted-in project instances when `AutoTerminateAt` is elapsed, malformed, or absent. Instances without `ExpiryEnforcement=required` are outside its authority; the extra opt-in prevents this experiment's janitor from silently acquiring unrelated instances that happen to share a broad project tag.

The Lambda role can terminate only instances with both `Project=kimi-k2.5` and `ExpiryEnforcement=required` resource tags.

## Configuration

Required stack configuration:

```text
aws:region
aws:profile
vpcId
routeTableId
sshPublicKey
sshIngressCidr
janitorSchedule
```

`sshIngressCidr` is intentionally explicit because desktop public IPs change. Refresh it before a launch. `janitorSchedule` is likewise configured rather than hidden as an arbitrary code limit.

## Commands

```bash
pnpm --filter @mythweavers/kimi-inference-infra test
pnpm --filter @mythweavers/kimi-inference-infra typecheck

cd infra/kimi-k2.5/pulumi
pulumi preview --diff
pulumi up
```

Do not launch `g7e.24xlarge` until the full bootstrap has been validated on the cheaper X-family instance. The launch resource is deliberately not part of this durable stack; an experiment launcher should create the one-time instance with an explicit expiry and verify termination afterward.
