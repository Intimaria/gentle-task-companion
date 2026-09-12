# Frontend estático (Next.js export) servido por S3 static website + Cloudflare (HTTPS).
# CloudFront está gateado por verificación de cuenta; mientras tanto Cloudflare da el
# HTTPS y el subdominio. El bucket es público SOLO de lectura (GetObject), sin ACLs.
# Solo AWS real: en el build emulado el frontend corre en docker-compose (puerto 3000).

resource "aws_s3_bucket" "frontend" {
  count         = var.emulated ? 0 : 1
  bucket        = var.frontend_bucket_name
  force_destroy = true
}

# Static website hosting: index.html por defecto + error_document=index.html (routing SPA).
resource "aws_s3_bucket_website_configuration" "frontend" {
  count  = var.emulated ? 0 : 1
  bucket = aws_s3_bucket.frontend[0].id

  index_document { suffix = "index.html" }
  error_document { key = "index.html" }
}

# Público vía bucket policy (no ACLs). block_public_policy/restrict_public_buckets en
# false son REQUISITO para permitir una bucket policy de lectura pública.
resource "aws_s3_bucket_public_access_block" "frontend" {
  count  = var.emulated ? 0 : 1
  bucket = aws_s3_bucket.frontend[0].id

  block_public_acls       = true
  block_public_policy     = false
  ignore_public_acls      = true
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "frontend" {
  count  = var.emulated ? 0 : 1
  bucket = aws_s3_bucket.frontend[0].id

  # Orden explícito: primero bajar block_public_policy (public access block), recién
  # después la policy pública. Si no, corren en paralelo y S3 rechaza el PutBucketPolicy.
  depends_on = [aws_s3_bucket_public_access_block.frontend]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend[0].arn}/*"
      }
    ]
  })
}

output "frontend_domain" {
  value = var.emulated ? "" : var.frontend_domain
}

# Endpoint S3 a donde apuntás el CNAME en Cloudflare.
output "frontend_website_endpoint" {
  value = var.emulated ? "" : aws_s3_bucket_website_configuration.frontend[0].website_endpoint
}
