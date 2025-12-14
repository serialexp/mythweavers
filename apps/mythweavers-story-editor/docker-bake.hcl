variable "REGISTRY" {
  default = "aeolun"
}

variable "TAG" {
  default = "latest"
}

group "default" {
  targets = ["backend", "frontend"]
}

target "backend" {
  context = "./backend"
  dockerfile = "Dockerfile"
  tags = ["${REGISTRY}/story-backend:${TAG}"]
  output = ["type=registry"]
}

target "frontend" {
  context = "."
  dockerfile = "Dockerfile"
  tags = ["${REGISTRY}/story-frontend:${TAG}"]
  output = ["type=registry"]
}
