# Budget de costo: tope mensual + alertas por email. Guarda contra anomalías
# (Lambda en loop, escrituras on-demand disparadas, transfer inesperada), no contra
# el uso normal, que para esta app ronda centavos por mes.

resource "aws_budgets_budget" "monthly" {
  name         = "gentle-monthly"
  budget_type  = "COST"
  limit_amount = var.budget_limit
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Aviso temprano: al gastar el 80% ($4) de lo permitido.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  # Aviso antes de pasarse: si el forecast del mes supera el 100% ($5).
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}
