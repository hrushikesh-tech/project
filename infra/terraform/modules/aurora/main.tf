resource "aws_security_group" "this" {
  name        = "${var.name}-sg"
  description = "Aurora access for the Amdox platform"
  vpc_id      = var.vpc_id
  tags        = var.tags
}

resource "aws_security_group_rule" "ingress" {
  for_each = toset(var.allowed_cidr_blocks)

  type              = "ingress"
  from_port         = 5432
  to_port           = 5432
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

resource "aws_db_subnet_group" "this" {
  name       = "${var.name}-subnets"
  subnet_ids = var.subnet_ids
  tags       = var.tags
}

resource "aws_rds_cluster" "this" {
  cluster_identifier              = var.name
  engine                          = "aurora-postgresql"
  engine_version                  = var.engine_version
  database_name                   = var.database_name
  master_username                 = var.master_username
  manage_master_user_password     = true
  storage_encrypted               = true
  db_subnet_group_name            = aws_db_subnet_group.this.name
  vpc_security_group_ids          = [aws_security_group.this.id]
  backup_retention_period         = var.backup_retention_days
  preferred_backup_window         = var.preferred_backup_window
  preferred_maintenance_window    = var.preferred_maintenance_window
  copy_tags_to_snapshot           = true
  skip_final_snapshot             = true
  deletion_protection             = true
  enabled_cloudwatch_logs_exports = ["postgresql"]
  tags                            = var.tags

  serverlessv2_scaling_configuration {
    min_capacity = var.min_capacity
    max_capacity = var.max_capacity
  }
}

resource "aws_rds_cluster_instance" "this" {
  count                = 2
  identifier           = "${var.name}-${count.index + 1}"
  cluster_identifier   = aws_rds_cluster.this.id
  instance_class       = "db.serverless"
  engine               = aws_rds_cluster.this.engine
  engine_version       = aws_rds_cluster.this.engine_version
  publicly_accessible  = false
  promotion_tier       = count.index + 1
  db_subnet_group_name = aws_db_subnet_group.this.name
  tags                 = var.tags
}
