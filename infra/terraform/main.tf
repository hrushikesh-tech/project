locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Stack       = "amdox-platform"
  })

  service_account_roles = {
    api = {
      name        = "api"
      description = "IRSA role for the NestJS API workload"
      bucket_prefixes = [
        "bi-reports/",
        "exports/",
        "invoices/",
        "payroll/",
        "uploads/",
      ]
      object_actions = [
        "s3:AbortMultipartUpload",
        "s3:DeleteObject",
        "s3:GetObject",
        "s3:PutObject",
      ]
    }

    api_worker = {
      name        = "api-worker"
      description = "IRSA role for the API worker workload"
      bucket_prefixes = [
        "bi-reports/",
        "exports/",
        "invoices/",
        "payroll/",
        "uploads/",
      ]
      object_actions = [
        "s3:AbortMultipartUpload",
        "s3:DeleteObject",
        "s3:GetObject",
        "s3:PutObject",
      ]
    }

    ml_service = {
      name        = "ml-service"
      description = "IRSA role for the ML service workload"
      bucket_prefixes = [
        "ml-artifacts/",
        "ml-models/",
      ]
      object_actions = [
        "s3:DeleteObject",
        "s3:GetObject",
        "s3:PutObject",
      ]
    }
  }

  waf_name = coalesce(var.waf_name, "${local.name_prefix}-waf")
}

module "eks" {
  source = "./modules/eks"

  name                         = "${local.name_prefix}-eks"
  kubernetes_version           = var.kubernetes_version
  vpc_id                       = var.vpc_id
  subnet_ids                   = var.private_subnet_ids
  endpoint_public_access       = var.eks_endpoint_public_access
  endpoint_public_access_cidrs = var.eks_endpoint_public_access_cidrs
  node_instance_types          = var.eks_node_instance_types
  node_desired_size            = var.eks_node_desired_size
  node_min_size                = var.eks_node_min_size
  node_max_size                = var.eks_node_max_size
  tags                         = local.common_tags
}

module "aurora" {
  source = "./modules/aurora"

  name                         = "${local.name_prefix}-db"
  vpc_id                       = var.vpc_id
  subnet_ids                   = var.private_subnet_ids
  allowed_cidr_blocks          = [var.vpc_cidr_block]
  database_name                = var.aurora_database_name
  master_username              = var.aurora_master_username
  engine_version               = var.aurora_engine_version
  min_capacity                 = var.aurora_min_capacity
  max_capacity                 = var.aurora_max_capacity
  backup_retention_days        = var.aurora_backup_retention_days
  preferred_backup_window      = var.aurora_preferred_backup_window
  preferred_maintenance_window = var.aurora_preferred_maintenance_window
  tags                         = local.common_tags
}

module "elasticache" {
  source = "./modules/elasticache"

  name                     = "${local.name_prefix}-redis"
  vpc_id                   = var.vpc_id
  subnet_ids               = var.private_subnet_ids
  allowed_cidr_blocks      = [var.vpc_cidr_block]
  node_type                = var.redis_node_type
  engine_version           = var.redis_engine_version
  port                     = var.redis_port
  auth_token               = var.redis_auth_token
  snapshot_retention_limit = var.redis_snapshot_retention_limit
  tags                     = local.common_tags
}

module "s3" {
  source = "./modules/s3"

  bucket_name        = var.s3_bucket_name
  versioning_enabled = var.s3_versioning_enabled
  force_destroy      = var.s3_force_destroy
  lifecycle_rules    = var.s3_lifecycle_rules
  tags               = local.common_tags
}

module "waf" {
  source = "./modules/waf"

  name                     = local.waf_name
  rate_limit               = var.waf_rate_limit
  association_resource_arn = var.waf_association_resource_arn
  tags                     = local.common_tags
}

module "iam" {
  source = "./modules/iam"

  name             = local.name_prefix
  namespace        = var.app_namespace
  oidc_issuer_url  = module.eks.oidc_issuer_url
  bucket_arn       = module.s3.bucket_arn
  service_accounts = local.service_account_roles
  tags             = local.common_tags
}
