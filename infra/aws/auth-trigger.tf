# Trigger PreSignUp de Cognito: auto-confirma al usuario al registrarse.
# Así el signup es solo usuario+password, sin código de verificación por email.
# Código: auth-trigger/handler.py → pre-signup.zip.

resource "aws_iam_role" "presignup" {
  name = "gentle-presignup"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "presignup" {
  role       = aws_iam_role.presignup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "presignup" {
  function_name    = "gentle-presignup"
  role             = aws_iam_role.presignup.arn
  runtime          = "python3.12"
  handler          = "handler.lambda_handler"
  filename         = "${path.module}/pre-signup.zip"
  source_code_hash = filebase64sha256("${path.module}/pre-signup.zip")
}

resource "aws_lambda_permission" "presignup" {
  statement_id  = "AllowCognitoPreSignUp"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.presignup.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.pool.arn
}
