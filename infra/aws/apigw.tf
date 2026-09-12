# API Gateway HTTP (v2) → proxy a la Lambda (ANY /{proxy+}; Hono rutea internamente).
# Recursos crudos (más predecibles que el módulo v5 contra el emulador). El tag
# ms-custom-id (nativo de MiniStack; NO el _custom_id_ de LocalStack, que MiniStack
# ignora) fija el apiId → URL de invoke determinista.
resource "aws_apigatewayv2_api" "http" {
  name          = "gentle-api"
  protocol_type = "HTTP"

  # En HTTP APIs el preflight CORS se maneja en el GATEWAY (no en el backend). Sin esto,
  # OPTIONS → 403 y el navegador bloquea toda request con header Authorization.
  cors_configuration {
    allow_origins = var.emulated ? ["*"] : ["https://${var.frontend_domain}"]
    allow_methods = ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["content-type", "authorization"]
    max_age       = 300
  }

  tags = { ms-custom-id = var.api_custom_id }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.backend_lambda.lambda_function_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "proxy" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGW"
  action        = "lambda:InvokeFunction"
  function_name = module.backend_lambda.lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}
