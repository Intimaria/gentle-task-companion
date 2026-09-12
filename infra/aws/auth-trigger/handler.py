def lambda_handler(event, context):
    # PreSignUp: auto-confirma el usuario (sin email de verificación).
    # signup = usuario + password, queda CONFIRMED al instante.
    event["response"]["autoConfirmUser"] = True
    return event
