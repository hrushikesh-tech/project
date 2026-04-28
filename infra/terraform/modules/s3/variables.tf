variable "bucket_name" {
  type = string
}

variable "versioning_enabled" {
  type = bool
}

variable "force_destroy" {
  type = bool
}

variable "lifecycle_rules" {
  type = list(object({
    id                                     = string
    enabled                                = bool
    prefix                                 = optional(string)
    expiration_days                        = optional(number)
    noncurrent_version_expiration_days     = optional(number)
    abort_incomplete_multipart_upload_days = optional(number)
    transition_to_ia_days                  = optional(number)
  }))
}

variable "tags" {
  type = map(string)
}
