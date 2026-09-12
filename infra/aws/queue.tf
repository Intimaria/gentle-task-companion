# Cola async para la ingesta de favoritos de animalitos (saveAnimal: fetch a API
# externa → S3 → DynamoDB). Desacopla la latencia del usuario de la flakiness del
# fetch externo. La DLQ retiene los mensajes que fallan 3 veces (URL rota, API caída).

module "events_queue" {
  source  = "terraform-aws-modules/sqs/aws"
  version = "~> 4.0"

  name = "gentle-task-events"

  # DLQ compañera + redrive tras 3 recepciones fallidas.
  create_dlq                    = true
  redrive_policy                = { maxReceiveCount = 3 }
  dlq_message_retention_seconds = 1209600 # 14 días (máximo de SQS) para inspección
}
