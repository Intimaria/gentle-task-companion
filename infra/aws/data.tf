# Capa de datos: DynamoDB (tabla única) + S3 (media). Vía módulos del registry
# terraform-aws-modules, con PITR / versioning / lifecycle / cifrado declarativos.

module "dynamodb" {
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "~> 4.0"

  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attributes = [
    { name = "PK", type = "S" },
    { name = "SK", type = "S" },
  ]

  # DR: backups continuos, restore a cualquier segundo de los últimos 35 días.
  point_in_time_recovery_enabled = true

  # Cifrado en reposo (clave gestionada por AWS; en real se puede usar CMK).
  server_side_encryption_enabled = true
}

module "media_bucket" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "~> 4.0"

  bucket        = var.bucket_name
  force_destroy = var.emulated

  # Recuperación ante borrados/sobrescrituras accidentales.
  versioning = {
    enabled = true
  }

  # Cifrado en reposo obligatorio.
  server_side_encryption_configuration = {
    rule = {
      apply_server_side_encryption_by_default = {
        sse_algorithm = "AES256"
      }
    }
  }

  # Lifecycle: costo sin romper el playback instantáneo (Standard-IA, NO Glacier),
  # expira versiones viejas y aborta multipart incompletos.
  lifecycle_rule = [
    {
      id      = "cost-and-hygiene"
      enabled = true
      transition = [
        {
          days          = 90
          storage_class = "STANDARD_IA"
        }
      ]
      noncurrent_version_expiration = {
        noncurrent_days = 30
      }
      abort_incomplete_multipart_upload_days = 7
    }
  ]
}
