locals {
  oidc_provider_host = replace(var.oidc_issuer_url, "https://", "")
}

data "tls_certificate" "oidc" {
  url = var.oidc_issuer_url
}

resource "aws_iam_openid_connect_provider" "this" {
  url             = var.oidc_issuer_url
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.oidc.certificates[0].sha1_fingerprint]
  tags            = var.tags
}

data "aws_iam_policy_document" "assume_role" {
  for_each = var.service_accounts

  statement {
    effect = "Allow"

    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.this.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.oidc_provider_host}:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.oidc_provider_host}:sub"
      values   = ["system:serviceaccount:${var.namespace}:${each.value.name}"]
    }
  }
}

resource "aws_iam_role" "service_account" {
  for_each = var.service_accounts

  name               = "${var.name}-${each.key}"
  description        = each.value.description
  assume_role_policy = data.aws_iam_policy_document.assume_role[each.key].json
  tags               = var.tags
}

data "aws_iam_policy_document" "bucket_access" {
  for_each = var.service_accounts

  statement {
    sid       = "ListBucket"
    effect    = "Allow"
    actions   = ["s3:ListBucket", "s3:GetBucketLocation"]
    resources = [var.bucket_arn]

    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = each.value.bucket_prefixes
    }
  }

  statement {
    sid     = "ObjectAccess"
    effect  = "Allow"
    actions = each.value.object_actions
    resources = [
      for prefix in each.value.bucket_prefixes : "${var.bucket_arn}/${prefix}*"
    ]
  }
}

resource "aws_iam_policy" "bucket_access" {
  for_each = var.service_accounts

  name   = "${var.name}-${each.key}-s3"
  policy = data.aws_iam_policy_document.bucket_access[each.key].json
  tags   = var.tags
}

resource "aws_iam_role_policy_attachment" "bucket_access" {
  for_each = var.service_accounts

  role       = aws_iam_role.service_account[each.key].name
  policy_arn = aws_iam_policy.bucket_access[each.key].arn
}
