# Kimi K2.5 Spot bootstrap

This directory stages `unsloth/Kimi-K2.5-GGUF` `UD-Q2_K_XL` from an S3 mirror onto EC2 instance-store NVMe, validates all eight shards, and starts an OpenAI-compatible `llama-server`.

## Safety boundary

Do not launch `g7e.24xlarge` until the same bootstrap sequence has completed on a cheap instance. The cheap validation instance should have at least 475 GB of local NVMe and 512 GiB RAM so it can download and attempt to load the entire 374,764,330,144-byte model. The expected CPU-only load may fail because runtime overhead exceeds the remaining RAM; that result is still useful as long as the download, checksum, readiness marker, and server invocation are verified.

## S3 layout

The S3 prefix mirrors the manifest paths:

```text
s3://BUCKET/kimi-k2.5/386fed8b.../UD-Q2_K_XL/
  Kimi-K2.5-UD-Q2_K_XL-00001-of-00008.gguf
  ...
  Kimi-K2.5-UD-Q2_K_XL-00008-of-00008.gguf
```

The instance needs read-only `s3:GetObject` access to that prefix. Use an S3 gateway VPC endpoint when the instance has no direct public route; do not route the 375 GB download through a NAT Gateway.

## Bootstrap

On an instance where the NVMe filesystem is mounted at `/mnt/kimi`:

```bash
sudo install -m 0755 bin/kimi-bootstrap /usr/local/bin/kimi-bootstrap

kimi-bootstrap download \
  --manifest manifest.json \
  --source s3://BUCKET/kimi-k2.5/386fed8b054275941d6a495a9a7010fbf31b560d \
  --destination /mnt/kimi \
  --parallel DOWNLOAD_CONCURRENCY

kimi-bootstrap start \
  --manifest manifest.json \
  --destination /mnt/kimi \
  --server-config server-config.json
```

Downloads use `*.partial` files and atomic renames. Every completed shard is checked against the Hugging Face LFS SHA-256 digest. A manifest-bound `.kimi-model-ready` marker is written only after all files pass validation. Download concurrency is required rather than guessed; select it for the network and storage configuration under test.

`server-config.json` leaves context size and request concurrency at llama.cpp's resolved settings rather than introducing separate limits. Add explicitly configured values only when testing a known workload.

## Model mirror

Download directly from the immutable Hugging Face revision, verify it against `manifest.json`, and upload the same paths to S3. The bootstrap instance never needs Hugging Face credentials.
