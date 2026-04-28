environment = "staging"
aws_region  = "us-east-1"

vpc_id         = "vpc-0staging123456789"
vpc_cidr_block = "10.20.0.0/16"

private_subnet_ids = [
  "subnet-0stgpriv1aaaa1111",
  "subnet-0stgpriv2bbbb2222",
  "subnet-0stgpriv3cccc3333",
]

eks_endpoint_public_access_cidrs = [
  "203.0.113.10/32",
]

aurora_min_capacity = 0.5
aurora_max_capacity = 2

redis_node_type                = "cache.t3.small"
redis_snapshot_retention_limit = 7
redis_auth_token               = "replace-me-staging-redis-token"

s3_bucket_name = "amdox-erp-assets-staging"

s3_lifecycle_rules = [
  {
    id                                     = "tmp-expiration"
    enabled                                = true
    prefix                                 = "tmp/"
    expiration_days                        = 7
    abort_incomplete_multipart_upload_days = 7
  },
  {
    id                                 = "bi-reports-retention"
    enabled                            = true
    prefix                             = "bi-reports/"
    transition_to_ia_days              = 30
    expiration_days                    = 180
    noncurrent_version_expiration_days = 30
  },
  {
    id                                 = "regulated-artifacts-retention"
    enabled                            = true
    prefix                             = "invoices/"
    expiration_days                    = 365
    noncurrent_version_expiration_days = 90
  },
]

waf_rate_limit = 2000

tags = {
  CostCenter = "erp"
  Owner      = "platform"
  Tier       = "staging"
}
