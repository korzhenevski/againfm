from afm import celery
from flask import current_app
from afm import mailer

@celery.task
def send_mail(subject, email, body):
    return mailer.send_email(
        source=current_app.config['DEFAULT_MAIL_SENDER'],
        subject=subject,
        body=body,
        to_addresses=[email],
        format='html',
    )