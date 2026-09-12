variable "sso_email" {
  description = "Email del usuario de IAM Identity Center (login del portal SSO)."
  type        = string
  default     = ""
}

variable "region" {
  type    = string
  default = "us-east-1"
}
