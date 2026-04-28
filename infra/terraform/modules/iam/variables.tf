variable "name" {
  type = string
}

variable "namespace" {
  type = string
}

variable "oidc_issuer_url" {
  type = string
}

variable "bucket_arn" {
  type = string
}

variable "service_accounts" {
  type = map(object({
    name            = string
    description     = string
    bucket_prefixes = list(string)
    object_actions  = list(string)
  }))
}

variable "tags" {
  type = map(string)
}
