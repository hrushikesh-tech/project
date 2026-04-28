variable "project_name" {
  type    = string
  default = "amdox"
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "vpc_id" {
  type = string
}

variable "vpc_cidr_block" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "app_namespace" {
  type    = string
  default = "amdox"
}

variable "kubernetes_version" {
  type    = string
  default = "1.31"
}

variable "eks_node_instance_types" {
  type    = list(string)
  default = ["t3.large"]
}

variable "eks_node_desired_size" {
  type    = number
  default = 2
}

variable "eks_node_min_size" {
  type    = number
  default = 2
}

variable "eks_node_max_size" {
  type    = number
  default = 4
}

variable "eks_endpoint_public_access" {
  type    = bool
  default = true
}

variable "eks_endpoint_public_access_cidrs" {
  type    = list(string)
  default = ["203.0.113.10/32"]
}

variable "aurora_engine_version" {
  type    = string
  default = "17.4"
}

variable "aurora_database_name" {
  type    = string
  default = "amdox_erp"
}

variable "aurora_master_username" {
  type    = string
  default = "amdox_admin"
}

variable "aurora_min_capacity" {
  type    = number
  default = 0.5
}

variable "aurora_max_capacity" {
  type    = number
  default = 4
}

variable "aurora_backup_retention_days" {
  type    = number
  default = 7
}

variable "aurora_preferred_backup_window" {
  type    = string
  default = "03:00-04:00"
}

variable "aurora_preferred_maintenance_window" {
  type    = string
  default = "sun:04:00-sun:05:00"
}

variable "redis_engine_version" {
  type    = string
  default = "7.1"
}

variable "redis_node_type" {
  type    = string
  default = "cache.t3.small"
}

variable "redis_port" {
  type    = number
  default = 6379
}

variable "redis_auth_token" {
  type      = string
  sensitive = true
}

variable "redis_snapshot_retention_limit" {
  type    = number
  default = 7
}

variable "s3_bucket_name" {
  type = string
}

variable "s3_versioning_enabled" {
  type    = bool
  default = true
}

variable "s3_force_destroy" {
  type    = bool
  default = false
}

variable "s3_lifecycle_rules" {
  type = list(object({
    id                                     = string
    enabled                                = bool
    prefix                                 = optional(string)
    expiration_days                        = optional(number)
    noncurrent_version_expiration_days     = optional(number)
    abort_incomplete_multipart_upload_days = optional(number)
    transition_to_ia_days                  = optional(number)
  }))
  default = []
}

variable "waf_name" {
  type    = string
  default = null
}

variable "waf_rate_limit" {
  type    = number
  default = 2000
}

variable "waf_association_resource_arn" {
  type    = string
  default = null
}
