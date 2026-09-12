output "table_name" {
  value = module.dynamodb.dynamodb_table_id
}

output "bucket_name" {
  value = module.media_bucket.s3_bucket_id
}

output "api_id" {
  value = aws_apigatewayv2_api.http.id
}

# URL de invoke. Emulado = forma MiniStack (id estable vía ms-custom-id);
# real = https://{id}.execute-api.{region}.amazonaws.com/
output "api_url" {
  value = var.emulated ? "${var.ministack_public_endpoint}/_aws/execute-api/${aws_apigatewayv2_api.http.id}/" : "https://${aws_apigatewayv2_api.http.id}.execute-api.${var.region}.amazonaws.com/"
}

output "user_pool_id" {
  value = aws_cognito_user_pool.pool.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "region" {
  value = var.region
}

output "emulated" {
  value = var.emulated
}
