output "oidc_provider_arn" {
  value = aws_iam_openid_connect_provider.this.arn
}

output "service_account_role_arns" {
  value = {
    for name, role in aws_iam_role.service_account : name => role.arn
  }
}

output "service_account_role_names" {
  value = {
    for name, role in aws_iam_role.service_account : name => role.name
  }
}
