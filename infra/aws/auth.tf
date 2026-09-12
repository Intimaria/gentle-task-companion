# Identidad: Cognito User Pool (OIDC). El backend valida el JWT contra el JWKS de Cognito
# (mismo `jose` que con mock-oidc; solo cambian OIDC_ISSUER/JWKS_URI/AUDIENCE).
# Se usa SOLO User Pools (no Identity Pools): el navegador nunca recibe credenciales AWS;
# el acceso a S3 va por presigned URLs desde el backend.

resource "aws_cognito_user_pool" "pool" {
  name = "gentle-pool"

  # Signup SIN verificación: el email (si se provee) se auto-verifica, así la Hosted UI
  # no pide código de confirmación. Usuario+password alcanzan para registrarse.
  auto_verified_attributes = ["email"]

  username_configuration {
    case_sensitive = false
  }

  schema {
    attribute_data_type      = "String"
    name                     = "email"
    required                 = true
    mutable                  = true
    string_attribute_constraints {
      min_length = 0
      max_length = 2048
    }
  }

  # Password laxa para desarrollo (en prod: endurecer).
  password_policy {
    minimum_length    = 8
    require_lowercase = false
    require_uppercase = false
    require_numbers   = false
    require_symbols   = false
  }

  # PreSignUp auto-confirma al usuario (sin código de verificación).
  lambda_config {
    pre_sign_up = aws_lambda_function.presignup.arn
  }
}

# Dominio fijo del Hosted UI - issuer/authority determinista.
resource "aws_cognito_user_pool_domain" "domain" {
  domain       = var.cognito_domain
  user_pool_id = aws_cognito_user_pool.pool.id
}

# Grupo admin: el claim `cognito:groups` del token lo lee isAdmin() en el backend (RBAC).
resource "aws_cognito_user_group" "admin" {
  name         = "admin"
  user_pool_id = aws_cognito_user_pool.pool.id
}

# CSS custom del Hosted UI — solo en AWS real (Cognito emulado no lo soporta).
resource "aws_cognito_user_pool_ui_customization" "gentle" {
  count        = var.emulated ? 0 : 1
  user_pool_id = aws_cognito_user_pool.pool.id
  client_id    = aws_cognito_user_pool_client.web.id

  css = <<-CSS
    .background-customizable {
      background: linear-gradient(135deg, #f9a8d4 0%, #e879f9 50%, #a78bfa 100%);
    }
    .banner-customizable {
      background: transparent;
      padding: 24px 0 8px;
    }
    .submitButton-customizable {
      background-color: #c026d3;
      border-color: #c026d3;
      border-radius: 9999px;
      font-size: 16px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .submitButton-customizable:hover {
      background-color: #a21caf;
      border-color: #a21caf;
    }
    .inputField-customizable {
      border: 1px solid #e879f9;
      border-radius: 0.75rem;
      padding: 10px 14px;
    }
    .inputField-customizable:focus {
      border-color: #a21caf;
      box-shadow: 0 0 0 3px rgba(192, 38, 211, 0.2);
      outline: none;
    }
    .label-customizable {
      color: #701a75;
      font-weight: 600;
    }
    .textDescription-customizable {
      color: #86198f;
    }
    .errorMessage-customizable {
      background-color: #fdf2f8;
      border: 1px solid #f0abfc;
      border-radius: 0.5rem;
      color: #86198f;
      padding: 8px 12px;
    }
    .legalText-customizable {
      color: #a21caf;
    }
  CSS

  depends_on = [aws_cognito_user_pool_domain.domain]
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "gentle"
  user_pool_id = aws_cognito_user_pool.pool.id

  generate_secret = false # cliente público (PKCE), sin secreto

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["COGNITO"]

  # Emulado: localhost. Real: el dominio Cloudflare (derivado en el mismo apply,
  # así Cognito y el frontend matchean exacto sin placeholder).
  # trailing slash por trailingSlash:true en next.config (S3 website hosting).
  callback_urls = var.emulated ? ["http://localhost:3000/auth/callback"] : ["https://${var.frontend_domain}/auth/callback/"]
  logout_urls   = var.emulated ? ["http://localhost:3000"] : ["https://${var.frontend_domain}"]

  # USER_PASSWORD_AUTH habilita el smoke por CLI y el plan B (login propio sin Hosted UI).
  explicit_auth_flows = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH", "ALLOW_USER_SRP_AUTH"]
}
