# OpenTofu — infraestructura de Gentle Task Companion.
# Provider AWS apuntando a MiniStack (emulador local, compat LocalStack) o a AWS real.
# Los endpoints y las flags de skip se activan solo para el emulador.

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region

  # Credenciales dummy: MiniStack no las valida. En AWS real, se quitan estas
  # y se usan credenciales reales (perfil / rol).
  access_key = var.emulated ? "test" : null
  secret_key = var.emulated ? "test" : null

  # Solo para el emulador: no validar identidad ni metadata, path-style S3.
  skip_credentials_validation = var.emulated
  skip_metadata_api_check     = var.emulated
  skip_requesting_account_id  = var.emulated
  s3_use_path_style           = var.emulated

  # Todos los servicios apuntan al mismo endpoint de MiniStack.
  dynamic "endpoints" {
    for_each = var.emulated ? [1] : []
    content {
      dynamodb     = var.ministack_endpoint
      s3           = var.ministack_endpoint
      lambda       = var.ministack_endpoint
      iam          = var.ministack_endpoint
      sts          = var.ministack_endpoint
      apigatewayv2 = var.ministack_endpoint
      cognitoidp   = var.ministack_endpoint
      sqs          = var.ministack_endpoint
      kms          = var.ministack_endpoint
      logs         = var.ministack_endpoint
    }
  }
}
