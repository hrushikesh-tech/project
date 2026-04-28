resource "aws_security_group" "this" {
  name        = "${var.name}-sg"
  description = "Redis access for the Amdox platform"
  vpc_id      = var.vpc_id
  tags        = var.tags
}

resource "aws_security_group_rule" "ingress" {
  for_each = toset(var.allowed_cidr_blocks)

  type              = "ingress"
  from_port         = var.port
  to_port           = var.port
  protocol          = "tcp"
  cidr_blocks       = [each.value]
  security_group_id = aws_security_group.this.id
}

resource "aws_security_group_rule" "egress" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.this.id
}

resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.name}-subnets"
  subnet_ids = var.subnet_ids
  tags       = var.tags
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id       = var.name
  description                = "Redis for the Amdox platform"
  engine                     = "redis"
  engine_version             = var.engine_version
  node_type                  = var.node_type
  port                       = var.port
  parameter_group_name       = "default.redis7"
  num_cache_clusters         = 2
  automatic_failover_enabled = true
  multi_az_enabled           = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.auth_token
  subnet_group_name          = aws_elasticache_subnet_group.this.name
  security_group_ids         = [aws_security_group.this.id]
  snapshot_retention_limit   = var.snapshot_retention_limit
  apply_immediately          = true
  tags                       = var.tags
}
