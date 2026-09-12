# Cómputo: el backend Hono como una sola Lambda ("Lambdalith"), con rol de ejecución
# de mínimo privilegio (solo la tabla, el bucket y la cola del proyecto).

module "backend_lambda" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "~> 7.0"

  function_name = "gentle-backend"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 30

  # Paquete = el bundle de esbuild (un solo index.js con todas las deps).
  create_package         = false
  local_existing_package = "${path.module}/lambda.zip"

  environment_variables = {
    # Endpoints de datos: en emulado apuntan a MiniStack (la Lambda corre en la red
    # docker); en AWS real van VACÍOS → el SDK usa la cadena default (rol IAM de la Lambda).
    DYNAMODB_ENDPOINT  = var.emulated ? var.ministack_internal_endpoint : ""
    S3_ENDPOINT        = var.emulated ? var.ministack_internal_endpoint : ""
    S3_PUBLIC_ENDPOINT = var.emulated ? var.ministack_public_endpoint : ""
    S3_REGION          = var.region
    TABLE_NAME         = var.table_name
    S3_BUCKET          = var.bucket_name
    # Credenciales S3 explícitas SOLO para el emulador; en real la Lambda usa su rol IAM.
    S3_ACCESS_KEY = var.emulated ? "test" : ""
    S3_SECRET_KEY = var.emulated ? "test" : ""
    QUEUE_URL     = module.events_queue.queue_url
    # OIDC = Cognito. Split-horizon solo en emulado: el `iss` usa siempre el formato AWS
    # real (para validar el claim), pero el JWKS sale del endpoint INTERNO de MiniStack.
    # En AWS real, issuer y JWKS apuntan ambos a la URL pública de Cognito.
    OIDC_ISSUER   = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.pool.id}"
    OIDC_JWKS_URI = var.emulated ? "${var.ministack_internal_endpoint}/${aws_cognito_user_pool.pool.id}/.well-known/jwks.json" : "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.pool.id}/.well-known/jwks.json"
    OIDC_AUDIENCE = aws_cognito_user_pool_client.web.id
    # RBAC real via claim cognito:groups; ADMIN_SUBS queda como fallback dev.
    ADMIN_SUBS = "demo-user,admin"
    # El CORS lo maneja API Gateway (evita headers duplicados con el de la app).
    SKIP_APP_CORS = "1"
  }

  # Mínimo privilegio: acciones acotadas a los ARNs del proyecto.
  attach_policy_statements = true
  policy_statements = {
    dynamodb = {
      effect    = "Allow"
      actions   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:BatchWriteItem"]
      resources = [module.dynamodb.dynamodb_table_arn, "${module.dynamodb.dynamodb_table_arn}/index/*"]
    }
    s3 = {
      effect    = "Allow"
      actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
      resources = ["${module.media_bucket.s3_bucket_arn}/*"]
    }
    s3_list = {
      effect    = "Allow"
      actions   = ["s3:ListBucket"]
      resources = [module.media_bucket.s3_bucket_arn]
    }
    sqs = {
      effect    = "Allow"
      actions   = ["sqs:SendMessage"]
      resources = [module.events_queue.queue_arn]
    }
  }
}
