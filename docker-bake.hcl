variable "REGISTRY" {
  default = "serialexp"
}

variable "TAG" {
  default = "latest"
}

group "default" {
  targets = ["backend", "story-editor", "reader"]
}

target "backend" {
  context = "."
  dockerfile = "apps/mythweavers-backend/Dockerfile"
  tags = ["${REGISTRY}/mythweavers-backend:${TAG}"]
  output = ["type=registry"]
  platforms = ["linux/amd64", "linux/arm64"]
}

target "story-editor" {
  context = "."
  dockerfile = "apps/mythweavers-story-editor/Dockerfile"
  tags = ["${REGISTRY}/mythweavers-story-editor:${TAG}"]
  output = ["type=registry"]
  platforms = ["linux/amd64", "linux/arm64"]
}

target "reader" {
  context = "."
  dockerfile = "apps/mythweavers-reading-frontend-astro/Dockerfile"
  tags = ["${REGISTRY}/mythweavers-reader:${TAG}"]
  output = ["type=registry"]
  platforms = ["linux/amd64", "linux/arm64"]
}
