from . import app, celery, db
from .ses import AmazonMailer

@celery.task
def send_mail(subject, email, body):
    mailer = AmazonMailer(app)
    return mailer.send_email(
        source=app.config['DEFAULT_MAIL_SENDER'],
        subject=subject,
        body=body,
        to_addresses=[email],
        format='html',
    )