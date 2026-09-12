# Bootstrap de acceso: IAM Identity Center (SSO) para desplegar la app SIN access keys
# de larga vida. Nivel cuenta/org → estado separado del IaC de la app (infra/aws/).
#
# Aplicar ESTE módulo como admin (usuario con ssoadmin:*/identitystore:* — ej. la key
# root o un IAM user con Admin), UNA sola vez. El permission set resultante NO incluye
# ssoadmin:* a propósito: el usuario SSO despliega la app pero no se toca a sí mismo.

data "aws_ssoadmin_instances" "this" {}

data "aws_caller_identity" "current" {}

locals {
  instance_arn      = tolist(data.aws_ssoadmin_instances.this.arns)[0]
  identity_store_id = tolist(data.aws_ssoadmin_instances.this.identity_store_ids)[0]
  account_id        = data.aws_caller_identity.current.account_id
}

resource "aws_identitystore_user" "deploy" {
  identity_store_id = local.identity_store_id

  user_name    = "inti"
  display_name = "Inti"

  name {
    given_name  = "Inti"
    family_name = "Tidball"
  }

  emails {
    value   = var.sso_email
    primary = true
  }
}

resource "aws_ssoadmin_permission_set" "deploy" {
  instance_arn     = local.instance_arn
  name             = "gentle-deploy"
  description      = "Permisos acotados por servicio para desplegar gentle-task-companion"
  session_duration = "PT2H"
}

resource "aws_ssoadmin_permission_set_inline_policy" "deploy" {
  instance_arn       = local.instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.deploy.arn

  inline_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:*",
          "dynamodb:*",
          "s3:*",
          "sqs:*",
          "cognito-idp:*",
          "apigateway:*",
          "apigatewayv2:*",
          "cloudfront:*",
          "logs:*",
          "budgets:*",
          # Self-service: permite re-aplicar este bootstrap (gestionar el propio SSO).
          # En una cuenta unipersonal no pierde seguridad real (root ya es admin).
          "sso:*",
          "ssoadmin:*",
          "identitystore:*",
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "iam:CreateRole",
          "iam:GetRole",
          "iam:UpdateRole",
          "iam:DeleteRole",
          "iam:PutRolePolicy",
          "iam:GetRolePolicy",
          "iam:DeleteRolePolicy",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:PassRole",
          "iam:TagRole",
          "iam:UntagRole",
          "iam:UpdateAssumeRolePolicy",
          "iam:List*",
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["sts:GetCallerIdentity"]
        Resource = "*"
      },
    ]
  })
}

resource "aws_ssoadmin_account_assignment" "deploy" {
  instance_arn       = local.instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.deploy.arn

  principal_id   = aws_identitystore_user.deploy.user_id
  principal_type = "USER"

  target_id   = local.account_id
  target_type = "AWS_ACCOUNT"
}

output "portal_url" {
  value = "https://${local.identity_store_id}.awsapps.com/start"
}

output "permission_set_arn" {
  value = aws_ssoadmin_permission_set.deploy.arn
}
