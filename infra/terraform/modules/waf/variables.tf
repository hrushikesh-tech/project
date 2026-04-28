variable "name" {
  type = string
}

variable "rate_limit" {
  type = number
}

variable "association_resource_arn" {
  type    = string
  default = null
}

variable "tags" {
  type = map(string)
}
