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

variable "database_name" {
  type = string
}

variable "master_username" {
  type = string
}

variable "engine_version" {
  type = string
}

variable "min_capacity" {
  type = number
}

variable "max_capacity" {
  type = number
}

variable "backup_retention_days" {
  type = number
}

variable "preferred_backup_window" {
  type = string
}

variable "preferred_maintenance_window" {
  type = string
}

variable "tags" {
  type = map(string)
}
