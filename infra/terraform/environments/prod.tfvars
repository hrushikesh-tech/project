environment = "prod"
aws_region  = "us-east-1"

vpc_id         = "vpc-0prod123456789ab"
vpc_cidr_block = "10.30.0.0/16"

private_subnet_ids = [
  "subnet-0prodpriv1aaaa1111",
  "subnet-0prodpriv2bbbb2222",
  "subnet-0prodpriv3cccc3333",
]

eks_endpoint_public_access_cidrs = [
  "198.51.100.23/32",
]

aurora_min_capacity          = 1
aurora_max_capacity          = 4
aurora_backup_retention_days = 35

redis_node_type                = "cache.t3.medium"
redis_snapshot_retention_limit = 14
redis_auth_token               = "replace-me-prod-redis-token"

s3_bucket_name = "amdox-erp-assets-prod"

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
    expiration_days                    = 730
    noncurrent_version_expiration_days = 90
  },
  {
    id                                 = "regulated-artifacts-retention"
    enabled                            = true
    prefix                             = "invoices/"
    expiration_days                    = 2555
    noncurrent_version_expiration_days = 365
  },
  {
    id                                 = "payroll-retention"
    enabled                            = true
    prefix                             = "payroll/"
    expiration_days                    = 2555
    noncurrent_version_expiration_days = 365
  },
]

waf_rate_limit = 3000

tags = {
  CostCenter = "erp"
  Owner      = "platform"
  Tier       = "prod"
}
