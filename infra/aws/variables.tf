variable "emulated" {
  description = "true = MiniStack (emulador local); false = AWS real"
  type        = bool
  default     = true
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "ministack_endpoint" {
  description = "Endpoint de MiniStack visto por OpenTofu (host)"
  type        = string
  default     = "http://localhost:4566"
}

variable "ministack_internal_endpoint" {
  description = "Endpoint de MiniStack en la red docker (lo usa la Lambda para llegar a DynamoDB/S3)"
  type        = string
  default     = "http://ministack:4566"
}

variable "ministack_public_endpoint" {
  description = "Endpoint que ve el NAVEGADOR (presigned S3, API GW, Cognito)"
  type        = string
  default     = "http://localhost:4566"
}

variable "table_name" {
  type    = string
  default = "gentle"
}

variable "bucket_name" {
  description = "Bucket S3 de media. En AWS real debe ser único globalmente."
  type        = string
  default     = "gentle-media"
}

variable "frontend_bucket_name" {
  description = "Bucket S3 del frontend estático. Debe coincidir con el dominio (patrón S3 website + dominio custom: S3 resuelve el bucket por el Host)."
  type        = string
  default     = "gentle.example.com"
}

variable "frontend_domain" {
  description = "Dominio/subdominio (Cloudflare) desde donde se sirve el frontend."
  type        = string
  default     = "gentle.example.com"
}

variable "api_custom_id" {
  description = "ID fijo del API GW (tag ms-custom-id de MiniStack) para URL determinista"
  type        = string
  default     = "gentleapi"
}

variable "cognito_domain" {
  description = "Dominio fijo del Hosted UI de Cognito → issuer/authority determinista"
  type        = string
  default     = "gentle-app"
}

variable "alert_email" {
  description = "Email que recibe las alertas del budget (AWS Budgets)."
  type        = string
}

variable "budget_limit" {
  description = "Tope mensual del budget de costo, en USD."
  type        = string
  default     = "5"
}
