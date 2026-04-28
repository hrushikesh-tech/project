variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "allowed_cidr_blocks" {
  type = list(string)
}

variable "node_type" {
  type = string
}

variable "engine_version" {
  type = string
}

variable "port" {
  type = number
}

variable "auth_token" {
  type      = string
  sensitive = true
}

variable "snapshot_retention_limit" {
  type = number
}

variable "tags" {
  type = map(string)
}
