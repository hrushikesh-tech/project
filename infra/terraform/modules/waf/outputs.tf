output "web_acl_arn" {
  value = aws_wafv2_web_acl.this.arn
}

output "web_acl_id" {
  value = aws_wafv2_web_acl.this.id
}

output "association_resource_arn" {
  value = var.association_resource_arn
}
