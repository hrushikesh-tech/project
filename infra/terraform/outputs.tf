output "platform_contract" {
  description = "Primary outputs that Helm, ArgoCD, and operators should consume."

  value = {
    environment = var.environment
    aws_region  = var.aws_region

    eks = {
      cluster_name     = module.eks.cluster_name
      cluster_endpoint = module.eks.cluster_endpoint
      oidc_issuer_url  = module.eks.oidc_issuer_url
    }

    aurora = {
      endpoint               = module.aurora.endpoint
      reader_endpoint        = module.aurora.reader_endpoint
      port                   = module.aurora.port
      master_user_secret_arn = module.aurora.master_user_secret_arn
    }

    elasticache = {
      primary_endpoint = module.elasticache.primary_endpoint
      reader_endpoint  = module.elasticache.reader_endpoint
      port             = module.elasticache.port
    }

    s3 = {
      bucket_name = module.s3.bucket_name
      bucket_arn  = module.s3.bucket_arn
    }

    waf = {
      web_acl_arn              = module.waf.web_acl_arn
      association_resource_arn = var.waf_association_resource_arn
    }

    service_account_role_annotations = {
      for name, arn in module.iam.service_account_role_arns :
      name => {
        "eks.amazonaws.com/role-arn" = arn
      }
    }
  }
}

output "eks_cluster_name" {
  value = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "eks_oidc_issuer_url" {
  value = module.eks.oidc_issuer_url
}

output "aurora_endpoint" {
  value = module.aurora.endpoint
}

output "aurora_reader_endpoint" {
  value = module.aurora.reader_endpoint
}

output "aurora_master_user_secret_arn" {
  value = module.aurora.master_user_secret_arn
}

output "elasticache_primary_endpoint" {
  value = module.elasticache.primary_endpoint
}

output "elasticache_reader_endpoint" {
  value = module.elasticache.reader_endpoint
}

output "s3_bucket_name" {
  value = module.s3.bucket_name
}

output "s3_bucket_arn" {
  value = module.s3.bucket_arn
}

output "waf_web_acl_arn" {
  value = module.waf.web_acl_arn
}

output "service_account_role_arns" {
  value = module.iam.service_account_role_arns
}

output "service_account_role_annotations" {
  value = {
    for name, arn in module.iam.service_account_role_arns :
    name => {
      "eks.amazonaws.com/role-arn" = arn
    }
  }
}
